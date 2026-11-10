import type { Tx } from './db';
import { evaluate, parse } from './formula';
import { planOf, rateOf } from './habits';
import { dataInNewWords } from './keywords';
import { appsOf } from './roles';

// Patterns (spec 042, plan v2 C12): Jarvis counts what comes back — a state said again and again,
// a habit that slips, spending that rises, a person often named — with the figures that justify
// each, marked « inferred ». Counted without any AI; an assistant reads them at the brief and the
// review and says what they may mean.

export type PatternKind = 'state' | 'habit' | 'spending' | 'person' | 'app';

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
    kind: string;
    title: string;
    data: Record<string, unknown>;
    done: string[] | null;
  }>(
    `select h.id, h.kind, h.title, h.data,
            array(select left(coalesce(d.data->>'date', to_char(d.created_at, 'YYYY-MM-DD')), 10)
                    from link l join entry d on d.id = l.from_id
                   where l.to_id = h.id and d.archived_at is null) as done
       from entry h
      where h.space_id = any($1) and h.archived_at is null
        and (h.data ? 'days' or h.data ? 'jours' or h.data ? 'cadence' or (h.data ? 'repeat' and jarvis_fold(h.kind) in ('habit', 'habitude')))
      limit 100`,
    [spaceIds],
  );
  for (const habit of habits) {
    const plan = planOf(habit.data, habit.kind);
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
                        or jarvis_fold(e.title || ' ' || e.data::text) ~ ('\\m' || regexp_replace(jarvis_fold(p.title), '[^[:alnum:] ]', '', 'g') || '\\M'))
      where p.space_id = any($1) and p.archived_at is null and jarvis_fold(p.kind) = 'person'
        and length(p.title) >= 3
        -- Not herself: the person named as her space.
        and not exists (select 1 from space s where s.id = p.space_id and jarvis_fold(s.name) = jarvis_fold(p.title))
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
  out.push(...(await appPatternsOf(tx, spaceIds, now)));
  return out;
}

const said = (value: unknown, lang: 'fr' | 'en') =>
  typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? String((value as Record<string, string>)[lang] ?? Object.values(value)[0] ?? '')
      : '';

/**
 * What her apps watch for (spec 050): each pattern of an app's role, counted (or summed) on the
 * entries of its kind matching `where`, the last 30 days against the 30 before; it comes back when
 * it moved by `rise` percent (30 by default), up or down, named with its app.
 */
export async function appPatternsOf(
  tx: Tx,
  spaceIds: string[],
  now = new Date(),
  lang: 'fr' | 'en' = 'fr',
): Promise<Pattern[]> {
  const out: Pattern[] = [];
  const split = new Date(now.getTime() - 30 * DAY);
  const since = new Date(now.getTime() - 60 * DAY);
  const clock = { now };
  for (const spaceId of spaceIds) {
    for (const app of await appsOf(tx, spaceId)) {
      for (const pattern of app.role.patterns ?? []) {
        const { rows } = await tx.query<{
          id: string;
          title: string;
          data: Record<string, unknown>;
          day: string;
        }>(
          `select id, title, data - 'text' as data,
                  coalesce(left(data->>'date', 10), to_char(created_at, 'YYYY-MM-DD')) as day
             from entry
            where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
              and coalesce(left(data->>'date', 10), to_char(created_at, 'YYYY-MM-DD')) >= $3
            limit 2000`,
          [spaceId, pattern.kind, dayOf(since)],
        );
        const test = pattern.where ? parse(pattern.where) : null;
        let recent = 0;
        let before = 0;
        const ids: string[] = [];
        for (const row of rows) {
          if (row.day > dayOf(now)) continue;
          if (test) {
            // Her words for a field (« statut ») read as Jarvis keeps them (« status »).
            const scope = {
              get: (name: string) =>
                name === 'title'
                  ? row.title
                  : (row.data[name] ??
                    row.data[Object.keys(dataInNewWords({ [name]: 1 }))[0]!] ??
                    null),
            };
            if (!(await evaluate(test, scope, clock).catch(() => false))) continue;
          }
          const value = pattern.sum ? Number(row.data[pattern.sum]) || 0 : 1;
          if (row.day >= dayOf(split)) {
            recent += value;
            ids.push(row.id);
          } else before += value;
        }
        if (!before) continue;
        const change = Math.round((recent / before - 1) * 100);
        if (Math.abs(change) < (pattern.rise ?? 30)) continue;
        out.push({
          kind: 'app',
          about: said(pattern.about, lang) || pattern.kind,
          figures: {
            app: app.app,
            recent: Math.round(recent),
            before: Math.round(before),
            change,
            measure: pattern.sum ? 'sum' : 'count',
          },
          ids: ids.slice(0, 10),
          origin: 'inferred',
        });
      }
    }
  }
  return out;
}
