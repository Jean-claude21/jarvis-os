import { lastPass } from '@jarvis-os/core';
import type pg from 'pg';

// The health of a server (spec 023), for a monitor outside that alerts whoever runs it: the database
// answers; the watcher passed in the last five minutes; its last pass did not fail; nothing failed
// in it (a reminder, a message, a backup, a rule). Counts only: nothing personal, not who runs it.

/** A watcher silent this long is said down. */
export const WATCHER_LATE_MS = 5 * 60_000;

export interface Health {
  status: 'healthy' | 'unhealthy';
  /** The commit this deploy was built from (set by `pnpm deploy:*`), else « local ». */
  release: string;
  database: boolean;
  watcher: { lastPassAt: string | null; late: boolean; failed: boolean; failures: number };
}

const failuresIn = (report: unknown): number => {
  if (!report || typeof report !== 'object') return 0;
  let count = 0;
  for (const part of Object.values(report as Record<string, unknown>)) {
    if (part && typeof part === 'object' && 'failed' in part) {
      const failed = (part as { failed: unknown }).failed;
      if (typeof failed === 'number') count += failed;
    }
  }
  return count;
};

const RELEASE = process.env.JARVIS_RELEASE ?? 'local';

export async function healthOf(db: pg.Pool, now = Date.now()): Promise<Health> {
  try {
    const last = await lastPass(db, 'watcher');
    const at = last ? (last.endedAt ?? last.startedAt) : null;
    const late = !at || now - at.getTime() > WATCHER_LATE_MS;
    const failed = Boolean(last?.error);
    const failures = failuresIn(last?.report);
    return {
      status: late || failed || failures > 0 ? 'unhealthy' : 'healthy',
      release: RELEASE,
      database: true,
      watcher: { lastPassAt: at?.toISOString() ?? null, late, failed, failures },
    };
  } catch {
    return {
      status: 'unhealthy',
      release: RELEASE,
      database: false,
      watcher: { lastPassAt: null, late: true, failed: false, failures: 0 },
    };
  }
}
