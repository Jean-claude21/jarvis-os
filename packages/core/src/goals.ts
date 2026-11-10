import { withComputed } from './compute';
import type { Tx } from './db';
import { find, get, type Entry } from './entries';
import { planOf, rateOf } from './habits';
import { CLOSED } from './keywords';

// Goals (spec 041, plan v2 C13): a common type « Goal », measurable (« 500 000 F », « 5 kg ») or
// not (« être plus présent »), with a deadline, linked to what makes it move — a fund, habits, a
// project, tasks. Its progress is computed from those links, never written by hand: a measurable
// goal adds up what they hold; another averages how they are kept (a habit's last thirty days,
// a thing done or not). The review and the patterns read it.

export const GOAL_KIND = 'Goal';

/** The fields that hold how far a linked thing went, the first found wins. */
const MEASURES = ['balance', 'current', 'saved', 'value', 'amount', 'progress', 'weight'];
// Links that say nothing of progress.
const NOT_PARTS = new Set(['from_capture', 'on', 'done_by', 'for']);

export interface GoalProgress {
  id: string;
  title: string;
  measurable: boolean;
  target: number | null;
  unit: string | null;
  deadline: string | null;
  /** What the links hold now (measurable), or how they are kept, 0–1. */
  current: number | null;
  /** 0–1, capped at 1; null when nothing linked says it. */
  ratio: number | null;
  /** Days left to the deadline, from today on her clock. */
  daysLeft: number | null;
  parts: { id: string; kind: string; title: string; value: number | null }[];
}

const numberOf = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+([.,]\d+)?$/.test(value.trim()))
    return Number(value.replace(',', '.'));
  return null;
};

/** The target of a goal: `target`, or a number in its title (« Épargner 500 000 F »). */
function targetOf(goal: Entry): { target: number | null; unit: string | null } {
  const unit = typeof goal.data.unit === 'string' ? goal.data.unit : null;
  const given = numberOf(goal.data.target);
  if (given !== null) return { target: given, unit };
  const said = /(\d[\d\s.]*(?:,\d+)?)\s*(f|fcfa|xof|€|eur|kg|km|h|livres?|pages?)?\b/i.exec(
    goal.title,
  );
  if (!said) return { target: null, unit };
  const target = Number(said[1]!.replace(/[\s.]/g, '').replace(',', '.'));
  return { target: target > 0 ? target : null, unit: unit ?? said[2] ?? null };
}

/** How far a goal went, from what is linked to it. */
export async function goalProgress(
  tx: Tx,
  spaceId: string,
  id: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<GoalProgress> {
  const goal = await get(tx, spaceId, id);
  if (!goal) throw new Error(`No entry ${id} in this space.`);
  const { target, unit } = targetOf(goal);
  const measurable = target !== null;
  const measure = typeof goal.data.measure === 'string' ? goal.data.measure : null;
  const linked = [...goal.links.in, ...goal.links.out].filter(
    (link) => !NOT_PARTS.has(link.role) && link.entry.kind !== 'Comment',
  );
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const link of linked) {
    if (seen.has(link.entry.id)) continue;
    seen.add(link.entry.id);
    const one = await get(tx, spaceId, link.entry.id);
    if (one && !one.archivedAt) entries.push(one);
  }
  const computed = await withComputed(tx, spaceId, entries);
  const parts: GoalProgress['parts'] = [];
  for (const one of computed) {
    const fields = { ...one.data, ...(one.computed ?? {}) };
    let value: number | null = null;
    if (measurable) {
      for (const field of measure ? [measure] : MEASURES) {
        value = numberOf(fields[field]);
        if (value !== null) break;
      }
    } else {
      const plan = planOf(one.data);
      if (plan) {
        // A habit: how it was kept these thirty days, from the days linked to it.
        const full = await get(tx, spaceId, one.id);
        const days = (full?.links.in ?? []).map((link) => link.entry.id);
        const done = days.length
          ? (await find(tx, spaceId, { limit: 500 }))
              .filter((entry) => days.includes(entry.id))
              .map((entry) => String(entry.data.date ?? entry.createdAt).slice(0, 10))
          : [];
        const rate = rateOf({ id: one.id, title: one.title, plan }, done, today).rate30;
        value = rate === null ? null : rate / 100;
      } else if (typeof one.data.status === 'string') {
        value = CLOSED.has(one.data.status.toLowerCase()) ? 1 : 0;
      } else {
        value = numberOf(fields.progress);
      }
    }
    parts.push({ id: one.id, kind: one.kind, title: one.title, value });
  }
  const known = parts.map((one) => one.value).filter((one): one is number => one !== null);
  const current = known.length
    ? measurable
      ? known.reduce((a, b) => a + b, 0)
      : known.reduce((a, b) => a + b, 0) / known.length
    : null;
  const ratio =
    current === null ? null : Math.max(0, Math.min(1, measurable ? current / target! : current));
  const said = goal.data.deadline ?? goal.data.due;
  const deadline = typeof said === 'string' ? said.slice(0, 10) : null;
  const daysLeft = deadline
    ? Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000)
    : null;
  return {
    id: goal.id,
    title: goal.title,
    measurable,
    target,
    unit,
    deadline,
    current: current === null ? null : Math.round(current * 1000) / 1000,
    ratio: ratio === null ? null : Math.round(ratio * 1000) / 1000,
    daysLeft,
    parts,
  };
}

/** Her open goals in a space, with their progress. */
export async function goalsOf(tx: Tx, spaceId: string, today?: string): Promise<GoalProgress[]> {
  const goals = (await find(tx, spaceId, { kind: GOAL_KIND, limit: 100 })).filter(
    (one) => typeof one.data.status !== 'string' || !CLOSED.has(one.data.status.toLowerCase()),
  );
  const out: GoalProgress[] = [];
  for (const one of goals) out.push(await goalProgress(tx, spaceId, one.id, today));
  return out;
}
