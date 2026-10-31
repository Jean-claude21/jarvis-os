// Habits (spec 017): what she meant to do and what she did. A habit says its days (`days`: mon…sun,
// or her own words — « 7/7 », « lun-ven », « mar,mer,sam ») and since when (`since`); the entries
// linked to it are the days she did it. Words that are not understood give no rate: no number is
// guessed.

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const NAMES: Record<string, Weekday> = {
  mon: 'mon',
  monday: 'mon',
  lun: 'mon',
  lundi: 'mon',
  tue: 'tue',
  tuesday: 'tue',
  mar: 'tue',
  mardi: 'tue',
  wed: 'wed',
  wednesday: 'wed',
  mer: 'wed',
  mercredi: 'wed',
  thu: 'thu',
  thursday: 'thu',
  jeu: 'thu',
  jeudi: 'thu',
  fri: 'fri',
  friday: 'fri',
  ven: 'fri',
  vendredi: 'fri',
  sat: 'sat',
  saturday: 'sat',
  sam: 'sat',
  samedi: 'sat',
  sun: 'sun',
  sunday: 'sun',
  dim: 'sun',
  dimanche: 'sun',
};
const EVERY_DAY = new Set([
  '7/7',
  'quotidien',
  'quotidienne',
  'daily',
  'every day',
  'everyday',
  'tous les jours',
  'chaque jour',
]);

/** The weekdays a value says, or null when any part of it is not understood. */
export function weekdaysOf(value: unknown): Weekday[] | null {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  if (!parts.length) return null;
  const days = new Set<Weekday>();
  for (const part of parts) {
    if (typeof part !== 'string') return null;
    const text = fold(part);
    if (EVERY_DAY.has(text)) {
      WEEKDAYS.forEach((one) => days.add(one));
      continue;
    }
    const tokens = text.split(/\s*(?:,|;|·|\/|\bet\b|\band\b|\s)\s*/).filter(Boolean);
    if (!tokens.length) return null;
    for (const token of tokens) {
      const range = /^([a-z]+)\s*-\s*([a-z]+)$/.exec(token);
      if (range) {
        const from = NAMES[range[1]!];
        const to = NAMES[range[2]!];
        if (!from || !to) return null;
        let at = WEEKDAYS.indexOf(from);
        for (let guard = 0; guard < 7; guard++) {
          days.add(WEEKDAYS[at]!);
          if (WEEKDAYS[at] === to) break;
          at = (at + 1) % 7;
        }
        continue;
      }
      const day = NAMES[token];
      if (!day) return null;
      days.add(day);
    }
  }
  return WEEKDAYS.filter((one) => days.has(one));
}

export interface HabitPlan {
  days: Weekday[];
  /** The field the days were read from, and its words. */
  from: string;
  text: string;
  since: string | null;
}

const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);

/** What a habit plans: its days (from `days`, else her words in `jours` or `cadence`), since when. */
export function planOf(data: Record<string, unknown>): HabitPlan | null {
  for (const field of ['days', 'jours', 'cadence']) {
    if (data[field] === undefined || data[field] === null || data[field] === '') continue;
    const days = weekdaysOf(data[field]);
    if (!days?.length) continue;
    const since = [data.since, data.depuis, data.start].find(isDay)?.slice(0, 10) ?? null;
    return {
      days,
      from: field,
      text: Array.isArray(data[field]) ? (data[field] as string[]).join(', ') : String(data[field]),
      since,
    };
  }
  return null;
}

export interface HabitRate {
  id: string;
  title: string;
  plan: HabitPlan;
  /** The last thirty days (from `since`, today counted only when done). */
  planned30: number;
  done30: number;
  rate30: number | null;
  /** Since `since`, else since the first day done. */
  planned: number;
  done: number;
  rate: number | null;
  /** Planned days not done, the latest first (at most fourteen). */
  missed: string[];
}

const dayNumber = (day: string) =>
  Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;
const dayFromNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (n: number) => WEEKDAYS[(new Date(n * 86_400_000).getUTCDay() + 6) % 7]!;

/** How a habit was kept: its planned days against the days she did it, up to today. */
export function rateOf(
  habit: { id: string; title: string; plan: HabitPlan },
  doneDays: string[],
  today: string,
): HabitRate {
  const todayN = dayNumber(today);
  const done = new Set(doneDays.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)));
  const first = [...done].sort()[0];
  const startAll = habit.plan.since ?? first ?? today;
  const count = (fromN: number) => {
    let planned = 0;
    let kept = 0;
    const missed: string[] = [];
    for (let n = fromN; n <= todayN; n++) {
      const day = dayFromNumber(n);
      const wanted = habit.plan.days.includes(weekdayOf(n));
      const did = done.has(day);
      // Today is not missed yet while it lasts.
      if (n === todayN && !did) continue;
      if (wanted) planned++;
      if (wanted && did) kept++;
      if (wanted && !did) missed.push(day);
    }
    return { planned, kept, missed };
  };
  const all = count(dayNumber(startAll));
  const recent = count(Math.max(dayNumber(startAll), todayN - 29));
  const rate = (kept: number, planned: number) =>
    planned ? Math.round((kept / planned) * 1000) / 10 : null;
  return {
    id: habit.id,
    title: habit.title,
    plan: habit.plan,
    planned30: recent.planned,
    done30: recent.kept,
    rate30: rate(recent.kept, recent.planned),
    planned: all.planned,
    done: all.kept,
    rate: rate(all.kept, all.planned),
    missed: recent.missed.reverse().slice(0, 14),
  };
}
