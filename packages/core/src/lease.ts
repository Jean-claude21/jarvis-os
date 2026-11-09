import type pg from 'pg';

// One watcher at a time (spec 021): a lease in the database, taken before a pass and given back
// after it, with the pass's trace. It expires by itself when its holder stops in the middle.

export const LEASE_SECONDS = 300;

export interface LastPass {
  holder: string;
  until: Date;
  startedAt: Date;
  endedAt: Date | null;
  report: unknown;
  error: string | null;
}

/** True when `holder` now holds the lease `name`: it was free, expired, or already its own. */
export async function takeLease(
  db: pg.Pool,
  name: string,
  holder: string,
  seconds = LEASE_SECONDS,
): Promise<boolean> {
  const { rows } = await db.query<{ taken: boolean | null }>(
    'select jarvis_lease_take($1, $2, $3) as taken',
    [name, holder, seconds],
  );
  return rows[0]?.taken === true;
}

/** The lease given back by its holder, with what the pass did or why it failed. */
export async function giveLease(
  db: pg.Pool,
  name: string,
  holder: string,
  outcome: { report?: unknown; error?: string },
): Promise<boolean> {
  const { rows } = await db.query<{ given: boolean | null }>(
    'select jarvis_lease_give($1, $2, $3, $4) as given',
    [
      name,
      holder,
      outcome.report === undefined ? null : JSON.stringify(outcome.report),
      outcome.error ?? null,
    ],
  );
  return rows[0]?.given === true;
}

/** The last pass on this database, or null before the first. */
export async function lastPass(db: pg.Pool, name: string): Promise<LastPass | null> {
  const { rows } = await db.query<{
    holder: string;
    until: Date;
    started_at: Date;
    ended_at: Date | null;
    report: unknown;
    error: string | null;
  }>('select * from jarvis_lease_last($1)', [name]);
  const row = rows[0];
  return row
    ? {
        holder: row.holder,
        until: row.until,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        report: row.report,
        error: row.error,
      }
    : null;
}
