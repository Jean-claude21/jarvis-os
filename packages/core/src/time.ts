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

/**
 * The values a field allows: `*`, `5`, `1-5`, `1,15`, `*\/10`, `L` (the last day of the month);
 * for the weekday, `1#2` (the second Monday of the month) and `5#L` (its last Friday).
 */
function field(
  text: string,
  index: number,
): { values: Set<number>; last: boolean; nth: Map<number, Set<number>> } {
  const [low, high] = RANGES[index]!;
  const values = new Set<number>();
  const nth = new Map<number, Set<number>>();
  let last = false;
  for (const part of text.split(',')) {
    if (index === 2 && part.toUpperCase() === 'L') {
      last = true;
      continue;
    }
    const ordinal = index === 4 ? /^([0-7])#([1-5]|L)$/i.exec(part) : null;
    if (ordinal) {
      const weekday = Number(ordinal[1]) % 7;
      const which = ordinal[2]!.toUpperCase() === 'L' ? -1 : Number(ordinal[2]);
      nth.set(weekday, (nth.get(weekday) ?? new Set()).add(which));
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
  return { values, last, nth };
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
export function nextTime(repeat: string, after: Date, zone = DEFAULT_ZONE): Date {
  const rule = repetitionOf(repeat);
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
    const weekday = date.getUTCDay();
    const which = rule.weekday.nth.get(weekday);
    const byWeekday =
      rule.weekday.values.has(weekday) ||
      (which !== undefined &&
        (which.has(Math.ceil(day / 7)) || (which.has(-1) && day + 7 > lastDay)));
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
  throw new Error(`« ${repeat} » names no time in the next two years.`);
}

/** The fields that put an entry in time. */
export const TIME_FIELDS = ['start', 'at', 'repeat', 'due', 'date'] as const;

/** Minutes she gave as `duration`: a number, or « 90 », « 1h30 », « 45 min ». */
export function minutesOf(value: unknown): number | null {
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  const hm = /^(\d+)\s*h\s*(\d+)?\s*(?:min)?$/.exec(text);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = /^(\d+)\s*(?:min|mn|m)?$/.exec(text);
  return m ? Number(m[1]) : null;
}

const DAY_WORDS: [RegExp, number][] = [
  [/^(lun|mon)/, 1],
  [/^(mar|tue)/, 2],
  [/^(mer|wed)/, 3],
  [/^(jeu|thu)/, 4],
  [/^(ven|fri)/, 5],
  [/^(sam|sat)/, 6],
  [/^(dim|sun)/, 0],
];
const ORDINALS: Record<string, string> = {
  premier: '1',
  '1er': '1',
  first: '1',
  deuxieme: '2',
  second: '2',
  '2e': '2',
  troisieme: '3',
  third: '3',
  '3e': '3',
  quatrieme: '4',
  fourth: '4',
  '4e': '4',
  dernier: 'L',
  last: 'L',
};

/**
 * A repetition said in her words, as the five fields Jarvis keeps (spec 036): « tous les jours à
 * 20h45 », « chaque lundi et jeudi à 7h », « le 2e lundi du mois à 18h », « le dernier vendredi »,
 * « tous les mois le 5 », « en semaine à 6h30 ». Null when it is already fields, or says none.
 */
export function repetitionFromWords(text: string): string | null {
  const said = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').trim();
  if (!said || /^[\d*,/#L-]+(\s+[\d*,/#L-]+){4}$/i.test(text.trim())) return null;
  const clock = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?|(\d{1,2})\s*(am|pm)/.exec(said);
  let hour = 9;
  let minute = 0;
  if (clock) {
    hour = Number(clock[1] ?? clock[3]);
    minute = Number(clock[2] ?? 0);
    if (clock[4] === 'pm' && hour < 12) hour += 12;
    if (hour > 23 || minute > 59) return null;
  }
  const words = said.split(/[^a-z0-9]+/).filter(Boolean);
  const days = [
    ...new Set(
      words.flatMap((word) =>
        word.length >= 3 && word !== 'mars'
          ? DAY_WORDS.filter(([re]) => re.test(word)).map(([, n]) => n)
          : [],
      ),
    ),
  ];
  const ordinal = words.map((word) => ORDINALS[word]).find(Boolean);
  const at = `${minute} ${hour}`;
  if (ordinal && days.length === 1) return `${at} * * ${days[0]}#${ordinal}`;
  if (/\b(mois|month|mensuel|monthly)\b/.test(said)) {
    if (/\b(dernier jour|last day)\b/.test(said)) return `${at} L * *`;
    const monthDay =
      /\b(?:le|the|on the)\s+(\d{1,2})(?:er|e|st|nd|rd|th)?\b(?!\s*(?:h|:|am|pm))/.exec(said);
    if (monthDay && Number(monthDay[1]) >= 1 && Number(monthDay[1]) <= 31) {
      return `${at} ${Number(monthDay[1])} * *`;
    }
  }
  if (/\b(en semaine|jours ouvres|weekdays?)\b/.test(said)) return `${at} * * 1-5`;
  if (/\b(week-?ends?)\b/.test(said)) return `${at} * * 0,6`;
  if (
    /\b(tous les jours|chaque jour|quotidien|every day|daily|tous les (soirs|matins)|chaque (soir|matin))\b/.test(
      said,
    )
  ) {
    return `${at} * * *`;
  }
  if (days.length && /\b(tous|toutes|chaque|les|every|each|on)\b|s\b/.test(said)) {
    return `${at} * * ${days.sort((a, b) => a - b).join(',')}`;
  }
  return null;
}
