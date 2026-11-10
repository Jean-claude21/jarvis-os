import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { agenda } from './agenda';
import { goalsOf, type GoalProgress } from './goals';
import { habitsWithDays } from './habit-board';
import { WEEKDAYS } from './habits';
import { lingering, openIntentions } from './intentions';
import { CLOSED } from './keywords';
import { patternsOf, type Pattern } from './patterns';
import { preferencesOf, type Preferences } from './prefs';

// The review (spec 043, plan v2 C6): her own questions, a mirror Jarvis prepares without any AI —
// what she did, how her habits were kept, her money, what she said she would do, her goals, what
// comes back — and her decisions, each turned into something to do, linked to the review.

export const REVIEW_KIND = 'Review';

export const DEFAULT_QUESTIONS = {
  fr: [
    'Qu’est-ce qui s’est bien passé ?',
    'Qu’est-ce qui a coincé ?',
    'Qu’est-ce que je garde, j’arrête, je commence ?',
    'Quelle est la chose la plus importante pour la suite ?',
  ],
  en: [
    'What went well?',
    'What got stuck?',
    'What do I keep, stop, start?',
    'What matters most next?',
  ],
};

export interface Mirror {
  from: string;
  to: string;
  /** What she kept, by kind: how many entries the period made. */
  made: { kind: string; n: number }[];
  /** Things done in the period. */
  done: { id: string; kind: string; title: string }[];
  /** Money out and in over the period, by currency as written. */
  money: { direction: string; total: number }[];
  /** What she said she would do and nothing followed. */
  intentions: { id: string; title: string; times: number; since: string }[];
  goals: GoalProgress[];
  patterns: Pattern[];
  /** Her questions, or the usual ones. */
  questions: string[];
  /** Her habits day by day: done, missed, not planned (the days she meant, the days she did). */
  habits: {
    id: string;
    title: string;
    days: { day: string; state: 'done' | 'miss' | 'off' }[];
    kept: number;
    planned: number;
  }[];
  /** Her time: what repeats, planned against kept, in hours. */
  time: { title: string; planned: number; kept: number }[];
  /** Money out by fund or category, this period against its usual (the three before). */
  spending: { name: string; now: number; usual: number }[];
  /** What she committed to in the period (a due day): done, late, or still ahead. */
  commitments: { id: string; title: string; due: string; state: 'done' | 'late' | 'ahead' }[];
  /** Her people in the period: how many things with them, the last one. */
  people: { id: string; title: string; n: number; last: string }[];
  /** What she said in the period, in her words (captures, journal). */
  said: { id: string; at: string; text: string; kind: string }[];
}

