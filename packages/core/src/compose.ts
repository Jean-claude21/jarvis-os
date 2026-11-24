import { z } from 'zod';
import { componentNamed } from './components';
import type { Facet } from './facets';
import { blockSchema, HIGHLIGHT_PARTS, type Block } from './pages';

// A page composed on screen (v3 F4): she picks a block of the registry, then answers what it asks
// in plain choices — which kind, how to count, by what, which columns — and Jarvis writes its
// settings. The same answers make the same block for every app: nothing here knows an app.

/** What a block asks before it can be drawn (the registry's `asks`). */
export type Ask = 'kind' | 'measure' | 'group' | 'fields' | 'days' | 'parts' | 'period';

/** A kind as composing reads it: its fields and its facets. */
export interface KindShape {
  kind: string;
  fields: { name: string; type: string; options?: string[]; target?: string }[];
  facets: Facet[];
}

/** The times a card can be set over (spec 107). */
export const WITHIN = ['month', '3m', '6m', '12m'] as const;
const WITHIN_DAYS: Record<(typeof WITHIN)[number], number> = {
  month: 0,
  '3m': 92,
  '6m': 183,
  '12m': 366,
};

export const answersSchema = z.object({
  component: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(120).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  /** « count », or a number field to add up. */
  measure: z.string().trim().min(1).max(60).optional(),
  /** A choice or link field, or « month » (of its date). */
  group: z.string().trim().min(1).max(60).optional(),
  fields: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  days: z.number().int().min(1).max(366).optional(),
  parts: z.array(z.enum(HIGHLIGHT_PARTS)).max(HIGHLIGHT_PARTS.length).optional(),
  /** Only what falls in the page's period (a review): its date between « {from} » and « {to} ». */
  inPeriod: z.boolean().optional(),
  /** Over which time (spec 107, a card set): this month, or the last 3, 6 or 12 months. */
  within: z.enum(WITHIN).optional(),
  /** Only the entries whose choice field holds this value (« état = à payer »). */
  only: z
    .object({ field: z.string().trim().min(1).max(60), value: z.string().min(1).max(200) })
    .optional(),
  /** A condition the assistant wrote, kept as it is when she sets the card on screen. */
  where: z.string().trim().min(1).max(2000).optional(),
});
export type Answers = z.infer<typeof answersSchema>;

const NUMBERS = new Set(['number', 'amount', 'integer', 'progress', 'rating', 'duration']);
const GROUPS = new Set(['choice', 'link', 'boolean', 'text']);

const facet = <F extends Facet['facet']>(shape: KindShape, name: F) =>
  shape.facets.find((one) => one.facet === name) as Extract<Facet, { facet: F }> | undefined;

/** The fields of a kind she can count with, group by, or show — what the screen offers. */
export function choicesOf(shape: KindShape) {
  const dated = facet(shape, 'dated');
  return {
    measures: shape.fields.filter((one) => NUMBERS.has(one.type)).map((one) => one.name),
    groups: [
      ...shape.fields
        .filter((one) => GROUPS.has(one.type) && (one.type !== 'text' || one.options?.length))
        .map((one) => one.name),
      ...(dated ? ['month'] : []),
    ],
    fields: shape.fields
      .filter((one) => !['long_text', 'lines', 'formula', 'button', 'file'].includes(one.type))
      .map((one) => one.name),
  };
}

/** Whether a kind has what a block needs (its facets). */
export function fits(component: string, shape: KindShape): boolean {
  const info = componentNamed(component);
  return (info?.needs?.facets ?? []).every((name) =>
    shape.facets.some((one) => one.facet === name),
  );
}

/**
 * A block's settings from her answers, checked like any page block; throws a sentence that says
 * what is missing.
 */
