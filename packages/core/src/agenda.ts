import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { Actor, Tx } from './db';
import { find, get, save } from './entries';
import { DEFAULT_ZONE, inZone, minutesOf, nextTime, TIME_FIELDS, timeOf } from './time';
import { zoneOf } from './zone';

export { minutesOf, TIME_FIELDS } from './time';

// The calendar (spec 011): time is a property any entry may carry, not a kind. The calendar of a
// window is computed from the entries that have one — `start` (and `end` or `duration`), `at`,
// `due`, `date`, `repeat` — never stored twice.

/** One thing at its place in time. */
export interface Occurrence {
  id: string;
  kind: string;
  title: string;
  space: string;
  spaceId: string;
  /** ISO instant; a whole day starts at midnight on her clock. */
  start: string;
  /** ISO instant, or null for a moment, a deadline or a day without an end. */
  end: string | null;
  allDay: boolean;
  /** A span (`start`), a moment (`at`, `repeat`), a deadline (`due`), a day (`date`). */
  type: 'span' | 'moment' | 'deadline' | 'day';
  repeated: boolean;
  /** Of a repetition: the day it falls on, on her clock — how she names one occurrence. */
  day?: string;
  /** Of a repetition: moved from its day (« reporté »). */
  moved?: boolean;
  status: string | null;
  /** For whom (spec 038): a member of its space, or nobody in particular. */
  who: string | null;
  /** Jarvis proposed it; she has not accepted it yet. */
  proposed: boolean;
}

/** A window is at most a year; a repetition gives at most this many occurrences in one view. */
export const AGENDA_MAX_DAYS = 366;
export const AGENDA_MAX_REPEATS = 200;

const CANCELLED = new Set(['cancelled']);
const PROPOSED = new Set(['proposed']);
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE = 60_000;

/** Midnight of a day she wrote, on her clock. */
function dayStart(text: string, zone: string): Date {
  const [year, month, day] = text.split('-').map(Number) as [number, number, number];
  return inZone({ year, month, day, hour: 0, minute: 0 }, zone);
}

/** A time she wrote: a date alone is the whole day (unlike a reminder's 09:00). */
function placed(text: unknown, zone: string): { at: Date; allDay: boolean } | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (DAY_ONLY.test(trimmed)) return { at: dayStart(trimmed, zone), allDay: true };
  const at = timeOf(trimmed, zone);
  return at ? { at, allDay: false } : null;
}

interface Row {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  space: string;
  space_id: string;
}

/** The states one occurrence of a repetition can have. */
export const OCCURRENCE_STATES = ['done', 'missed', 'postponed', 'cancelled'] as const;
export type OccurrenceState = (typeof OCCURRENCE_STATES)[number];

/** What she changed of single occurrences: by their day, a state and a new time. */
function occurrenceChanges(raw: unknown): Map<string, { status?: OccurrenceState; at?: string }> {
  const out = new Map<string, { status?: OccurrenceState; at?: string }>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAY_ONLY.test(day) || !value || typeof value !== 'object') continue;
    const one = value as { status?: unknown; at?: unknown };
    const status = OCCURRENCE_STATES.find((state) => state === one.status);
    out.set(day, {
      ...(status ? { status } : {}),
      ...(typeof one.at === 'string' && one.at.trim() ? { at: one.at.trim() } : {}),
    });
  }
  return out;
}