/** The mirror of [from, to) in her spaces, prepared by Jarvis. */
export async function mirrorOf(
  tx: Tx,
  spaceIds: string[],
  from: Date,
  to: Date,
  lang: 'fr' | 'en' = 'fr',
): Promise<Mirror> {
  const window = [spaceIds, from.toISOString(), to.toISOString()];
  const { rows: made } = await tx.query<{ kind: string; n: number }>(
    `select kind, count(*)::int as n from entry
      where space_id = any($1) and archived_at is null and created_at >= $2 and created_at < $3
        and jarvis_fold(kind) not in ('model', 'rule', 'script', 'page', 'view', 'app', 'channel', 'reminder')
      group by kind order by 2 desc limit 12`,
    window,
  );
  const { rows: done } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    status: string;
  }>(
    `select id, kind, title, data->>'status' as status from entry
      where space_id = any($1) and archived_at is null and updated_at >= $2 and updated_at < $3
        and data ? 'status' and jarvis_fold(kind) not in ('reminder', 'capture', 'review')
      order by updated_at desc limit 200`,
    window,
  );
  const { rows: money } = await tx.query<{ direction: string; total: string }>(
    `select coalesce(data->>'direction', 'out') as direction, sum((data->>'amount')::numeric) as total
       from entry
      where space_id = any($1) and archived_at is null and jarvis_fold(kind) = 'transaction'
        and (data->>'amount') ~ '^-?[0-9]+([.][0-9]+)?$'
        and coalesce(left(data->>'date', 10), to_char(created_at, 'YYYY-MM-DD')) >= left($2, 10)
        and coalesce(left(data->>'date', 10), to_char(created_at, 'YYYY-MM-DD')) < left($3, 10)
      group by 1 order by 1`,
    window,
  );
  const intentions: Mirror['intentions'] = [];
  const goals: GoalProgress[] = [];
  for (const spaceId of spaceIds) {
    for (const one of await openIntentions(tx, spaceId)) {
      const said = lingering(one, to);
      if (said) intentions.push({ id: one.id, title: one.title, ...said });
    }
    goals.push(...(await goalsOf(tx, spaceId, to.toISOString().slice(0, 10))));
  }
  const asked = (await preferencesOf(tx).catch(() => ({}) as Preferences)).review?.questions;
  const dayOf = (at: Date) => at.toISOString().slice(0, 10);
  const days: string[] = [];
  for (let at = from.getTime(); at < to.getTime() && days.length < 31; at += 86_400_000) {
    days.push(dayOf(new Date(at)));
  }

  // Her habits day by day: an entry that says its days; the days she did it.
  const habitRows = await habitsWithDays(tx, spaceIds, 10);
  const weekdayOf = (day: string) => WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]!;
  const habits: Mirror['habits'] = [];
  for (const h of habitRows) {
    const plan = h.plan;
    const did = h.done;
    const line = days.map((day) => ({
      day,
      state: (did.has(day)
        ? 'done'
        : plan.days.includes(weekdayOf(day)) && day < dayOf(new Date())
          ? 'miss'
          : 'off') as 'done' | 'miss' | 'off',
    }));
    habits.push({
      id: h.id,
      title: h.title,
      days: line,
      kept: line.filter((one) => one.state === 'done').length,
      planned: days.filter((day) => plan.days.includes(weekdayOf(day))).length,
    });
  }

  // Her time: what repeats with a duration, its occurrences planned, those she marked done.
  const occurrences = await agenda(tx, spaceIds, { from, to, today: to });
  const hours = new Map<string, { planned: number; kept: number }>();
  for (const one of occurrences) {
    if (!one.repeated || !one.end) continue;
    const h = (new Date(one.end).getTime() - new Date(one.start).getTime()) / 3_600_000;
    const now = hours.get(one.title) ?? { planned: 0, kept: 0 };
    now.planned += h;
    if (one.status === 'done') now.kept += h;
    hours.set(one.title, now);
  }
  const time = [...hours]
    .map(([title, v]) => ({
      title,
      planned: Math.round(v.planned * 10) / 10,
      kept: Math.round(v.kept * 10) / 10,
    }))
    .sort((a, b) => b.planned - a.planned)
    .slice(0, 8);

  // Money out by fund (its link), else by category, against the three periods before.
  const span = to.getTime() - from.getTime();
  const { rows: spendRows } = await tx.query<{ name: string; now: string; usual: string }>(
    `with t as (
       select coalesce((select f.title from link l join entry f on f.id = l.to_id
                         where l.from_id = e.id and jarvis_fold(l.role) in ('fund', 'fonds') limit 1),
                       nullif(trim(e.data->>'category'), ''), '—') as name,
              abs((e.data->>'amount')::numeric) as amount,
              coalesce(left(e.data->>'date', 10), to_char(e.created_at, 'YYYY-MM-DD')) as day
         from entry e
        where e.space_id = any($1) and e.archived_at is null and jarvis_fold(e.kind) = 'transaction'
          and coalesce(e.data->>'direction', 'out') = 'out' and (e.data->>'amount') ~ '^-?[0-9]+([.][0-9]+)?$')
     select name, sum(case when day >= $2 and day < $3 then amount else 0 end) as now,
            sum(case when day >= $4 and day < $2 then amount else 0 end) / 3 as usual
       from t where day >= $4 and day < $3 group by name order by 2 desc limit 8`,
    [spaceIds, dayOf(from), dayOf(to), dayOf(new Date(from.getTime() - 3 * span))],
  );
  const spending = spendRows
    .map((one) => ({ name: one.name, now: Number(one.now), usual: Math.round(Number(one.usual)) }))
    .filter((one) => one.now || one.usual);

  // What she committed to: a due day in the period.
  const { rows: dueRows } = await tx.query<{
    id: string;
    title: string;
    due: string;
    status: string | null;
  }>(
    `select id, title, left(data->>'due', 10) as due, data->>'status' as status from entry
      where space_id = any($1) and archived_at is null and data ? 'due'
        and left(data->>'due', 10) >= $2 and left(data->>'due', 10) < $3
        and jarvis_fold(kind) not in ('reminder', 'capture')
      order by data->>'due' limit 12`,
    [spaceIds, dayOf(from), dayOf(to)],
  );
  const today = dayOf(new Date());
  const commitments = dueRows.map((one) => ({
    id: one.id,
    title: one.title,
    due: one.due,
    state: (one.status && CLOSED.has(one.status.toLowerCase())
      ? 'done'
      : one.due < today
        ? 'late'
        : 'ahead') as 'done' | 'late' | 'ahead',
  }));

  // Her people: the things linked to them in the period.
  const { rows: peopleRows } = await tx.query<{
    id: string;
    title: string;
    n: number;
    last: string;
  }>(
    `select p.id, p.title, count(distinct e.id)::int as n, max(e.created_at)::text as last
       from entry p
       join link l on l.to_id = p.id or l.from_id = p.id
       join entry e on e.id = case when l.to_id = p.id then l.from_id else l.to_id end
      where p.space_id = any($1) and p.archived_at is null and jarvis_fold(p.kind) = 'person'
        and e.archived_at is null and e.created_at >= $2 and e.created_at < $3
        and jarvis_fold(e.kind) not in ('person', 'comment')
      group by p.id, p.title order by 3 desc limit 6`,
    window,
  );

  // What she said: her captures and her journal, in her words.
  const { rows: saidRows } = await tx.query<{ id: string; at: string; text: string; kind: string }>(
    `select id, coalesce(data->>'at', created_at::text) as at, left(coalesce(data->>'text', title), 220) as text, kind
       from entry
      where space_id = any($1) and archived_at is null and created_at >= $2 and created_at < $3
        and jarvis_fold(kind) in ('capture', 'journal', 'note')
      order by created_at desc limit 6`,
    window,
  );
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    made,
    done: done
      .filter((one) => CLOSED.has(String(one.status).toLowerCase()) && one.status !== 'failed')
      .map(({ id, kind, title }) => ({ id, kind, title })),
    money: money.map((one) => ({ direction: one.direction, total: Number(one.total) })),
    intentions,
    goals,
    patterns: await patternsOf(tx, spaceIds, to),
    questions: asked?.length ? asked : DEFAULT_QUESTIONS[lang],
    habits,
    time,
    spending,
    commitments,
    people: peopleRows,
    said: saidRows,
  };
}