export function composeBlock(answers: Answers, shape: KindShape | null): Block {
  const info = componentNamed(answers.component);
  if (!info?.block) throw new Error(`« ${answers.component} » is not a page block.`);
  const id = info.id;
  const title = answers.title ? { title: answers.title } : {};
  const needKind = () => {
    if (!shape) throw new Error(`« ${info.label.fr} » needs a kind.`);
    if (!fits(id, shape))
      throw new Error(
        `« ${info.label.fr} » needs ${(info.needs?.facets ?? []).join(', ')} on « ${shape.kind} ».`,
      );
    return shape;
  };
  const dated = shape ? facet(shape, 'dated') : undefined;
  // Which entries: the page's period, her time, her one value, and what the assistant wrote.
  if (answers.within && !dated)
    throw new Error(`« ${shape?.kind ?? '?'} » has no date to count over.`);
  if (answers.only && !shape?.fields.some((field) => field.name === answers.only!.field))
    throw new Error(`« ${answers.only.field} » is not a field of « ${shape?.kind ?? '?'} ».`);
  const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const inPeriod =
    [
      answers.inPeriod && dated ? `${dated.start} >= '{from}' and ${dated.start} < '{to}'` : null,
      answers.within && dated
        ? answers.within === 'month'
          ? `this_month(${dated.start})`
          : `last_days(${dated.start}, ${WITHIN_DAYS[answers.within]})`
        : null,
      answers.only ? `${answers.only.field} = ${quote(answers.only.value)}` : null,
      answers.where ? `(${answers.where})` : null,
    ]
      .filter(Boolean)
      .join(' and ') || undefined;
  const measure = (one: KindShape) => {
    const asked = answers.measure ?? 'count';
    if (asked === 'count') return { name: 'n', formula: 'count()' };
    if (!one.fields.some((field) => field.name === asked && NUMBERS.has(field.type)))
      throw new Error(`« ${asked} » is not a number of « ${one.kind} ».`);
    return { name: asked, formula: `sum(${asked})` };
  };
  const groupOf = (one: KindShape) => {
    const asked = answers.group;
    if (!asked) throw new Error(`« ${info.label.fr} » needs a field to group by.`);
    if (asked === 'month') {
      const when = facet(one, 'dated');
      if (!when) throw new Error(`« ${one.kind} » has no date to group by month.`);
      return `month(${when.start})`;
    }
    const field = one.fields.find((f) => f.name === asked);
    if (!field) throw new Error(`« ${asked} » is not a field of « ${one.kind} ».`);
    // Grouped by a link: by the title of the entry it points to (« fund.title »).
    return field.type === 'link' ? `${asked}.title` : asked;
  };
  const columns = (one: KindShape) => {
    const asked = answers.fields?.length ? answers.fields : choicesOf(one).fields.slice(0, 4);
    if (!asked.length) throw new Error(`« ${one.kind} » has no field to show.`);
    return asked;
  };
  let block: Record<string, unknown>;
  switch (id) {
    case 'stat': {
      const one = needKind();
      const m = measure(one);
      block = {
        block: id,
        query: {
          kind: one.kind,
          ...(inPeriod ? { where: inPeriod } : {}),
          aggregate: { [m.name]: m.formula },
        },
      };
      break;
    }
    case 'bar':
    case 'breakdown':
    case 'line': {
      const one = needKind();
      const m = measure(one);
      const by = id === 'line' ? `month(${facet(one, 'dated')!.start})` : groupOf(one);
      block = {
        block: id,
        query: {
          kind: one.kind,
          ...(inPeriod ? { where: inPeriod } : {}),
          groupBy: by,
          aggregate: { [m.name]: m.formula },
          ...(id === 'line' ? {} : { sort: `-${m.name}` }),
        },
      };
      break;
    }
    case 'gauge': {
      const one = needKind();
      const goal = facet(one, 'measurable')!;
      block = {
        block: id,
        kind: one.kind,
        value: goal.current ?? goal.target,
        max: goal.target,
      };
      break;
    }
    case 'funnel': {
      const one = needKind();
      const field = facet(one, 'stages')!.field;
      const steps = one.fields.find((f) => f.name === field)?.options ?? [];
      if (steps.length < 2) throw new Error(`« ${field} » has fewer than two steps.`);
      block = { block: id, kind: one.kind, by: field, steps: steps.slice(0, 8) };
      break;
    }
    case 'kanban': {
      const one = needKind();
      block = { block: id, kind: one.kind, by: facet(one, 'stages')!.field };
      break;
    }
    case 'heatmap': {
      const one = needKind();
      block = {
        block: id,
        kind: one.kind,
        date: facet(one, 'dated')!.start,
        days: answers.days ?? 35,
      };
      break;
    }
    case 'table': {
      const one = needKind();
      block = {
        block: id,
        query: {
          kind: one.kind,
          ...(inPeriod ? { where: inPeriod } : {}),
          fields: columns(one),
          limit: 50,
        },
      };
      break;
    }
    case 'datatable': {
      const one = needKind();
      block = {
        block: id,
        kind: one.kind,
        ...(inPeriod ? { where: inPeriod } : {}),
        columns: columns(one),
      };
      break;
    }
    case 'review': {
      const one = needKind();
      block = { block: id, kind: one.kind, ...(inPeriod ? { where: inPeriod } : {}) };
      break;
    }
    case 'form': {
      const one = needKind();
      block = { block: id, kind: one.kind };
      break;
    }
    case 'calendar':
      block = { block: id, days: Math.min(answers.days ?? 7, 31) };
      break;
    case 'highlights':
      block = { block: id, ...(answers.parts?.length ? { parts: answers.parts } : {}) };
      break;
    default:
      throw new Error(
        `« ${info.label.fr} » is not composed on screen: ask the assistant, who writes its settings.`,
      );
  }
  const parsed = blockSchema.safeParse({ ...block, ...title });
  if (!parsed.success)
    throw new Error(
      `« ${info.label.fr} »: ${parsed.error.issues.map((one) => `${one.path.join('.')}: ${one.message}`).join('; ')}`,
    );
  return parsed.data;
}

