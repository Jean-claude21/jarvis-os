import pg from 'pg';

/** A transaction acting for one person: every row-level security policy reads her. */
export type Tx = pg.PoolClient;

/** Who changes something, and through which door (`api`, `mcp`, `worker`, `test`). */
export interface Actor {
  person: string;
  door: string;
  /** The client behind the door, when known (« claude », « chatgpt », « jarvis-app »). */
  client?: string;
}

export function pool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 5 });
}

/**
 * Runs `work` in one transaction for `person`: committed when it returns, rolled back when it
 * throws. The pool connects as `jarvis_app`, which cannot bypass row-level security.
 */
export async function asPerson<T>(
  db: pg.Pool,
  person: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query('begin');
    await tx.query("select set_config('jarvis.person', $1, true)", [person]);
    const result = await work(tx);
    await tx.query('commit');
    return result;
  } catch (error) {
    await tx.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    tx.release();
  }
}
