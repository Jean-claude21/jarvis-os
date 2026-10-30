// Time as she lives it (spec 006): a wall-clock time in her zone, and repetitions written as five
// fields — minute, hour, day of the month, month, day of the week — like « 45 20 * * 0-5 » (20:45
// every day but Saturday) or « 30 19 L * * » (19:30 on the last day of each month).

/** Her zone when she gave none. */
export const DEFAULT_ZONE = 'Europe/Paris';

/** The wall clock in `zone` at an instant. */
function wall(at: Date, zone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday!),
  };
}

/** The instant when the clock in `zone` shows this date and time. */
export function inZone(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  zone: string,
): Date {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let at = asUtc;
  // Twice: the offset at the guess may differ from the offset at the answer around a change of hour.
  for (let i = 0; i < 2; i += 1) {
    const seen = wall(new Date(at), zone);
    const shown = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    at += asUtc - shown;
  }
  return new Date(at);
}

/**
 * A time she wrote: with an offset or `Z`, as it says; « 2026-11-03T09:00 », on her clock; a day
 * alone, at nine in the morning. Null when it is not a time.
 */
export function timeOf(text: unknown, zone = DEFAULT_ZONE): Date | null {
  if (typeof text !== 'string') return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(
      text.trim(),
    );
  if (!match) return null;
  if (match[6]) return new Date(text.trim());
  const [, year, month, day, hour = '09', minute = '00'] = match;
  return inZone(
    {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
    },
    zone,
  );
}

const RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const;

/** The values a field allows: `*`, `5`, `1-5`, `1,15`, `*\/10`, `L` (the last day of the month). */
function field(text: string, index: number): { values: Set<number>; last: boolean } {
  const [low, high] = RANGES[index]!;
  const values = new Set<number>();
  let last = false;
  for (const part of text.split(',')) {
    if (index === 2 && part.toUpperCase() === 'L') {
      last = true;
      continue;
    }
    const match = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(part);
    if (!match) throw new Error(`« ${text} » is not a repetition field.`);
    const from = match[1] === '*' ? low : Number(match[1]);
    const to =
      match[2] !== undefined ? Number(match[2]) : match[1] === '*' || match[3] ? high : from;
    const step = Number(match[3] ?? 1);
    if (from < low || to > high || from > to || step < 1) {
      throw new Error(`« ${text} » is out of range (${low}-${high}).`);
    }
    for (let value = from; value <= to; value += step)
      values.add(index === 4 && value === 7 ? 0 : value);
  }
  return { values, last };
}

/** Reads « 45 20 * * 0-5 »; throws a sentence she can act on when it is not one. */
export function repetitionOf(text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `« ${text} » is not a repetition: five fields, minute hour day month weekday (« 45 20 * * 0-5 »).`,
    );
  }
  const [minute, hour, day, month, weekday] = parts.map((part, index) => field(part, index));
  return {
    minute: minute!,
    hour: hour!,
    day: day!,
    month: month!,
    weekday: weekday!,
    anyDay: parts[2] === '*',
    anyWeekday: parts[4] === '*',
  };
}

/** The next time after `after` that a repetition names, on the clock of `zone`. */
export function nextTime(repete: string, after: Date, zone = DEFAULT_ZONE): Date {
  const rule = repetitionOf(repete);
  const start = wall(after, zone);
  const hours = [...rule.hour.values].sort((a, b) => a - b);
  const minutes = [...rule.minute.values].sort((a, b) => a - b);
  for (let offset = 0; offset < 800; offset += 1) {
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (!rule.month.values.has(month)) continue;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const byDay = rule.day.values.has(day) || (rule.day.last && day === lastDay);
    const byWeekday = rule.weekday.values.has(date.getUTCDay());
    // As cron: when both are given, either matches; when one is « * », the other decides.
    const matches = rule.anyDay ? byWeekday : rule.anyWeekday ? byDay : byDay || byWeekday;
    if (!matches) continue;
    for (const hour of hours) {
      for (const minute of minutes) {
        const at = inZone({ year, month, day, hour, minute }, zone);
        if (at > after) return at;
      }
    }
  }
  throw new Error(`« ${repete} » names no time in the next two years.`);
}

/** The fields that put an entry in time. */
export const TIME_FIELDS = ['debut', 'quand', 'repete', 'echeance', 'date'] as const;

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
