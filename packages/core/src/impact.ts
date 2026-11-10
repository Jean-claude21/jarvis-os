import { agenda, type Occurrence } from './agenda';
import type { Actor, Tx } from './db';
import { get, save } from './entries';
import type { EntryInput } from './schemas';
import { inZone } from './time';
import { zoneOf } from './zone';

// « What it changes » (spec 044, plan v2 C10), computed by Jarvis without any AI at each change:
// what a time collides with (an appointment, a block, a routine), the deadlines it threatens, the
// reminders to move, the people concerned, the free slots around. And an absence (« je pars du 12
// au 20 ») replanned at once: proposed first, applied in one step, undone at once.

const MINUTE = 60_000;
const DAY = 86_400_000;

export interface Impact {
  from: string;
  to: string;
  conflicts: (Pick<Occurrence, 'id' | 'kind' | 'title' | 'start' | 'end' | 'repeated' | 'day'> & {
    space: string;
  })[];
  /** Deadlines inside, or within two days after. */
  deadlines: Pick<Occurrence, 'id' | 'kind' | 'title' | 'start'>[];
  /** Reminders that fall inside. */
  reminders: Pick<Occurrence, 'id' | 'title' | 'start'>[];
  /** People linked to what collides. */
  people: { id: string; title: string }[];
  /** Free slots of the same day(s), 08:00–20:00 on her clock, at least as long as the change. */
  free: { start: string; end: string }[];
}

const localParts = (at: Date, zone: string) => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    .format(at)
    .split('-')
    .map(Number) as [number, number, number];
  return { year, month, day };
};

/** What [from, to) collides with and threatens in her spaces; `except` is the thing itself. */
export async function impactOf(
  tx: Tx,
  spaceIds: string[],
  window: { from: Date; to: Date; except?: string },
): Promise<Impact> {
  const { from, to } = window;
  const zone = await zoneOf(tx);
  const around = await agenda(tx, spaceIds, {
    from: new Date(from.getTime() - DAY),
    to: new Date(to.getTime() + 3 * DAY),
    today: from,
  });
  const others = around.filter(
    (one) => one.id !== window.except && !['done', 'cancelled'].includes(String(one.status)),
  );
  const overlaps = (one: Occurrence) => {
    const start = new Date(one.start);
    const end = one.end ? new Date(one.end) : start;
    return one.end ? start < to && end > from : start >= from && start < to;
  };
  const conflicts = others.filter(
    (one) =>
      (one.type === 'span' || one.type === 'moment') &&
      !/^reminder$/i.test(one.kind) &&
      overlaps(one),
  );
  const deadlines = others.filter(
    (one) =>
      one.type === 'deadline' &&
      new Date(one.start) >= from &&
      new Date(one.start) < new Date(to.getTime() + 2 * DAY),
  );
  const reminders = others.filter((one) => /^reminder$/i.test(one.kind) && overlaps(one));

  const people = new Map<string, string>();
  for (const one of conflicts) {
    const entry = await get(tx, one.spaceId, one.id);
    for (const link of [...(entry?.links.out ?? []), ...(entry?.links.in ?? [])]) {
      if (/^person$/i.test(link.entry.kind)) people.set(link.entry.id, link.entry.title);
    }
  }

  // Free slots, for a change within one day: the gaps of 08:00–20:00 at least as long as it.
  const free: Impact['free'] = [];
  const length = to.getTime() - from.getTime();
  if (length > 0 && length <= DAY) {
    const day = localParts(from, zone);
    const open = inZone({ ...day, hour: 8, minute: 0 }, zone).getTime();
    const close = inZone({ ...day, hour: 20, minute: 0 }, zone).getTime();
    const busy = others
      .filter((one) => one.end && (one.type === 'span' || one.type === 'moment') && !one.allDay)
      .map((one) => [new Date(one.start).getTime(), new Date(one.end!).getTime()] as const)
      .filter(([start, end]) => end > open && start < close)
      .sort((a, b) => a[0] - b[0]);
    let cursor = open;
    for (const [start, end] of [...busy, [close, close] as const]) {
      if (start - cursor >= length) {
        free.push({
          start: new Date(cursor).toISOString(),
          end: new Date(start).toISOString(),
        });
      }
      cursor = Math.max(cursor, end);
    }
  }

  const pick = <T extends Occurrence>(one: T) => ({
    id: one.id,
    kind: one.kind,
    title: one.title,
    start: one.start,
    end: one.end,
    repeated: one.repeated,
    space: one.space,
    ...(one.day ? { day: one.day } : {}),
  });
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    conflicts: conflicts.map(pick),
    deadlines: deadlines.map((one) => ({
      id: one.id,
      kind: one.kind,
      title: one.title,
      start: one.start,
    })),
    reminders: reminders.map((one) => ({ id: one.id, title: one.title, start: one.start })),
    people: [...people].map(([id, title]) => ({ id, title })),
    free: free.slice(0, 6),
  };
}

