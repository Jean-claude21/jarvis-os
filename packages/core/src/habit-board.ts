// Her habits as the Routines page shows them: each with its days, what she did today, its streak,
// how regular it was on the last days, and the day-by-day rate of all of them together. A habit is
// an entry that says its days (`days`, `jours`, `cadence`, a Habit's `repeat`); the days she did it
// are the entries done for it (a link `for`, a check-in) and the entries of the kind it tracks.
import type { Tx } from './db';
import { planOf, rateOf, WEEKDAYS, type HabitPlan } from './habits';

export interface HabitDays {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  plan: HabitPlan;
  done: Set<string>;
}

/** Her habits with the days she did them, one per name (at most `limit`). */
export async function habitsWithDays(tx: Tx, spaceIds: string[], limit = 20): Promise<HabitDays[]> {
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
    done: string[] | null;
  }>(
    `select h.id, h.kind, h.title, h.data - 'text' as data,
            array(
              select left(coalesce(d.data->>'date', d.data->>'day', d.data->>'start', to_char(d.created_at, 'YYYY-MM-DD')), 10)
                from entry d
               where d.archived_at is null and d.id <> h.id
                 and not (d.data ? 'days' or d.data ? 'jours' or d.data ? 'cadence')
                 and (exists (select 1 from link l
                               where (l.role = 'for' or jarvis_fold(d.kind) in ('checkin', 'pointage'))
                                 and ((l.from_id = d.id and l.to_id = h.id) or (l.from_id = h.id and l.to_id = d.id)))
                      or (d.space_id = h.space_id
                          and jarvis_fold(d.kind) = jarvis_fold(coalesce(h.data->>'tracks', h.title))))) as done
       from entry h
      where h.space_id = any($1) and h.archived_at is null
        and (h.data ? 'days' or h.data ? 'jours' or h.data ? 'cadence'
             or (h.data ? 'repeat' and jarvis_fold(h.kind) in ('habit', 'habitude')))
      order by h.title limit 60`,
    [spaceIds],
  );
  const out: HabitDays[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const plan = planOf(row.data, row.kind);
    const name = row.title.trim().toLowerCase();
    if (!plan || seen.has(name) || out.length >= limit) continue;
    seen.add(name);
    out.push({ ...row, plan, done: new Set(row.done ?? []) });
  }
  return out;
}

const dayOf = (at: Date) => at.toISOString().slice(0, 10);
const weekdayOf = (day: string) => WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]!;
const back = (day: string, n: number) =>
  dayOf(new Date(new Date(`${day}T12:00:00Z`).getTime() - n * 86_400_000));

export type DayState = 'done' | 'miss' | 'off' | 'todo';

/** The state of each day of a habit, from `from` to `today` (today is « todo » while it lasts). */
export function lineOf(habit: HabitDays, days: string[], today: string): DayState[] {
  return days.map((day) => {
    if (habit.done.has(day)) return 'done';
    if (!habit.plan.days.includes(weekdayOf(day))) return 'off';
    if (day > today) return 'off';
    return day === today ? 'todo' : 'miss';
  });
}

/** The planned days kept in a row, back from today (today counted only when done). */
export function streakOf(habit: HabitDays, today: string): number {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const day = back(today, i);
    if (!habit.plan.days.includes(weekdayOf(day))) continue;
    if (habit.done.has(day)) n++;
    else if (i > 0) break;
  }
  return n;
}

export interface HabitBoard {
  days: string[];
  habits: {
    id: string;
    kind: string;
    title: string;
    cadence: string;
    time: string | null;
    facet: string | null;
    nonNegotiable: boolean;
    today: 'done' | 'todo' | null;
    streak: number;
    rate30: number | null;
    line: DayState[];
  }[];
  /** All planned habits of each day: the share done, or null on a day with none planned. */
  daily: { day: string; rate: number | null }[];
}

/** Her habits for the Routines page: today, the streaks, the last `span` days. */
export async function habitBoard(
  tx: Tx,
  spaceIds: string[],
  today: string,
  span = 28,
): Promise<HabitBoard> {
  const found = await habitsWithDays(tx, spaceIds, 30);
  const days = Array.from({ length: span }, (_, i) => back(today, span - 1 - i));
  const habits = found.map((habit) => {
    const repeat =
      typeof habit.data.repeat === 'string' ? habit.data.repeat.trim().split(/\s+/) : [];
    const time =
      typeof habit.data.time === 'string'
        ? habit.data.time
        : repeat.length === 5 && /^\d+$/.test(repeat[0]!) && /^\d+$/.test(repeat[1]!)
          ? `${repeat[1]!.padStart(2, '0')}:${repeat[0]!.padStart(2, '0')}`
          : null;
    const rate = rateOf(
      { id: habit.id, title: habit.title, plan: habit.plan },
      [...habit.done],
      today,
    );
    const flag = habit.data.non_negotiable ?? habit.data.nonNegotiable ?? habit.data.non_negociable;
    return {
      id: habit.id,
      kind: habit.kind,
      title: habit.title,
      cadence: habit.plan.days.join(','),
      time,
      facet: typeof habit.data.facet === 'string' ? habit.data.facet : null,
      nonNegotiable: flag === true || flag === 'true' || flag === 'oui' || flag === 'yes',
      today: rate.today,
      streak: streakOf(habit, today),
      rate30: rate.rate30,
      line: lineOf(habit, days, today),
    };
  });
  const daily = days.map((day, i) => {
    const planned = habits.filter((one) => one.line[i] !== 'off');
    const done = planned.filter((one) => one.line[i] === 'done').length;
    return { day, rate: planned.length ? Math.round((done / planned.length) * 100) : null };
  });
  habits.sort(
    (a, b) =>
      Number(b.nonNegotiable) - Number(a.nonNegotiable) ||
      (a.time ?? '99').localeCompare(b.time ?? '99') ||
      a.title.localeCompare(b.title),
  );
  return { days, habits, daily };
}
