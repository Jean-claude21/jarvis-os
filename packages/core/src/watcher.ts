import type pg from 'pg';
import { asPerson, type Actor } from './db';
import { get, save } from './entries';
import { DEFAULT_ZONE, nextTime, timeOf } from './time';

// The watcher (spec 006): it tells her on time. A reminder is an entry « Reminder »: `at` (a time,
// once) or `repeat` (five fields, again and again) on the clock of `timezone`; `message` what to say.
// Each pass finds what is due, tells the people of its space, then writes what it did.

/** A reminder due now, as told to one person. */
export interface Due {
  person: string;
  spaceId: string;
  entryId: string;
  title: string;
  message: string | null;
  /** When it was due. */
  at: Date;
  repeated: boolean;
}

/** A repeated reminder later than this is skipped to its next time, not sent: no flood after a pause. */
const STALE_MS = 2 * 3_600_000;

export interface PassReport {
  sent: number;
  scheduled: number;
  skipped: number;
  failed: number;
}

/**
 * One pass: every reminder due by `now`, told through `tell` (true when she was reached) to each
 * person of its space; a repeated one moves to its next time, a single one becomes `sent`.
 */
export async function watchOnce(
  db: pg.Pool,
  now: Date,
  tell: (due: Due) => Promise<boolean>,
): Promise<PassReport> {
  const report: PassReport = { sent: 0, scheduled: 0, skipped: 0, failed: 0 };
  const horizon = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const { rows } = await db.query<{ entry_id: string; space_id: string; persons: string[] }>(
    'select entry_id, space_id, persons from jarvis_due_reminders($1)',
    [horizon],
  );
  for (const row of rows) {
    const keeper = row.persons[0];
    if (!keeper) continue;
    const actor: Actor = { person: keeper, door: 'watcher' };
    const entry = await asPerson(db, keeper, (tx) => get(tx, row.space_id, row.entry_id));
    if (!entry) continue;
    const zone = typeof entry.data.timezone === 'string' ? entry.data.timezone : DEFAULT_ZONE;
    const repeat = typeof entry.data.repeat === 'string' ? entry.data.repeat : null;
    const write = (data: Record<string, unknown>) =>
      asPerson(db, keeper, (tx) =>
        save(tx, actor, row.space_id, {
          entries: [{ id: row.entry_id, data, origin: 'inferred' }],
        }),
      );
    try {
      const next = (after: Date) => nextTime(repeat!, after, zone).toISOString();
      const at = timeOf(repeat ? entry.data.next : entry.data.at, zone);
      if (repeat && !at) {
        await write({ next: next(now) });
        report.scheduled += 1;
        continue;
      }
      if (!at || at > now) continue;
      if (repeat && now.getTime() - at.getTime() > STALE_MS) {
        await write({ next: next(now) });
        report.skipped += 1;
        continue;
      }
      let reached = false;
      for (const person of row.persons) {
        reached =
          (await tell({
            person,
            spaceId: row.space_id,
            entryId: row.entry_id,
            title: entry.title,
            message: typeof entry.data.message === 'string' ? entry.data.message : null,
            at,
            repeated: repeat !== null,
          })) || reached;
      }
      const sentAt = now.toISOString();
      await write(
        repeat
          ? { next: next(now), last_sent: sentAt }
          : { status: reached ? 'sent' : 'failed', last_sent: sentAt },
      );
      if (reached) report.sent += 1;
      else report.failed += 1;
    } catch (error) {
      // A reminder she wrote wrong says so in its own fields, once, and stops.
      await write({ status: 'to_fix', error: (error as Error).message }).catch(() => undefined);
      report.failed += 1;
    }
  }
  return report;
}
