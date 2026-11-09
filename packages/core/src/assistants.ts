import type { Tx } from './db';

// The charter received whole (spec 029): when each of her assistants last read her context, and
// what changed in her spaces since — by another door or another assistant.

/** A reading older than this asks the assistant to read again. */
export const CONTEXT_FRESH_HOURS = 12;

export const clientKey = (clientId: string | undefined | null) => clientId || 'direct';

/** When this assistant last read her context, or null. */
export async function lastContextRead(tx: Tx, clientId: string): Promise<Date | null> {
  const { rows } = await tx.query<{ read_at: Date }>(
    'select read_at from assistant_reading where person_id = jarvis_person() and client_id = $1',
    [clientId],
  );
  return rows[0]?.read_at ?? null;
}

/** This assistant read her context now. */
export async function markContextRead(tx: Tx, person: string, clientId: string): Promise<void> {
  await tx.query(
    `insert into assistant_reading (person_id, client_id, read_at) values ($1, $2, now())
     on conflict (person_id, client_id) do update set read_at = now()`,
    [person, clientId],
  );
}

/** When each of her assistants last read her context. */
export async function contextReadings(tx: Tx): Promise<Record<string, string>> {
  const { rows } = await tx.query<{ client_id: string; read_at: Date }>(
    'select client_id, read_at from assistant_reading where person_id = jarvis_person()',
  );
  return Object.fromEntries(rows.map((row) => [row.client_id, row.read_at.toISOString()]));
}

export interface Change {
  at: string;
  space: string;
  command: string;
  title: string | null;
  door: string;
  by: string | null;
}

/**
 * What changed in these spaces since `since` (her last reading by this assistant; the last day
 * without one), other than by this assistant itself; the latest first.
 */
export async function changesSince(
  tx: Tx,
  spaceIds: string[],
  since: Date | null,
  clientName: string | null,
  limit = 30,
): Promise<{ since: string; count: number; changes: Change[] }> {
  const from = since ?? new Date(Date.now() - 86_400_000);
  const { rows } = await tx.query<Change & { total: string }>(
    `select to_char(j.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, s.name as space,
            j.command, coalesce(j.after->>'title', j.before->>'title', j.after->>'name') as title,
            j.door, j.client as by, count(*) over () as total
       from journal j join space s on s.id = j.space_id
      where j.space_id = any($1) and j.at > $2
        and not (j.door = 'mcp' and j.client is not distinct from $3)
      order by j.at desc limit $4`,
    [spaceIds, from.toISOString(), clientName, limit],
  );
  return {
    since: from.toISOString(),
    count: Number(rows[0]?.total ?? 0),
    changes: rows.map(({ total: _total, ...one }) => one),
  };
}
