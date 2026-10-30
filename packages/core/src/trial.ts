import type { Tx } from './db';

// A trial (spec 014): a rule, a script, a migration or an app installed for real inside a
// savepoint, its journal read, then everything rolled back — what she sees before saying yes.

export interface TrialChange {
  command: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface Trial<T> {
  result: T;
  /** What it would change, as the journal would keep it. */
  changes: TrialChange[];
}

let savepoints = 0;

/** Runs `work`; with `dryRun`, inside a savepoint that is rolled back, its changes reported. */
export async function trial<T>(tx: Tx, dryRun: boolean, work: () => Promise<T>): Promise<Trial<T>> {
  const { rows } = await tx.query<{ id: string | null }>('select max(id)::text as id from journal');
  const since = rows[0]?.id ?? '0';
  const name = `jarvis_trial_${(savepoints += 1)}`;
  if (dryRun) await tx.query(`savepoint ${name}`);
  try {
    const result = await work();
    const { rows: lines } = await tx.query<TrialChange>(
      `select command, target, before, after from journal where id > $1::bigint order by id limit 1000`,
      [since],
    );
    if (dryRun) await tx.query(`rollback to savepoint ${name}`);
    return { result, changes: lines };
  } catch (error) {
    if (dryRun) await tx.query(`rollback to savepoint ${name}`).catch(() => undefined);
    throw error;
  }
}