/** The occurrences of one entry in [from, to). */
export function occurrencesOf(
  row: Row,
  from: Date,
  to: Date,
  today: Date,
  herZone = DEFAULT_ZONE,
): Occurrence[] {
  const data = row.data;
  const status = typeof data.status === 'string' ? data.status : null;
  if (status && CANCELLED.has(status.toLowerCase())) return [];
  const zone = typeof data.timezone === 'string' && data.timezone ? data.timezone : herZone;
  const base = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    space: row.space,
    spaceId: row.space_id,
    status,
    who: typeof data.who === 'string' && data.who ? data.who : null,
    proposed: status !== null && PROPOSED.has(status.toLowerCase()),
  };
  const inside = (at: Date, end: Date | null) =>
    end ? at < to && end > from : at >= from && at < to;
  const out: Occurrence[] = [];

  if (typeof data.repeat === 'string' && data.repeat.trim()) {
    const minutes = minutesOf(data.duration);
    const skipped = new Set(
      (Array.isArray(data.except)
        ? data.except
        : typeof data.except === 'string'
          ? [data.except]
          : []
      )
        .filter((one): one is string => typeof one === 'string')
        .map((one) => one.trim().slice(0, 10)),
    );
    const localDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(at);
    // One occurrence she changed (spec 036): its state (done, missed, postponed, cancelled), and a
    // new time when she moved it; the others follow the repetition.
    const changed = occurrenceChanges(data.occurrences);
    // A repetition starts where it says it starts (`start`), else it always was.
    const begins = placed(data.start, zone)?.at;
    let ends = placed(data.until, zone)?.at;
    // So many times (`count`), from its start: the last one ends it.
    const count = Number(data.count);
    if (begins && Number.isInteger(count) && count > 0) {
      let at = new Date(begins.getTime() - 1);
      try {
        for (let n = 0; n < Math.min(count, 1000); n += 1) at = nextTime(data.repeat, at, zone);
        if (!ends || at < ends) ends = at;
      } catch {
        // Said below, as any repetition she must correct.
      }
    }
    const push = (at: Date, day: string, moved: boolean) => {
      const one = changed.get(day);
      const end = minutes ? new Date(at.getTime() + minutes * MINUTE) : null;
      if (!inside(at, end)) return;
      out.push({
        ...base,
        status: one?.status ?? base.status,
        start: at.toISOString(),
        end: end?.toISOString() ?? null,
        allDay: false,
        type: end ? 'span' : 'moment',
        repeated: true,
        day,
        ...(moved ? { moved: true } : {}),
      });
    };
    let cursor = new Date(
      Math.max(from.getTime() - (minutes ?? 0) * MINUTE, begins?.getTime() ?? 0) - 1,
    );
    try {
      for (let n = 0; n < AGENDA_MAX_REPEATS; n += 1) {
        const at = nextTime(data.repeat, cursor, zone);
        if (at >= to || (ends && at > ends)) break;
        cursor = at;
        const day = localDay(at);
        const one = changed.get(day);
        if (skipped.has(day) || one?.status === 'cancelled') continue;
        const moved = one?.at ? timeOf(one.at, zone) : null;
        // Moved: shown at its new time, where that falls (below, if outside this window's days).
        if (moved) continue;
        push(at, day, false);
      }
    } catch {
      // A repetition she must correct (the watcher says so); it has no place in time yet.
    }
    for (const [day, one] of changed) {
      if (!one.at || one.status === 'cancelled' || skipped.has(day)) continue;
      const moved = timeOf(one.at, zone);
      if (moved) push(moved, day, true);
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }

  const span = placed(data.start, zone);
  if (span) {
    const given = placed(data.end, zone);
    const minutes = minutesOf(data.duration);
    let end = given
      ? given.allDay
        ? new Date(given.at.getTime() + 24 * 60 * MINUTE)
        : given.at
      : minutes
        ? new Date(span.at.getTime() + minutes * MINUTE)
        : span.allDay
          ? new Date(span.at.getTime() + 24 * 60 * MINUTE)
          : null;
    if (end && end <= span.at) end = null;
    if (inside(span.at, end)) {
      out.push({
        ...base,
        start: span.at.toISOString(),
        end: end?.toISOString() ?? null,
        allDay: span.allDay,
        type: 'span',
        repeated: false,
      });
    }
    return out;
  }

  for (const [field, type] of [
    ['at', 'moment'],
    ['due', 'deadline'],
    ['date', 'day'],
  ] as const) {
    const one = placed(data[field], zone);
    if (!one) continue;
    // A day that has passed is history (her journal), not her calendar.
    if (field === 'date' && one.at < dayStart(today.toISOString().slice(0, 10), zone)) continue;
    const end = one.allDay ? new Date(one.at.getTime() + 24 * 60 * MINUTE) : null;
    if (inside(one.at, end)) {
      out.push({
        ...base,
        start: one.at.toISOString(),
        end: end?.toISOString() ?? null,
        allDay: one.allDay,
        type,
        repeated: false,
      });
    }
    return out;
  }
  return out;
}

/**
 * The calendar of [from, to) in the given spaces: every entry with a time, at its place, sorted.
 * `today` decides what a past `date` is (her journal is not her calendar).
 */
