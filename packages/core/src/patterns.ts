import type { Tx } from './db';
import { planOf, rateOf } from './habits';

// Patterns (spec 042, plan v2 C12): Jarvis counts what comes back — a state said again and again,
// a habit that slips, spending that rises, a person often named — with the figures that justify
// each, marked « inferred ». Counted without any AI; an assistant reads them at the brief and the
// review and says what they may mean.

export type PatternKind = 'state' | 'habit' | 'spending' | 'person';

export interface Pattern {
  kind: PatternKind;
  /** What it is about: the state, the habit, the category, the person. */
  about: string;
  /** The figures, in the engine's words: what the app turns into a sentence. */
  figures: Record<string, number | string>;
  /** The entries it was counted from, for her to see. */
  ids: string[];
  origin: 'inferred';
}

const DAY = 86_400_000;
const STATE_FIELDS = ['mood', 'state', 'humeur', 'etat', 'feeling', 'energy', 'energie'];

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

/** What comes back in her spaces, by `now`. */
export async function patternsOf(tx: Tx, spaceIds: string[], now = new Date()): Promise<Pattern[]> {
  const out: Pattern[] = [];
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const since120 = new Date(now.getTime() - 120 * DAY).toISOString();

  // A state said again and again: the same value three times or more in fourteen days.
  const { rows: states } = await tx.query<{ value: string; ids: string[]; n: number }>(
    `select lower(trim(v.value)) as value, array_agg(e.id order by e.created_at) as ids, count(*)::int as n
       from entry e, jsonb_each_text(e.data) v
      where e.space_id = any($1) and e.archived_at is null and e.created_at >= $2
        and jarvis_fold(v.key) = any($3) and length(v.value) between 2 and 40
      group by 1 having count(*) >= 3 order by 3 desc limit 5`,
    [spaceIds, since14, STATE_FIELDS],
  );
  for (const row of states) {
    out.push({
      kind: 'state',
      about: row.value,
      figures: { times: row.n, days: 14 },
      ids: row.ids.slice(-10),
      origin: 'inferred',
    });
  }

  // A habit that slips: its last thirty days twenty points under the thirty before.
  const { rows: habits } = await tx.query<{
    id: string;
    title: string;
    data: Record<string, unknown>;
    done: string[] | null;
  }>(
    `select h.id, h.title, h.data,
            array(select left(coalesce(d.data->>'date', to_char(d.created_at, 'YYYY-MM-DD')), 10)
                    from link l join entry d on d.id = l.from_id
                   where l.to_id = h.id and d.archived_at is null) as done
       from entry h
      where h.space_id = any($1) and h.archived_at is null
        and (h.data ? 'days' or h.data ? 'jours' or h.data ? 'cadence')
      limit 100`,
    [spaceIds],
  );
  for (const habit of habits) {
    const plan = planOf(habit.data);
    if (!plan) continue;
    const done = habit.done ?? [];
    const recent = rateOf({ id: habit.id, title: habit.title, plan }, done, dayOf(now)).rate30;
    const before = rateOf(
      { id: habit.id, title: habit.title, plan },
      done.filter((day) => day <= dayOf(new Date(now.getTime() - 30 * DAY))),
      dayOf(new Date(now.getTime() - 30 * DAY)),
    ).rate30;
    if (recent !== null && before !== null && before - recent >= 20) {
      out.push({
        kind: 'habit',
        about: habit.title,
        figures: { rate30: recent, before30: before },
        ids: [habit.id],
        origin: 'inferred',
      });
    }
  }

  // Spending that rises: a category's last thirty days a third over its usual (the ninety before).
  const { rows: spending } = await tx.query<{
    category: string;
    recent: string;
    usual: string;
    ids: string[];
  }>(
    `with t as (
       select e.id, e.created_at, coalesce(nullif(trim(e.data->>'category'), ''), '—') as category,
              (e.data->>'amount')::numeric as amount,
              coalesce(left(e.data->>'date', 10), to_char(e.created_at, 'YYYY-MM-DD')) as day
         from entry e
        where e.space_id = any($1) and e.archived_at is null and jarvis_fold(e.kind) = 'transaction'
          and coalesce(e.data->>'direction', 'out') = 'out'
          and (e.data->>'amount') ~ '^-?[0-9]+([.][0-9]+)?$')
     select category,
            sum(case when day >= $2::text then amount else 0 end) as recent,
            sum(case when day < $2::text then amount else 0 end) / 3 as usual,
            (array_agg(id order by created_at desc))[1:10] as ids
       from t where day >= $3::text
      group by 1`,
    [spaceIds, since30.slice(0, 10), since120.slice(0, 10)],
  );
  for (const row of spending) {
    const recent = Number(row.recent);
    const usual = Number(row.usual);
    if (usual > 0 && recent >= usual * 1.33) {
      out.push({
        kind: 'spending',
        about: row.category,
        figures: {
          recent: Math.round(recent),
          usual: Math.round(usual),
          rise: Math.round((recent / usual - 1) * 100),
        },
        ids: row.ids,
        origin: 'inferred',
      });
    }
  }

  // A person often named: linked to, or named in, four entries or more of the last thirty days.
  const { rows: people } = await tx.query<{ id: string; title: string; ids: string[]; n: number }>(
    `select p.id, p.title, array_agg(distinct e.id) as ids, count(distinct e.id)::int as n
       from entry p
       join entry e on e.space_id = p.space_id and e.id <> p.id and e.archived_at is null
                   and e.created_at >= $2
                   and jarvis_fold(e.kind) not in ('person', 'comment', 'intention', 'reminder')
                   and (exists (select 1 from link l where (l.from_id = e.id and l.to_id = p.id)
                                                       or (l.from_id = p.id and l.to_id = e.id))
                        or jarvis_fold(e.title || ' ' || e.data::text) like '%' || jarvis_fold(p.title) || '%')
      where p.space_id = any($1) and p.archived_at is null and jarvis_fold(p.kind) = 'person'
        and length(p.title) >= 3
      group by p.id, p.title having count(distinct e.id) >= 4
      order by 4 desc limit 5`,
    [spaceIds, since30],
  );
  for (const row of people) {
    out.push({
      kind: 'person',
      about: row.title,
      figures: { times: row.n, days: 30 },
      ids: row.ids.slice(0, 10),
      origin: 'inferred',
    });
  }
  return out;
}
