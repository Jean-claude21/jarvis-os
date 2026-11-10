import type { Tx } from './db';

// A search that answers (spec 049, plan v2 I8): « combien en transport en octobre ? », « combien de
// prières cette semaine ? » — a figure computed from her entries, never from memory, with what
// justifies it: how many, the largest, the period before, week by week. Rules only, no AI: the
// period and the words are read, the sum or the count is made by the database.

export interface Answer {
  /** What was understood: the words looked for, the period, a sum or a count. */
  question: { words: string[]; from: string; to: string; period: string; mode: 'sum' | 'count' };
  figure: number;
  currency: string | null;
  count: number;
  previous: number;
  top: { id: string; title: string; kind: string; value: number; day: string }[];
  weeks: { from: string; value: number }[];
}

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ');

const MONTHS = [
  ['janvier', 'january', 'janv', 'jan'],
  ['fevrier', 'february', 'fevr', 'feb'],
  ['mars', 'march', 'mar'],
  ['avril', 'april', 'avr', 'apr'],
  ['mai', 'may'],
  ['juin', 'june', 'jun'],
  ['juillet', 'july', 'juil', 'jul'],
  ['aout', 'august', 'aug'],
  ['septembre', 'september', 'sept', 'sep'],
  ['octobre', 'october', 'oct'],
  ['novembre', 'november', 'nov'],
  ['decembre', 'december', 'dec'],
];
const QUESTION = /^(combien|how much|how many|total|quel total|qu est ce que|what did)\b/;
const MONEY =
  /\b(depense|depenses|depense|spent|paye|payes|coute|coutent|argent|f|fcfa|xof|euros?|sorti|sortis)\b/;
