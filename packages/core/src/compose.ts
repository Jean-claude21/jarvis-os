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
  const inPeriod =
    answers.inPeriod && dated
      ? `${dated.start} >= '{from}' and ${dated.start} < '{to}'`
      : undefined;
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
    if (!one.fields.some((field) => field.name === asked))
      throw new Error(`« ${asked} » is not a field of « ${one.kind} ».`);
    return asked;
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
