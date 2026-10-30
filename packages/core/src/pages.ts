import { z } from 'zod';
import { agenda } from './agenda';
import { readerOf, type EntryView, type Reader } from './compute';
import type { Tx } from './db';
import { evaluate, isScope, parse, todayOf, type Clock } from './formula';
import { labelSchema, type Label } from './models';
import { query } from './query';
import { requestSchema, runRequest, withParams } from './request';
import { runView, viewDataSchema } from './views';

// Pages (spec 014): what an app shows, declared — filters and blocks — computed by the core and
// drawn by one renderer, in the app and inside Claude. A page is an entry of kind « Page »; its
// title is its name, `data.app` the app it belongs to.

export const PAGE_KIND = 'Page';

/** A title: one text, or one per language `{ fr, en }`. */
const title = z.union([z.string().trim().min(1).max(120), labelSchema]).optional();
const formula = z.string().trim().min(1).max(1000);
const kind = z.string().trim().min(1).max(80);

export const blockSchema = z.discriminatedUnion('block', [
  /** One figure: a query's first row, `value` its column (the first one by default). */
  z.object({
    block: z.literal('stat'),
    title,
    query: requestSchema,
    value: z.string().optional(),
    unit: z.string().max(20).optional(),
  }),
  /** One figure and how it moved since the previous month (the query uses `{month}`). */
  z.object({
    block: z.literal('stat_delta'),
    title,
    query: requestSchema,
    value: z.string().optional(),
    unit: z.string().max(20).optional(),
  }),
  /** One gauge per entry: `value` against `max`, each a formula of the entry. */
  z.object({
    block: z.literal('gauge'),
    title,
    kind,
    where: formula.optional(),
    value: formula,
    max: formula,
    label: formula.optional(),
  }),
  /** Bars, a line over time, or the share of each: a grouped query. */
  z.object({
    block: z.enum(['bar', 'line', 'breakdown']),
    title,
    query: requestSchema,
    label: z.string().optional(),
    value: z.string().optional(),
  }),
  /** The days something was done, the last `days` days. */
  z.object({
    block: z.literal('heatmap'),
    title,
    kind,
    where: formula.optional(),
    date: formula.default('date'),
    days: z.number().int().min(7).max(366).default(35),
  }),
  /** Entries in a table; `total` a column to add up. */
  z.object({
    block: z.literal('table'),
    title,
    query: requestSchema,
    total: z.string().optional(),
  }),
  /** Entries to act on, each with one gesture: the fields `set` sets. */
  z.object({
    block: z.literal('task_list'),
    title,
    kind,
    where: formula.optional(),
    detail: formula.optional(),
    action: z.object({
      label: z.string().trim().min(1).max(40),
      set: z.record(z.string(), z.unknown()),
    }),
  }),
  /** Entries in columns by a choice field. */
  z.object({
    block: z.literal('kanban'),
    title,
    kind,
    by: z.string().trim().min(1).max(60),
    where: formula.optional(),
  }),
  /** The days ahead of her calendar. */
  z.object({
    block: z.literal('calendar'),
    title,
    days: z.number().int().min(1).max(31).default(7),
  }),
  /** A form to add an entry of a kind, from its model. */
  z.object({ block: z.literal('form'), title, kind }),
  /** The escape hatch (decision 0004): one `select` over her copies, drawn as a figure, bars, a line or a table. */
  z.object({
    block: z.literal('sql'),
    title,
    sql: z.string().trim().min(1).max(10_000),
    chart: z.enum(['number', 'bar', 'line', 'table']).default('table'),
  }),
  /** One entry with its fields, formulas and relations (a record page: `{record}` is its id). */
  z.object({
    block: z.literal('record'),
    title,
    kind,
    relations: z.array(z.string().min(1).max(60)).max(10).optional(),
  }),
  /** A view of a kind inside the page (spec 016): table, kanban, calendar, map, gallery, timeline, tree. */
  z.object({ block: z.literal('view'), title, view: viewDataSchema }),
]);
export type Block = z.infer<typeof blockSchema>;

export const pageDataSchema = z.object({
  app: z.string().trim().min(1).max(60).optional(),
  /** What she can choose on the page; `{name}` puts the choice in the blocks' formulas. */
  filters: z
    .array(
      z.object({
        name: z.string().trim().regex(/^\w+$/).max(40),
        type: z.enum(['month', 'choice', 'text', 'record']),
        options: z.array(z.string().min(1).max(80)).max(100).optional(),
        default: z.string().max(80).optional(),
        label: z.union([z.string().max(60), labelSchema]).optional(),
      }),
    )
    .max(6)
    .default([]),
  blocks: z.array(blockSchema).min(1).max(24),
  /** What the page reads as in the app: `{ fr: 'Vue du mois', en: 'Month overview' }`. */
  label: labelSchema.optional(),
  /** Its place among the app's pages. */
  order: z.number().int().optional(),
});
export type PageData = z.infer<typeof pageDataSchema>;