export async function agenda(
  tx: Tx,
  spaceIds: string[],
  window: { from: Date; to: Date; today?: Date; zone?: string },
): Promise<Occurrence[]> {
  const { from, to } = window;
  if (!(to > from)) throw new Error('The end of the window must come after its start.');
  if (to.getTime() - from.getTime() > AGENDA_MAX_DAYS * 24 * 60 * MINUTE) {
    throw new Error(`A calendar covers at most ${AGENDA_MAX_DAYS} days.`);
  }
  const { rows } = await tx.query<Row>(
    `select e.id, e.kind, e.title, e.data, s.name as space, e.space_id
       from entry e join space s on s.id = e.space_id
      where e.space_id = any($1) and e.archived_at is null
        and e.data ?| $2::text[]`,
    [spaceIds, TIME_FIELDS],
  );
  const today = window.today ?? new Date();
  const zone = window.zone ?? (await zoneOf(tx));
  return rows
    .flatMap((row) => occurrencesOf(row, from, to, today, zone))
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** The fingerprint kept for a subscription key: the key itself is never stored. */
export const fingerprintOf = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * A new private address key for her phone's calendar (spec 011), kept as a fingerprint in her
 * « Channel » entry of her own space; the previous key answers nothing any more.
 */
export async function renewCalendarKey(tx: Tx, actor: Actor, ownSpaceId: string): Promise<string> {
  const key = randomBytes(24).toString('base64url');
  const [canal] = await find(tx, ownSpaceId, { kind: 'Channel', limit: 1 });
  await save(tx, actor, ownSpaceId, {
    entries: [
      canal
        ? { id: canal.id, data: { agenda: fingerprintOf(key) }, origin: 'inferred' }
        : {
            kind: 'Channel',
            title: 'Canaux',
            data: { agenda: fingerprintOf(key) },
            origin: 'inferred',
          },
    ],
  });
  return key;
}

/** Whose calendar a key opens, or null: read past row-level security, nothing else. */
export async function calendarOwner(db: pg.Pool, key: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(key)) return null;
  const { rows } = await db.query<{ owner: string | null }>(
    'select jarvis_calendar_owner($1) as owner',
    [fingerprintOf(key)],
  );
  return rows[0]?.owner ?? null;
}

/**
 * One occurrence of a repetition changed (spec 036): done, missed, postponed (to a new time) or
 * cancelled — the others stay as they are. `null` puts it back as the repetition says. One save:
 * journaled, undone at once.
 */
export async function setOccurrence(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  day: string,
  change: { status?: OccurrenceState | null; at?: string | null } | null,
) {
  if (!DAY_ONLY.test(day)) throw new Error(`« ${day} » is not a day (2026-11-12).`);
  const entry = await get(tx, spaceId, id);
  if (!entry) throw new Error(`No entry ${id} in this space.`);
  const repeat = entry.data.repeat;
  if (typeof repeat !== 'string' || !repeat.trim()) {
    throw new Error(`« ${entry.title} » does not repeat: change it as a whole.`);
  }
  const zone =
    typeof entry.data.timezone === 'string' && entry.data.timezone
      ? entry.data.timezone
      : await zoneOf(tx);
  const from = dayStart(day, zone);
  const to = new Date(from.getTime() + 24 * 60 * MINUTE);
  const row = {
    id,
    kind: entry.kind,
    title: entry.title,
    data: { ...entry.data, occurrences: {} },
    space: '',
    space_id: spaceId,
  };
  if (!occurrencesOf(row, from, to, from, zone).length) {
    throw new Error(`« ${entry.title} » has no occurrence on ${day}.`);
  }
  if (change?.at && !timeOf(change.at, zone)) {
    throw new Error(`« ${change.at} » is not a time (2026-11-13T18:00).`);
  }
  const all = { ...((entry.data.occurrences as Record<string, unknown> | undefined) ?? {}) };
  const next: Record<string, unknown> = {};
  if (change?.status) next.status = change.status;
  if (change?.at) next.at = change.at;
  if (change?.at && !change.status) next.status = 'postponed';
  if (Object.keys(next).length) all[day] = next;
  else delete all[day];
  return save(tx, actor, spaceId, { entries: [{ id, data: { occurrences: all } }] });
}