export interface Replan {
  impact: Impact;
  /** What Jarvis proposes, in the engine's words; nothing changed until she says yes. */
  steps: {
    id: string;
    title: string;
    does: 'skip' | 'to_reschedule' | 'due_before' | 'remind_after';
    to?: string;
  }[];
}

/**
 * An absence replanned at once (« je pars du 12 au 20 »): a repetition's occurrences inside are
 * skipped, an appointment inside is to reschedule, a deadline inside comes the day before she
 * leaves, a reminder inside comes the morning she is back. `dryRun` (default) proposes only;
 * applied, it is one save in one space — undone at once.
 */
export async function replan(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  window: { from: Date; to: Date },
  dryRun = true,
): Promise<Replan & { applied: boolean }> {
  const zone = await zoneOf(tx);
  const impact = await impactOf(tx, [spaceId], window);
  const day = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(at);
  const before = day(new Date(window.from.getTime() - DAY));
  const back = `${day(window.to)}T09:00`;
  const steps: Replan['steps'] = [];
  const byEntry = new Map<string, Record<string, unknown>>();
  for (const one of impact.conflicts) {
    if (one.repeated && one.day) {
      steps.push({ id: one.id, title: one.title, does: 'skip', to: one.day });
      const entry = byEntry.get(one.id) ?? {};
      const known =
        (entry.occurrences as Record<string, unknown> | undefined) ??
        ((await get(tx, spaceId, one.id))?.data.occurrences as
          Record<string, unknown> | undefined) ??
        {};
      byEntry.set(one.id, { occurrences: { ...known, [one.day]: { status: 'cancelled' } } });
    } else if (!one.repeated) {
      steps.push({ id: one.id, title: one.title, does: 'to_reschedule' });
      byEntry.set(one.id, { status: 'to_reschedule' });
    }
  }
  for (const one of impact.deadlines) {
    if (new Date(one.start) >= window.to) continue;
    steps.push({ id: one.id, title: one.title, does: 'due_before', to: before });
    byEntry.set(one.id, { due: before });
  }
  for (const one of impact.reminders) {
    // A reminder attached to a thing (spec 037) follows it: never moved on its own.
    if (typeof (await get(tx, spaceId, one.id))?.data.before === 'string') continue;
    steps.push({ id: one.id, title: one.title, does: 'remind_after', to: back });
    byEntry.set(one.id, { at: back, status: 'planned' });
  }
  if (dryRun || !byEntry.size) return { impact, steps, applied: false };
  const entries: EntryInput[] = [...byEntry].map(([id, data]) => ({
    id,
    data,
    origin: 'inferred',
  }));
  await save(tx, actor, spaceId, { entries });
  return { impact, steps, applied: true };
}

/** The window an entry takes: its start and end (or duration), else its moment, at her clock. */
export function windowOf(
  data: Record<string, unknown>,
  zone: string,
): { from: Date; to: Date } | null {
  const at =
    typeof data.start === 'string' ? data.start : typeof data.at === 'string' ? data.at : null;
  if (!at || typeof data.repeat === 'string') return null;
  const parse = (text: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(text.trim());
    if (!match) return null;
    return inZone(
      {
        year: +match[1]!,
        month: +match[2]!,
        day: +match[3]!,
        hour: +(match[4] ?? 0),
        minute: +(match[5] ?? 0),
      },
      zone,
    );
  };
  const from = parse(at);
  if (!from) return null;
  const end = typeof data.end === 'string' ? parse(data.end) : null;
  const minutes = Number(data.duration) || 60;
  return { from, to: end && end > from ? end : new Date(from.getTime() + minutes * MINUTE) };
}