/** A page's shape, checked; throws a sentence that says what to fix. */
export function checkPage(data: unknown): PageData {
  const parsed = pageDataSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'page'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `A « ${PAGE_KIND} » is { app?, filters?: [{ name, type: month|choice|text|record, options?, default? }], blocks: [{ block: stat|stat_delta|gauge|bar|line|breakdown|heatmap|table|task_list|kanban|calendar|form|record|sql|view, … }] } — ${issues}.`,
    );
  }
  for (const block of parsed.data.blocks) {
    for (const one of [
      'where' in block ? block.where : undefined,
      'value' in block && block.block === 'gauge' ? block.value : undefined,
      'max' in block ? block.max : undefined,
      'label' in block && block.block === 'gauge' ? block.label : undefined,
      'detail' in block ? block.detail : undefined,
    ]) {
      if (one) parse(one.replace(/\{(\w+)\}/g, "''"));
    }
  }
  return parsed.data;
}

const monthOf = (day: string) => day.slice(0, 7);
const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

/** A block, computed: what the renderer draws. */
export type DrawnBlock = Record<string, unknown> & {
  block: string;
  title: string | Label | null;
  kind?: string;
  error?: string;
};

export interface DrawnPage {
  id: string;
  title: string;
  app: string | null;
  spaceId: string;
  filters: (PageData['filters'][number] & { value: string })[];
  params: Record<string, string>;
  label: Label | null;
  blocks: DrawnBlock[];
  /** How each kind and its fields read in her language, for the view. */
  vocabulary: Record<
    string,
    {
      label: Label | null;
      fields: Record<string, { label: Label | null; options: Record<string, Label> }>;
    }
  >;
  computedAt: string;
}

const plain = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(plain);
  if (isScope(value)) return (value as unknown as EntryView).row?.title ?? null;
  return value ?? null;
};

