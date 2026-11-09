import type pg from 'pg';
import type { Tx } from './db';
import type { Entry } from './entries';

// Search by meaning (spec 028): each entry's words turned into a vector by a model outside the core
// (a port, so the core names no vendor), kept beside it; a question turned the same way finds the
// entries nearest to it. Read by the space's members only.

/** Turns texts into vectors of 1024 numbers: documents to keep, or a question to search with. */
export interface Embedder {
  model: string;
  embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]>;
}

export const VECTOR_DIMENSIONS = 1024;

/** The entries whose vector is missing or old, each with a member to read it as. */
export async function entriesToEmbed(
  db: pg.Pool,
  model: string,
  max: number,
): Promise<{ entryId: string; spaceId: string; person: string }[]> {
  const { rows } = await db.query<{ entry_id: string; space_id: string; person: string }>(
    'select * from jarvis_entries_to_embed($1, $2)',
    [model, max],
  );
  return rows.map((row) => ({ entryId: row.entry_id, spaceId: row.space_id, person: row.person }));
}

/** What an entry says, as turned into a vector, and its hash; null when she cannot read it. */
export async function saidOf(
  tx: Tx,
  entryId: string,
): Promise<{ text: string; hash: string } | null> {
  const { rows } = await tx.query<{ text: string | null; hash: string | null }>(
    'select jarvis_said($1) as text, md5(jarvis_said($1)) as hash',
    [entryId],
  );
  const row = rows[0];
  return row?.text && row.hash ? { text: row.text, hash: row.hash } : null;
}

const literal = (vector: number[]) => `[${vector.join(',')}]`;

/** An entry's vector, kept or replaced. */
export async function keepVector(
  tx: Tx,
  input: { entryId: string; spaceId: string; model: string; hash: string; vector: number[] },
): Promise<void> {
  if (input.vector.length !== VECTOR_DIMENSIONS) {
    throw new Error(`A vector has ${VECTOR_DIMENSIONS} numbers, not ${input.vector.length}.`);
  }
  await tx.query(
    `insert into entry_vector (entry_id, space_id, model, said_hash, embedding)
     values ($1, $2, $3, $4, $5::vector)
     on conflict (entry_id) do update set model = excluded.model, said_hash = excluded.said_hash,
       embedding = excluded.embedding, updated_at = now()`,
    [input.entryId, input.spaceId, input.model, input.hash, literal(input.vector)],
  );
}

/**
 * The entries of a space nearest in meaning to a question's vector, the nearest first, within
 * `maxDistance` (cosine distance: 0 the same, 1 unrelated). Archived ones stay out.
 */
export async function nearEntries(
  tx: Tx,
  spaceId: string,
  vector: number[],
  options: { limit?: number; maxDistance?: number; kind?: string } = {},
): Promise<(Entry & { distance: number })[]> {
  const { rows } = await tx.query<Entry & { distance: number }>(
    `select e.id, e.kind, e.title, e.data, e.origin,
            to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            to_char(e.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt",
            null as "archivedAt", (v.embedding <=> $2::vector)::float as distance
       from entry_vector v join entry e on e.id = v.entry_id
      where v.space_id = $1 and e.archived_at is null
        and ($4::text is null or jarvis_fold(e.kind) = jarvis_fold($4))
        and (v.embedding <=> $2::vector) <= $3
      order by v.embedding <=> $2::vector
      limit $5`,
    [
      spaceId,
      literal(vector),
      options.maxDistance ?? 0.6,
      options.kind ?? null,
      options.limit ?? 10,
    ],
  );
  return rows;
}