/** The blocks set on screen (spec 107); the others change by their name and size only. */
export const SETTABLE = new Set([
  'stat',
  'bar',
  'breakdown',
  'line',
  'gauge',
  'funnel',
  'kanban',
  'heatmap',
  'table',
  'datatable',
  'review',
  'form',
  'calendar',
  'highlights',
]);

/** The blocks whose settings are their query: set anew, nothing of the old one is kept. */
const BY_QUERY = new Set(['stat', 'bar', 'breakdown', 'line', 'table']);

const WITHIN_OF: Record<string, (typeof WITHIN)[number]> = { 92: '3m', 183: '6m', 366: '12m' };

/**
 * A block read back as her answers (spec 107), to set it on screen; null when it says more than
 * the answers can (a formula of its own): then only its name and size change there.
 */
export function answersOf(block: Block, shape: KindShape | null): Answers | null {
  if (!SETTABLE.has(block.block)) return null;
  const b = block as Record<string, unknown>;
  const query = (b.query ?? {}) as {
    kind?: string;
    where?: string;
    groupBy?: string;
    aggregate?: Record<string, string>;
    fields?: unknown[];
  };
  const title =
    typeof b.title === 'string' ? b.title : (b.title as { fr?: string } | undefined)?.fr;
  const kind = (b.kind as string | undefined) ?? query.kind;
  const answers: Answers = {
    component: block.block,
    ...(title ? { title } : {}),
    ...(kind ? { kind } : {}),
  };
  const formula = Object.values(query.aggregate ?? {})[0]?.trim();
  if (formula) {
    const sum = /^sum\((\w+)\)$/.exec(formula);
    if (sum) answers.measure = sum[1]!;
    else if (formula === 'count()') answers.measure = 'count';
    else return null;
  }
  if (query.groupBy) {
    if (/^month\(\w+\)$/.test(query.groupBy)) answers.group = 'month';
    else if (/^\w+$/.test(query.groupBy)) answers.group = query.groupBy;
    else {
      // By the title of a linked entry: the link itself, as the screen offers it.
      const linked = /^(\w+)\.title$/.exec(query.groupBy)?.[1];
      const link = shape?.fields.find((one) => one.name === linked && one.type === 'link');
      if (!link) return null;
      answers.group = link.name;
    }
  }
  const fields = query.fields ?? (b.columns as unknown[] | undefined);
  if (fields) {
    if (!fields.every((one) => typeof one === 'string' && /^\w+$/.test(one))) return null;
    answers.fields = fields as string[];
  }
  if (typeof b.days === 'number') answers.days = b.days;
  if (Array.isArray(b.parts)) answers.parts = b.parts as Answers['parts'];
  // Its condition, part by part: what the screen sets, then what the assistant wrote, kept.
  const where = (b.where as string | undefined) ?? query.where;
  if (where) {
    const date = shape?.facets.find((one) => one.facet === 'dated') as
      { start?: string } | undefined;
    const kept: string[] = [];
    for (const raw of where.split(/\s+and\s+/)) {
      const part = raw.trim().replace(/^\((.*)\)$/, '$1');
      const thisMonth = /^this_month\((\w+)\)$/.exec(part);
      const last = /^last_days\((\w+),\s*(\d+)\)$/.exec(part);
      const only = /^(\w+) = '((?:[^'\\]|\\.)*)'$/.exec(part);
      if (thisMonth && thisMonth[1] === date?.start) answers.within = 'month';
      else if (last && last[1] === date?.start && WITHIN_OF[last[2]!])
        answers.within = WITHIN_OF[last[2]!];
      else if (only && !answers.only)
        answers.only = { field: only[1]!, value: only[2]!.replace(/\\(.)/g, '$1') };
      else if (/'\{from\}'|'\{to\}'/.test(part)) answers.inPeriod = true;
      else kept.push(part);
    }
    if (kept.length) answers.where = kept.join(' and ');
  }
  // Offered only when the answers make the card again (a sum of a formula, a group by its title,
  // would not): then its name and size only.
  try {
    composeBlock(answers, shape);
  } catch {
    return null;
  }
  return answers;
}