const STOP = new Set(
  'combien de d des du le la les l en au aux a pour ce cet cette ces mon ma mes j ai je how much many did i spend spent on in this last the of my total quel quelle est il y dans par sur fois ai fait'.split(
    ' ',
  ),
);
const PERIOD_WORDS = new Set(
  'mois semaine annee aujourd hui hier dernier derniere passe passee month week year today yesterday last'.split(
    ' ',
  ),
);

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The period a question names, on her calendar; this month when it names none. */
export function periodOf(text: string, now = new Date()): { from: Date; to: Date; label: string } {
  const said = ` ${fold(text)} `;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const utc = (yy: number, mm: number, dd = 1) => new Date(Date.UTC(yy, mm, dd));
  if (/\b(aujourd hui|today)\b/.test(said)) {
    const from = utc(y, m, now.getUTCDate());
    return { from, to: new Date(from.getTime() + 86_400_000), label: 'today' };
  }
  if (/\b(hier|yesterday)\b/.test(said)) {
    const to = utc(y, m, now.getUTCDate());
    return { from: new Date(to.getTime() - 86_400_000), to, label: 'yesterday' };
  }
  const monday = utc(y, m, now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  if (/\b(semaine derniere|derniere semaine|last week)\b/.test(said)) {
    return { from: new Date(monday.getTime() - 7 * 86_400_000), to: monday, label: 'last week' };
  }
  if (/\b(cette semaine|this week|la semaine)\b/.test(said)) {
    return { from: monday, to: new Date(monday.getTime() + 7 * 86_400_000), label: 'this week' };
  }
  if (/\b(mois dernier|dernier mois|last month|mois passe)\b/.test(said)) {
    return { from: utc(y, m - 1), to: utc(y, m), label: 'last month' };
  }
  if (/\b(cette annee|this year|l annee)\b/.test(said)) {
    return { from: utc(y, 0), to: utc(y + 1, 0), label: 'this year' };
  }
  const named = MONTHS.findIndex((names) => names.some((name) => said.includes(` ${name} `)));
  if (named >= 0) {
    // A month she names is the last one of that name: « octobre » in November is this October.
    const year = named > m ? y - 1 : y;
    return { from: utc(year, named), to: utc(year, named + 1), label: MONTHS[named]![0]! };
  }
  return { from: utc(y, m), to: utc(y, m + 1), label: 'this month' };
}

/** Whether her words ask for a figure rather than a list. */
export const asksAFigure = (text: string) => QUESTION.test(fold(text).trim());

/** The figure her question asks for, in these spaces, and what justifies it. */
export async function answerOf(
  tx: Tx,
  spaceIds: string[],
  text: string,
  now = new Date(),
): Promise<Answer> {
  const said = fold(text);
  const period = periodOf(text, now);
  const monthNames = new Set(MONTHS.flat());
  const words = said
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !STOP.has(w) &&
        !PERIOD_WORDS.has(w) &&
        !monthNames.has(w) &&
        !MONEY.test(` ${w} `),
    )
    // « prières » finds « Prière »: a plural is read as its word.
    .map((w) => (w.length > 4 ? w.replace(/(s|x)$/, '') : w));
  // Money when her words speak of it; else money when what they name is a category of movements
  // (« combien en transport »), and a count of what she kept otherwise (« combien de prières »).
  const spoken = MONEY.test(` ${said} `);
  const span = period.to.getTime() - period.from.getTime();
  const before = { from: new Date(period.from.getTime() - span), to: period.from };
  const dayOf = `coalesce(left(e.data->>'date', 10), left(e.data->>'start', 10), left(e.data->>'at', 10), to_char(e.created_at, 'YYYY-MM-DD'))`;
  // A word that names one of her kinds (« journal », « bilans ») counts that kind, not every title
  // that holds the word.
  const { rows: known } = await tx.query<{ kind: string }>(
    'select distinct jarvis_fold(kind) as kind from entry where space_id = any($1) and archived_at is null',
    [spaceIds],
  );
  const named = words.filter((w) =>
    known.some((k) => k.kind === w || k.kind === `${w}s` || k.kind.replace(/(s|x)$/, '') === w),
  );
  const matches = named.length
    ? `and (${named.map((_, i) => `regexp_replace(jarvis_fold(e.kind), '(s|x)$', '') = $${i + 4}`).join(' or ')})`
    : words.length
      ? `and (${words.map((_, i) => `jarvis_fold(e.kind || ' ' || e.title || ' ' || coalesce(e.data->>'category', '') || ' ' || coalesce(e.data->>'note', '')) like '%' || $${i + 4} || '%'`).join(' and ')})`
      : '';
  const run = async (money: boolean, from: Date, to: Date) => {
    const where = `e.space_id = any($1) and e.archived_at is null
      and jarvis_fold(e.kind) not in ('model', 'rule', 'reminder', 'capture', 'comment', 'intention', 'app', 'channel')
      ${money ? `and jarvis_fold(e.kind) = 'transaction' and coalesce(e.data->>'direction', 'out') = 'out' and (e.data->>'amount') ~ '^-?[0-9]+([.][0-9]+)?$'` : ''}
      and ${dayOf} >= $2 and ${dayOf} < $3 ${matches}`;
    const value = money ? `abs((e.data->>'amount')::numeric)` : '1';
    return (
      await tx.query<{
        id: string;
        title: string;
        kind: string;
        value: string;
        day: string;
        currency: string | null;
      }>(
        `select e.id, e.title, e.kind, ${value} as value, ${dayOf} as day, e.data->>'currency' as currency
           from entry e where ${where} order by ${value} desc, ${dayOf} desc limit 1000`,
        [spaceIds, day(from), day(to), ...(named.length ? named : words)],
      )
    ).rows;
  };
  // Movements first; when none matches and she did not speak of money, a count of what she kept.
  let money = true;
  let rows = await run(true, period.from, period.to);
  if (!spoken && !rows.length) {
    money = false;
    rows = await run(false, period.from, period.to);
  }
  const mode: 'sum' | 'count' = money ? 'sum' : 'count';
  const previous = (await run(money, before.from, before.to)).reduce(
    (sum, one) => sum + Number(one.value),
    0,
  );
  const weeks: Answer['weeks'] = [];
  for (let at = period.from.getTime(); at < period.to.getTime(); at += 7 * 86_400_000) {
    const from = day(new Date(at));
    const to = day(new Date(Math.min(at + 7 * 86_400_000, period.to.getTime())));
    weeks.push({
      from,
      value: rows
        .filter((one) => one.day >= from && one.day < to)
        .reduce((s, one) => s + Number(one.value), 0),
    });
  }
  return {
    question: { words, from: day(period.from), to: day(period.to), period: period.label, mode },
    figure: rows.reduce((sum, one) => sum + Number(one.value), 0),
    currency: money ? (rows.find((one) => one.currency)?.currency ?? 'XOF') : null,
    count: rows.length,
    previous,
    top: rows.slice(0, 5).map((one) => ({
      id: one.id,
      title: one.title,
      kind: one.kind,
      value: Number(one.value),
      day: one.day,
    })),
    weeks: weeks.length > 1 ? weeks : [],
  };
}