/**
 * Her review kept: her answers, what the mirror said, and each decision turned into a task (with
 * its due day when she gave one), linked to the review (`decided_in`). One save, undone at once.
 */
export async function keepReview(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: {
    title: string;
    from: string;
    to: string;
    answers: { question: string; answer: string }[];
    decisions: { text: string; due?: string; who?: string }[];
  },
) {
  if (!input.answers.length && !input.decisions.length) {
    throw new Error('Give her answers or her decisions.');
  }
  return save(tx, actor, spaceId, {
    entries: [
      {
        ref: 'review',
        kind: REVIEW_KIND,
        title: input.title,
        data: { from: input.from, to: input.to, answers: input.answers },
        origin: 'said',
      },
      ...input.decisions.map((one, at) => ({
        ref: `d${at}`,
        kind: 'Task',
        title: one.text,
        data: {
          status: 'open',
          ...(one.due ? { due: one.due } : {}),
          ...(one.who ? { who: one.who } : {}),
        },
        origin: 'said' as const,
      })),
    ],
    links: input.decisions.map((_, at) => ({ from: `d${at}`, to: 'review', role: 'decided_in' })),
  });
}

/** Her past reviews, the latest first. */
export async function reviewsOf(tx: Tx, spaceId: string) {
  return (await find(tx, spaceId, { kind: REVIEW_KIND, limit: 50 })).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