async function drawBlock(
  reader: Reader,
  tx: Tx,
  block: Block,
  params: Record<string, string>,
): Promise<DrawnBlock> {
  const kindOf = 'query' in block ? block.query.kind : 'kind' in block ? block.kind : undefined;
  const groupField =
    'query' in block && block.query.groupBy && /^[\p{L}\p{N}_]+$/u.test(block.query.groupBy)
      ? block.query.groupBy
      : undefined;
  const base = {
    block: block.block,
    title: block.title ?? null,
    ...(kindOf ? { kind: kindOf } : {}),
    ...(groupField ? { groupField } : {}),
  };
  const filtered = async (kindName: string, where?: string) => {
    const tree = where ? parse(withParams(where, params)) : null;
    const rows = await reader.kindRows(kindName, 2000);
    await reader.around(rows.map((row) => row.id));
    const out: EntryView[] = [];
    for (const row of rows) {
      const view = reader.view(row);
      if (!tree || (await evaluate(tree, view, reader.clock))) out.push(view);
    }
    return out;
  };
  switch (block.block) {
    case 'stat': {
      const result = await runRequest(reader, block.query, params);
      const column =
        block.value ?? result.columns.find((one) => one !== 'group') ?? result.columns[0]!;
      return { ...base, value: result.rows[0]?.[column] ?? null, unit: block.unit ?? null };
    }
    case 'stat_delta': {
      const month = params.month ?? monthOf(todayOf(reader.clock));
      const now = await runRequest(reader, block.query, { ...params, month });
      const before = await runRequest(reader, block.query, {
        ...params,
        month: previousMonth(month),
      });
      const column = block.value ?? now.columns.find((one) => one !== 'group') ?? now.columns[0]!;
      const value = now.rows[0]?.[column] ?? null;
      const previous = before.rows[0]?.[column] ?? null;
      const delta =
        typeof value === 'number' && typeof previous === 'number' && previous !== 0
          ? Math.round(((value - previous) / Math.abs(previous)) * 1000) / 10
          : null;
      return { ...base, value, previous, delta, unit: block.unit ?? null };
    }
    case 'gauge': {
      const views = await filtered(block.kind, block.where);
      const value = parse(block.value);
      const max = parse(block.max);
      const label = block.label ? parse(block.label) : null;
      const items = [];
      for (const view of views.slice(0, 30)) {
        items.push({
          id: view.row.id,
          label: label ? plain(await evaluate(label, view, reader.clock)) : view.row.title,
          value: plain(await evaluate(value, view, reader.clock)),
          max: plain(await evaluate(max, view, reader.clock)),
        });
      }
      return { ...base, items };
    }
    case 'bar':
    case 'line':
    case 'breakdown': {
      const result = await runRequest(reader, block.query, params);
      const label = block.label ?? result.columns[0]!;
      const value = block.value ?? result.columns.find((one) => one !== label) ?? label;
      const number = (one: unknown) => (typeof one === 'number' ? one : Number(one) || 0);
      // Every number column is a series (spec 016): a line can compare entrées and sorties.
      const columns = result.columns.filter(
        (one) => one !== label && result.rows.some((row) => typeof row[one] === 'number'),
      );
      return {
        ...base,
        points: result.rows.map((row) => ({ label: row[label] ?? '—', value: number(row[value]) })),
        series: (block.value ? [value] : columns.length ? columns : [value]).map((name) => ({
          name,
          points: result.rows.map((row) => ({
            label: row[label] ?? '—',
            value: number(row[name]),
          })),
        })),
      };
    }
    case 'view': {
      const result = await runView(tx, reader.spaceId, block.view, reader.clock);
      return { ...base, kind: block.view.kind, result: { ...result, fields: [] } };
    }
    case 'heatmap': {
      const views = await filtered(block.kind, block.where);
      const date = parse(block.date);
      const days = new Set<string>();
      for (const view of views) {
        const value = plain(await evaluate(date, view, reader.clock));
        for (const one of [value].flat()) if (typeof one === 'string') days.add(one.slice(0, 10));
      }
      const today = todayOf(reader.clock);
      const end = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
      const cells = Array.from({ length: block.days }, (_, index) => {
        const day = new Date(end - (block.days - 1 - index) * 86_400_000)
          .toISOString()
          .slice(0, 10);
        return { day, done: days.has(day) };
      });
      return { ...base, cells, done: cells.filter((cell) => cell.done).length };
    }
    case 'table': {
      const result = await runRequest(reader, block.query, params);
      const total =
        block.total && result.columns.includes(block.total)
          ? result.rows.reduce(
              (sum, row) =>
                sum + (typeof row[block.total!] === 'number' ? (row[block.total!] as number) : 0),
              0,
            )
          : null;
      return {
        ...base,
        columns: result.columns,
        rows: result.rows,
        truncated: result.truncated,
        total: block.total ?? null,
        totalValue: total,
      };
    }
    case 'task_list': {
      const views = await filtered(block.kind, block.where);
      const detail = block.detail ? parse(block.detail) : null;
      const items = [];
      for (const view of views.slice(0, 50)) {
        items.push({
          id: view.row.id,
          title: view.row.title,
          detail: detail ? plain(await evaluate(detail, view, reader.clock)) : null,
        });
      }
      return { ...base, items, action: block.action };
    }
    case 'kanban': {
      const views = await filtered(block.kind, block.where);
      const field = reader.model(block.kind)?.fields.find((one) => one.name === block.by);
      const columns: Record<string, { id: string; title: string }[]> = {};
      for (const option of field?.options ?? []) columns[option] = [];
      for (const view of views.slice(0, 300)) {
        const value = String((await view.get(block.by)) ?? '—');
        (columns[value] ??= []).push({ id: view.row.id, title: view.row.title });
      }
      return {
        ...base,
        by: block.by,
        columns: Object.entries(columns).map(([name, items]) => ({ name, items })),
      };
    }
    case 'calendar': {
      const from = new Date(reader.clock.now.getTime());
      from.setUTCHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + block.days * 86_400_000);
      const occurrences = await agenda(tx, [reader.spaceId], { from, to, today: reader.clock.now });
      return { ...base, occurrences: occurrences.slice(0, 100) };
    }
    case 'form': {
      const model = reader.model(block.kind);
      return {
        ...base,
        kind: block.kind,
        fields:
          model?.fields.filter((one) => !['formula', 'lines', 'list'].includes(one.type)) ?? [],
      };
    }
    case 'sql': {
      // Filters reach it as quoted text: « where to_char(…) = {month} ».
      const sql = block.sql.replace(/\{(\w+)\}/g, (_, name: string) => {
        if (!(name in params)) throw new Error(`« {${name}} » is not a filter of this page.`);
        return `'${String(params[name]).replace(/'/g, "''")}'`;
      });
      const result = await query(tx, { spaceIds: [reader.spaceId], sql });
      return { ...base, chart: block.chart, ...result };
    }
    case 'record': {
      const id = params.record;
      if (!id) return { ...base, record: null };
      const [row] = await reader.rowsOf([id]);
      if (!row) return { ...base, record: null };
      const view = reader.view(row);
      await reader.around([id]);
      const model = reader.model(row.kind);
      const fields: { name: string; value: unknown; computed: boolean }[] = [];
      for (const field of model?.fields ?? []) {
        if (['lines'].includes(field.type)) continue;
        fields.push({
          name: field.name,
          value: plain(await view.get(field.name)),
          computed: field.type === 'formula',
        });
      }
      const relations = [];
      for (const name of block.relations ?? []) {
        const value = await view.get(name);
        const list = [value].flat().filter(isScope) as unknown as EntryView[];
        const relatedModel = list[0] ? reader.model(list[0].row.kind) : undefined;
        const columns =
          relatedModel?.columns ??
          relatedModel?.fields
            .filter((one) => !['link', 'lines', 'list'].includes(one.type))
            .slice(0, 4)
            .map((one) => one.name) ??
          [];
        const rows = [];
        for (const one of list.slice(0, 200)) {
          const line: Record<string, unknown> = { id: one.row.id, title: one.row.title };
          for (const column of columns) line[column] = plain(await one.get(column));
          rows.push(line);
        }
        relations.push({
          name,
          kind: list[0]?.row.kind ?? null,
          columns: ['title', ...columns],
          rows,
        });
      }
      return {
        ...base,
        record: { id: row.id, kind: row.kind, title: row.title, fields, relations },
      };
    }
  }
}