/**
 * A block set anew from her answers (spec 107). A block of the same component keeps what composing
 * does not write — its gestures, its links, its other columns — unless its settings are its query;
 * its size stays, and its title in every language while she keeps its words.
 */
export function reshapeBlock(block: Block, answers: Answers, shape: KindShape | null): Block {
  const made = composeBlock(answers, shape) as Record<string, unknown>;
  const was = block as Record<string, unknown>;
  const same = made.block === block.block && !BY_QUERY.has(block.block);
  const out: Record<string, unknown> = same ? { ...was, ...made } : { ...made };
  if (same && !('where' in made)) delete out.where;
  // A card set by its query keeps its order (« -date ») while the column is still there.
  const before = was.query as { sort?: string } | undefined;
  const after = made.query as
    { sort?: string; aggregate?: Record<string, string>; fields?: unknown[] } | undefined;
  if (made.block === block.block && before?.sort && after && !after.sort) {
    const column = before.sort.replace(/^-/, '');
    const columns = [...Object.keys(after.aggregate ?? {}), ...(after.fields ?? [])];
    if (columns.includes(column)) out.query = { ...after, sort: before.sort };
  }
  if (was.size) out.size = was.size;
  if (block.block === 'stat' && made.block === 'stat' && was.unit) out.unit = was.unit;
  const wasTitle =
    typeof was.title === 'string' ? was.title : (was.title as { fr?: string } | undefined)?.fr;
  if (was.title && (!answers.title || answers.title === wasTitle)) out.title = was.title;
  return blockSchema.parse(out);
}
