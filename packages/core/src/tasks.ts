import { z } from 'zod';
import { nextTime } from './time';
import { DEFAULT_ZONE } from './time';
import type { Action } from './rules';

// The tasks of an agent (spec 109). An agent is who works — its instructions, its access, its
// freedom, its budget, its memory, its Pause — and has no time of its own: each of its tasks says
// when (a plan she sets freely, a date, a save, a message) and what (a reminder, a skill, a rule).
// A task is kept as a rule (spec 006): nothing new runs. A plan is written as the five fields the
// watcher already reads; a « when » can be read from her words; her free text becomes task lines.

/** A plan she sets on screen: every day, on weekdays, on some days, once a month, every N hours. */
export const planSchema = z.object({
  every: z.enum(['day', 'weekdays', 'days', 'month', 'hours']),
  /** « 18:00 ». Every N hours: the minute only matters. */
  at: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
    .default('09:00'),
  /** The days, 0 = Sunday … 6 = Saturday (`days`). */
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  /** The day of the month, 1 to 28, or its last day (`month`). */
  monthDay: z.union([z.number().int().min(1).max(28), z.literal('last')]).optional(),
  /** Every N hours, 1 to 12 (`hours`). */
  hours: z.number().int().min(1).max(12).optional(),
});
export type Plan = z.infer<typeof planSchema>;

const hm = (at: string) => {
  const [h, m] = at.split(':').map(Number);
  return { h: h!, m: m! };
};

/** A plan as the watcher reads it: « m h day-of-month month day-of-week ». */
export function scheduleOf(raw: Plan): string {
  const plan = planSchema.parse(raw);
  const { h, m } = hm(plan.at);
  switch (plan.every) {
    case 'day':
      return `${m} ${h} * * *`;
    case 'weekdays':
      return `${m} ${h} * * 1-5`;
    case 'days': {
      const days = [...new Set(plan.days ?? [])].sort((a, b) => a - b);
      if (!days.length) throw new Error('Choose at least one day.');
      return `${m} ${h} * * ${days.join(',')}`;
    }
    case 'month':
      return `${m} ${h} ${plan.monthDay === 'last' ? 'L' : (plan.monthDay ?? 1)} * *`;
    case 'hours':
      return `${m} */${plan.hours ?? 1} * * *`;
  }
}

/** A schedule read back as a plan, to set it again on screen; null when it says more. */
export function planOfSchedule(schedule: string): Plan | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, month, dow] = parts as [string, string, string, string, string];
  if (!/^\d+$/.test(m) || month !== '*') return null;
  const at = (hours: string) => `${hours.padStart(2, '0')}:${m.padStart(2, '0')}`;
  const every = /^\*\/(\d+)$/.exec(h);
  if (every && dom === '*' && dow === '*')
    return { every: 'hours', at: at('0'), hours: Number(every[1]) };
  if (!/^\d+$/.test(h)) return null;
  if (dom === '*' && dow === '*') return { every: 'day', at: at(h) };
  if (dom === '*' && dow === '1-5') return { every: 'weekdays', at: at(h) };
  if (dom === '*' && /^\d(,\d)*$/.test(dow))
    return { every: 'days', at: at(h), days: dow.split(',').map((one) => Number(one) % 7) };
  if (dom === 'L' && dow === '*') return { every: 'month', at: at(h), monthDay: 'last' };
  if (/^\d+$/.test(dom) && Number(dom) <= 28 && dow === '*')
    return { every: 'month', at: at(h), monthDay: Number(dom) };
  return null;
}

/** The next times a schedule runs, in her time zone. */
export function nextRuns(schedule: string, from: Date, zone = DEFAULT_ZONE, count = 3): string[] {
  const times: string[] = [];
  let after = from;
  for (let at = 0; at < count; at += 1) {
    const next = nextTime(schedule, after, zone);
    times.push(next.toISOString());
    after = new Date(next.getTime() + 60_000);
  }
  return times;
}