/** A page computed for her filters: every block, each failing alone and saying why. */
export async function renderPage(
  tx: Tx,
  spaceId: string,
  page: { id: string; title: string; data: unknown },
  given: Record<string, string> = {},
  clock: Clock = { now: new Date() },
): Promise<DrawnPage> {
  const data = checkPage(page.data);
  const reader = await readerOf(tx, spaceId, clock);
  const today = todayOf(clock);
  const filters = data.filters.map((filter) => {
    const value =
      given[filter.name] ??
      filter.default ??
      (filter.type === 'month'
        ? monthOf(today)
        : filter.type === 'choice'
          ? (filter.options?.[0] ?? '')
          : '');
    return {
      ...filter,
      value: filter.type === 'month' && value === 'current' ? monthOf(today) : value,
    };
  });
  const params: Record<string, string> = Object.fromEntries(
    filters.map((filter) => [filter.name, filter.value]),
  );
  if (given.record) params.record = given.record;
  const blocks: DrawnBlock[] = [];
  for (const block of data.blocks) {
    try {
      blocks.push(await drawBlock(reader, tx, block, params));
    } catch (error) {
      blocks.push({
        block: block.block,
        title: block.title ?? null,
        error: (error as Error).message,
      });
    }
  }
  return {
    id: page.id,
    title: page.title,
    app: data.app ?? null,
    spaceId,
    filters,
    params,
    label: data.label ?? null,
    blocks,
    vocabulary: Object.fromEntries(
      reader.allModels().map((model) => [
        model.kind,
        {
          label: model.label ?? null,
          fields: Object.fromEntries(
            model.fields.map((field) => [
              field.name,
              { label: field.label ?? null, options: field.optionLabels ?? {} },
            ]),
          ),
        },
      ]),
    ),
    computedAt: clock.now.toISOString(),
  };
}

/** The pages of a space (of one app if given), in their order. */
export async function pagesOf(
  tx: Tx,
  spaceId: string,
  app?: string,
): Promise<
  { id: string; title: string; label: Label | null; app: string | null; order: number }[]
> {
  const { rows } = await tx.query<{ id: string; title: string; data: Record<string, unknown> }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
      order by title`,
    [spaceId, PAGE_KIND],
  );
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      label:
        row.data.label && typeof row.data.label === 'object' ? (row.data.label as Label) : null,
      app: typeof row.data.app === 'string' ? row.data.app : null,
      order: typeof row.data.order === 'number' ? row.data.order : 100,
    }))
    .filter((page) => !app || (page.app ?? '').toLowerCase() === app.toLowerCase())
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** The record page of an entry: its fields, formulas and every relation its models declare. */
export async function renderRecord(
  tx: Tx,
  spaceId: string,
  id: string,
  clock: Clock = { now: new Date() },
): Promise<DrawnPage | null> {
  const reader = await readerOf(tx, spaceId, clock);
  const [row] = await reader.rowsOf([id]);
  if (!row) return null;
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const relations = [
    ...(reader
      .model(row.kind)
      ?.fields.filter((field) => field.type === 'link')
      .map((field) => field.name) ?? []),
    ...reader
      .allModels()
      .flatMap((model) => model.fields)
      .filter(
        (field) =>
          field.type === 'link' &&
          field.inverse &&
          field.target &&
          fold(field.target) === fold(row.kind),
      )
      .map((field) => field.inverse!),
  ].slice(0, 10);
  return renderPage(
    tx,
    spaceId,
    {
      id: `record:${id}`,
      title: row.title,
      data: { blocks: [{ block: 'record', kind: row.kind, relations }] },
    },
    { record: id },
    clock,
  );
}
