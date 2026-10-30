import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { DEFAULT_ZONE, inZone, nextTime, timeOf } from './time';

// The calendar (spec 011): time is a property any entry may carry, not a kind. The calendar of a
// window is computed from the entries that have one — `debut` (and `fin` or `duree`), `quand`,
// `echeance`, `date`, `repete` — never stored twice.

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
  /** A span (`debut`), a moment (`quand`, `repete`), a deadline (`echeance`), a day (`date`). */
  type: 'span' | 'moment' | 'deadline' | 'day';
  repeated: boolean;
  status: string | null;
  /** Jarvis proposed it; she has not accepted it yet. */
  proposed: boolean;
}

/** The fields that put an entry in time. */
export const TIME_FIELDS = ['debut', 'quand', 'repete', 'echeance', 'date'] as const;

/** A window is at most a year; a repetition gives at most this many occurrences in one view. */
export const AGENDA_MAX_DAYS = 366;
export const AGENDA_MAX_REPEATS = 200;

const CANCELLED = new Set(['annulé', 'annule']);
const PROPOSED = new Set(['proposé', 'propose']);
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

/** Minutes she gave as `duree`: a number, or « 90 », « 1h30 », « 45 min ». */
export function minutesOf(value: unknown): number | null {
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  const hm = /^(\d+)\s*h\s*(\d+)?\s*(?:min)?$/.exec(text);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = /^(\d+)\s*(?:min|mn|m)?$/.exec(text);
  return m ? Number(m[1]) : null;
}

interface Row {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  space: string;
  space_id: string;
}

/** The occurrences of one entry in [from, to). */
export function occurrencesOf(row: Row, from: Date, to: Date, today: Date): Occurrence[] {
  const data = row.data;
  const status = typeof data.statut === 'string' ? data.statut : null;
  if (status && CANCELLED.has(status.toLowerCase())) return [];
  const zone = typeof data.fuseau === 'string' && data.fuseau ? data.fuseau : DEFAULT_ZONE;
  const base = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    space: row.space,
    spaceId: row.space_id,
    status,
    proposed: status !== null && PROPOSED.has(status.toLowerCase()),
  };
  const inside = (at: Date, end: Date | null) =>
    end ? at < to && end > from : at >= from && at < to;
  const out: Occurrence[] = [];

  if (typeof data.repete === 'string' && data.repete.trim()) {
    const minutes = minutesOf(data.duree);
    const skipped = new Set(
      (Array.isArray(data.sauf) ? data.sauf : typeof data.sauf === 'string' ? [data.sauf] : [])
        .filter((one): one is string => typeof one === 'string')
        .map((one) => one.trim().slice(0, 10)),
    );
    const localDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(at);
    // A repetition starts where it says it starts (`debut`), else it always was.
    const begins = placed(data.debut, zone)?.at;
    const ends = placed(data.jusqu ?? data.fin_repetition, zone)?.at;
    let cursor = new Date(
      Math.max(from.getTime() - (minutes ?? 0) * MINUTE, begins?.getTime() ?? 0) - 1,
    );
    try {
      for (let n = 0; n < AGENDA_MAX_REPEATS; n += 1) {
        const at = nextTime(data.repete, cursor, zone);
        if (at >= to || (ends && at > ends)) break;
        cursor = at;
        if (skipped.has(localDay(at))) continue;
        const end = minutes ? new Date(at.getTime() + minutes * MINUTE) : null;
        if (!inside(at, end)) continue;
        out.push({
          ...base,
          start: at.toISOString(),
          end: end?.toISOString() ?? null,
          allDay: false,
          type: end ? 'span' : 'moment',
          repeated: true,
        });
      }
    } catch {
      // A repetition she must correct (the watcher says so); it has no place in time yet.
    }
    return out;
  }

  const span = placed(data.debut, zone);
  if (span) {
    const given = placed(data.fin, zone);
    const minutes = minutesOf(data.duree);
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
    ['quand', 'moment'],
    ['echeance', 'deadline'],
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
  window: { from: Date; to: Date; today?: Date },
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
  return rows
    .flatMap((row) => occurrencesOf(row, from, to, today))
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

/** The fingerprint kept for a subscription key: the key itself is never stored. */
export const fingerprintOf = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * A new private address key for her phone's calendar (spec 011), kept as a fingerprint in her
 * « Canal » entry of her own space; the previous key answers nothing any more.
 */
export async function renewCalendarKey(tx: Tx, actor: Actor, ownSpaceId: string): Promise<string> {
  const key = randomBytes(24).toString('base64url');
  const [canal] = await find(tx, ownSpaceId, { kind: 'Canal', limit: 1 });
  await save(tx, actor, ownSpaceId, {
    entries: [
      canal
        ? { id: canal.id, data: { agenda: fingerprintOf(key) }, origin: 'inferred' }
        : {
            kind: 'Canal',
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