// ——— A « when » read from her words (French first, the language she writes in) ———

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DAY_NAMES: [RegExp, number][] = [
  [/\blundis?\b|\bmonday/, 1],
  [/\bmardis?\b|\btuesday/, 2],
  [/\bmercredis?\b|\bwednesday/, 3],
  [/\bjeudis?\b|\bthursday/, 4],
  [/\bvendredis?\b|\bfriday/, 5],
  [/\bsamedis?\b|\bsaturday/, 6],
  [/\bdimanches?\b|\bsunday/, 0],
];

/**
 * The plan a sentence says (« chaque vendredi à 18 h », « tous les jours à 7h30 », « en semaine
 * à 9 h », « le 1er de chaque mois à 10 h », « toutes les 2 heures »), and the words it used;
 * null when it says no time. Without an hour, 9:00.
 */
export function planFromText(text: string): { plan: Plan; said: string } | null {
  const f = fold(text);
  const time =
    /\b(?:a|vers)\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/.exec(f) ??
    /\b(\d{1,2})\s*h\s*(\d{2})?\b/.exec(f);
  const at = time ? `${time[1]!.padStart(2, '0')}:${(time[2] ?? '00').padStart(2, '0')}` : '09:00';
  if (time && Number(time[1]) > 23) return null;
  const hours = /toutes les\s+(\d{1,2})\s*h(?:eures?)?\b|every\s+(\d{1,2})\s*hours?/.exec(f);
  const pieces: string[] = [];
  const keep = (match: RegExpExecArray | null) => match && pieces.push(match[0]);
  let plan: Plan | null = null;
  if (hours) {
    plan = { every: 'hours', at: '00:00', hours: Number(hours[1] ?? hours[2]) };
    keep(hours);
  } else {
    const month =
      /\ble\s+(\d{1,2})(?:er|e)?\s+(?:de chaque mois|du mois|de tous les mois|chaque mois)/.exec(
        f,
      ) ?? /\bchaque mois(?:,)?\s+le\s+(\d{1,2})(?:er|e)?\b/.exec(f);
    const lastDay =
      /\b(?:le\s+)?dernier jour (?:du|de chaque) mois\b|\bfin (?:du|de chaque) mois\b/.exec(f);
    const weekdays = /\ben semaine\b|\bdu lundi au vendredi\b|\bles jours ouvres\b/.exec(f);
    const daily =
      /\b(?:chaque|tous les)\s+(?:jours?|matins?|soirs?)\b|\bquotidien(?:nement)?\b/.exec(f);
    const named = DAY_NAMES.filter(([re]) => re.test(f)).map(([, day]) => day);
    if (lastDay) {
      plan = { every: 'month', at, monthDay: 'last' };
      keep(lastDay);
    } else if (month) {
      plan = { every: 'month', at, monthDay: Math.min(28, Number(month[1])) };
      keep(month);
    } else if (weekdays) {
      plan = { every: 'weekdays', at };
      keep(weekdays);
    } else if (named.length) {
      plan = { every: 'days', at, days: [...new Set(named)].sort((a, b) => a - b) };
      keep(/\b(?:chaque|tous les|le|les)\s+(?:[a-z]+(?:s)?(?:\s*(?:,|et)\s*)?)+/.exec(f));
    } else if (daily) {
      plan = { every: 'day', at };
      keep(daily);
    }
  }
  if (!plan) return null;
  if (time) pieces.push(time[0]);
  return { plan, said: pieces.join(' ') };
}

