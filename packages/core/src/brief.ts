import type pg from 'pg';
import { attention, type AttentionItem } from './attention';
import type { Occurrence } from './agenda';
import { asPerson, type Actor, type Tx } from './db';
import { find, save } from './entries';
import { listStats } from './lists';
import { preferencesOf } from './prefs';
import { spacesOf } from './spaces';
import { zoneOf } from './zone';

// The morning brief (spec 018): at the hour she chose, the watcher tells her her day — what went
// wrong, what is late, her calendar of today, the habits still to do — read from what she keeps,
// in every space she is part of. Sent once a day; a brief missed by more than three hours waits
// for the next morning rather than arriving at night.

export interface Brief {
  /** Today on her clock, « 2026-10-31 ». */
  day: string;
  zone: string;
  fix: AttentionItem[];
  late: AttentionItem[];
  /** Her calendar of today, everything. */
  agenda: Occurrence[];
  /** Habits planned today: done already, or still to do; with their rate on thirty days. */
  habits: { title: string; space: string; today: 'done' | 'todo'; rate30: number | null }[];
}

const LATE_MS = 3 * 3_600_000;

/** « 2026-10-31 » and « 07:05 » of `now` on her clock. */
export function localOf(now: Date, zone: string): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  return {
    day: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** True when the brief is due: past her hour today, not sent today, not three hours late. */
export function briefDue(at: string, lastSent: string | null, now: Date, zone: string): boolean {
  const local = localOf(now, zone);
  if (lastSent === local.day) return false;
  const late = (minutes(local.time) - minutes(at)) * 60_000;
  return late >= 0 && late <= LATE_MS;
}

/** Her day, as the brief tells it. */
export async function morningBrief(tx: Tx, now = new Date()): Promise<Brief> {
  const zone = await zoneOf(tx);
  const spaces = await spacesOf(tx);
  const seen = await attention(
    tx,
    spaces.map((one) => one.id),
    now,
    zone,
  );
  const clock = { now, zone };
  const habits: Brief['habits'] = [];
  for (const space of spaces) {
    // The kinds that hold habits: entries that say their days.
    const { rows } = await tx.query<{ kind: string }>(
      `select distinct kind from entry
        where space_id = $1 and archived_at is null and (data ? 'days' or data ? 'jours' or data ? 'cadence')`,
      [space.id],
    );
    for (const { kind } of rows) {
      const stats = await listStats(tx, space.id, { kind }, clock);
      for (const habit of stats.habits)
        if (habit.today)
          habits.push({
            title: habit.title,
            space: space.name,
            today: habit.today,
            rate30: habit.rate30,
          });
    }
  }
  return {
    day: localOf(now, zone).day,
    zone,
    fix: seen.items.filter((one) => one.group === 'fix'),
    late: seen.items.filter((one) => one.group === 'late'),
    agenda: seen.day,
    habits: habits.sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** The people who asked for a brief and have where to be told. */
export async function briefPeople(db: pg.Pool): Promise<string[]> {
  const { rows } = await db.query<{ person: string }>('select person from jarvis_brief_people()');
  return rows.map((row) => row.person);
}

/**
 * One person's brief, if it is due: composed, told through `tell` (true when she was reached),
 * then marked as sent today in her « Channel ». Null when nothing was due.
 */
export async function briefOnce(
  db: pg.Pool,
  person: string,
  now: Date,
  tell: (brief: Brief) => Promise<boolean>,
): Promise<boolean | null> {
  const due = await asPerson(db, person, async (tx) => {
    const own = (await spacesOf(tx)).find((one) => one.personal);
    if (!own) return null;
    const [channel] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
    const at = (await preferencesOf(tx)).brief;
    if (!channel || !at) return null;
    const zone = await zoneOf(tx);
    const last = typeof channel.data.brief_sent === 'string' ? channel.data.brief_sent : null;
    if (!briefDue(at, last, now, zone)) return null;
    return { space: own.id, channel: channel.id, brief: await morningBrief(tx, now) };
  });
  if (!due) return null;
  const reached = await tell(due.brief);
  const actor: Actor = { person, door: 'watcher' };
  // Marked even when she was not reached: one try a morning, never a flood.
  await asPerson(db, person, (tx) =>
    save(tx, actor, due.space, {
      entries: [{ id: due.channel, data: { brief_sent: due.brief.day }, origin: 'inferred' }],
    }),
  );
  return reached;
}
