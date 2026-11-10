import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { goalsOf, type GoalProgress } from './goals';
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