/** What is left of a sentence once its « when » is taken out: the task's « what ». */
function whatOf(sentence: string): string {
  return (
    sentence
      .replace(
        /\b(?:chaque|tous les|toutes les|le|les|en|du|de|a|à|vers)\b\s+(?:\d{1,2}(?:er|e)?\s*(?:h|:)\s*\d{0,2}|jours?|matins?|soirs?|semaine|mois|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?|\d{1,2}\s*heures?|(?:lundi au vendredi))\b(?:\s*(?:,|et)\s*(?:lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?))*/giu,
        ' ',
      )
      .replace(
        /\b(?:le\s+)?dernier jour (?:du|de chaque) mois\b|\bfin (?:du|de chaque) mois\b/giu,
        ' ',
      )
      .replace(/\ble\s+\d{1,2}(?:er|e)?\s+(?:de chaque mois|du mois)\b/giu, ' ')
      .replace(/\b(?:de chaque mois|chaque mois)\b/giu, ' ')
      .replace(/\b\d{1,2}\s*h\s*\d{0,2}\b/giu, ' ')
      // A preposition left alone once its time is gone (« à », « vers »: \b does not see « à »).
      .replace(/(^|\s)(?:à|a|vers)(?=\s*(?:[,.;:]|$))/giu, '$1')
      .replace(/\s*,\s*,/g, ',')
      .replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '')
      .replace(/\s{2,}/g, ' ')
  );
}

/** A task line drawn from her text: its plan, its words, and the skill it names, if any. */
export interface TaskDraft {
  plan: Plan;
  schedule: string;
  what: string;
  skill: string | null;
  sentence: string;
}

/**
 * Her free text read as task lines (spec 109): each sentence that says a time becomes a task —
 * its « what » the rest of the sentence, a skill when it names one of hers; the sentences that say
 * none stay her instructions. No AI: what it cannot read, she writes as a line herself.
 */
export function tasksFromText(
  text: string,
  skills: string[] = [],
): { tasks: TaskDraft[]; instructions: string } {
  const sentences = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((one) => one.trim())
    .filter(Boolean);
  const tasks: TaskDraft[] = [];
  const rest: string[] = [];
  for (const sentence of sentences) {
    const read = planFromText(sentence);
    if (!read) {
      rest.push(sentence);
      continue;
    }
    const what = whatOf(sentence) || sentence;
    // The skill is read in the whole sentence: « le bilan du mois » names « Bilan du mois ».
    const words = fold(sentence);
    const skill =
      skills
        .filter((name) => {
          const named = fold(name);
          return (
            words.includes(named) ||
            named
              .split(/\s+/)
              .filter((word) => word.length > 3)
              .every((word) => words.includes(word))
          );
        })
        .sort((a, b) => b.length - a.length)[0] ?? null;
    tasks.push({ plan: read.plan, schedule: scheduleOf(read.plan), what, skill, sentence });
  }
  return { tasks, instructions: rest.join(' ') };
}

// ——— A task that follows a skill ———

/** Over which time a skill's task works: the day, the week, the month, the year before it. */
export const PERIODS = ['day', 'week', 'month', 'year'] as const;
export type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { day: 0, week: 6, month: 29, year: 364 };

/**
 * What a task that follows a skill does on its time (spec 109). Until her agent has a mind of its
 * own (a model, a server), Jarvis prepares the work and says it is ready: a « Bilan » to write over
 * its period when the skill makes one, and a reminder she reads on her channels. Her assistant
 * writes it when she speaks to it — the skill « Les bilans » finds what waits.
 */
export function skillActions(
  skill: { name: string; result?: { kind?: string } | undefined },
  period: Period = 'week',
): Action[] {
  const words = `C’est l’heure de « ${skill.name} » : dis à Claude « ${skill.name} », il est prêt.`;
  if (skill.result?.kind?.toLowerCase() === 'bilan')
    return [
      {
        create: {
          kind: 'Bilan',
          title: skill.name,
          data: {
            type: skill.name,
            skill: skill.name,
            status: 'to_write',
            from: PERIOD_DAYS[period] ? `=date_add(today(), -${PERIOD_DAYS[period]})` : '=today()',
            to: '=today()',
          },
        },
      },
      { remind: { text: words } },
    ];
  return [{ remind: { text: words } }];
}

/** The skill a task follows, when it does (read back from its actions). */
export function skillOfTask(then: Action[]): string | null {
  for (const action of then) {
    if ('create' in action && typeof action.create.data?.skill === 'string')
      return action.create.data.skill;
    if ('remind' in action) {
      const named = /C’est l’heure de « (.+?) »/.exec(action.remind.text);
      if (named) return named[1]!;
    }
  }
  return null;
}
