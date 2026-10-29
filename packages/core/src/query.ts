import type { Tx } from './db';
import { querySchema } from './schemas';

export const QUERY_ROW_LIMIT = 500;

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  /** More rows exist than the limit returned. */
  truncated: boolean;
}

/** Her rows, copied for this transaction only: the only tables a query can see. */
const copies = [
  {
    name: 'my_entries',
    select: `select id, kind, title, data, origin, created_at, updated_at, archived_at
               from entry where space_id = $1`,
  },
  {
    name: 'my_links',
    select: 'select id, from_id, to_id, role, created_at from link where space_id = $1',
  },
  {
    name: 'my_files',
    select:
      'select entry_id, name, media_type, size, text, created_at from file where space_id = $1',
  },
];

/**
 * Figures from the database, never from a model's head (decision 0004): one `select` written by
 * the model over `my_entries`, `my_links`, `my_files`. Her rows are copied into temporary tables,
 * and the query runs as `jarvis_reader`, which is granted those copies and nothing else — not the
 * real tables, not the accounts, not the journal — with a time limit and a row limit. Run it alone
 * in its transaction: the limits stay set until the transaction ends.
 */
export async function query(tx: Tx, input: { spaceId: string; sql: string }): Promise<QueryResult> {
  const sql = querySchema.parse({ sql: input.sql }).sql.replace(/;\s*$/, '');
  for (const copy of copies) {
    await tx.query(`drop table if exists pg_temp.${copy.name}`);
    await tx.query(
      `create temp table ${copy.name} on commit drop as ${copy.select.replace('$1', 'null')} and false`,
    );
    await tx.query(`insert into pg_temp.${copy.name} ${copy.select}`, [input.spaceId]);
    await tx.query(`grant select on pg_temp.${copy.name} to jarvis_reader`);
  }
  await tx.query("set local statement_timeout = '3s'");
  await tx.query('set local role jarvis_reader');
  try {
    // Wrapped as a subquery and sent with the extended protocol: one statement, a `select`.
    const result = await tx.query({
      text: `select * from (\n${sql}\n) as q limit ${QUERY_ROW_LIMIT + 1}`,
      values: [],
    });
    const rows = result.rows as Record<string, unknown>[];
    return {
      columns: result.fields.map((field) => field.name),
      rows: rows.slice(0, QUERY_ROW_LIMIT),
      truncated: rows.length > QUERY_ROW_LIMIT,
    };
  } finally {
    await tx.query('reset role').catch(() => undefined);
  }
}
