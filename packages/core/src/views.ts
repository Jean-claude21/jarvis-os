import { z } from 'zod';
import { readerOf, type EntryView, type Reader } from './compute';
import type { Tx } from './db';
import { evaluate, isScope, parse } from './formula';
import { labelSchema, type Label, type ModelField } from './models';
import { TIME_FIELDS } from './time';

// Views (spec 015): what she explores herself, as in Frappe or Notion — the entries of a kind,
// filtered on any field (through its links too), sorted, with the columns she picks, shown as a
// table, a kanban or a calendar. A view she keeps is an entry of kind « View »; one she is only
// trying is the same shape, never saved.

export const VIEW_KIND = 'View';

export type ViewType = 'table' | 'kanban' | 'calendar' | 'map' | 'gallery' | 'timeline' | 'tree';

export const OPERATORS = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'empty',
  'not_empty',
  'this_month',
  'last_days',
] as const;
export type Operator = (typeof OPERATORS)[number];

const path = z.string().trim().min(1).max(120);

export const viewDataSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  type: z
    .enum(['table', 'kanban', 'calendar', 'map', 'gallery', 'timeline', 'tree'])
    .default('table'),
  filters: z
    .array(
      z.object({
        field: path,
        op: z.enum(OPERATORS),
        value: z.union([z.string().max(200), z.number(), z.boolean()]).optional(),
      }),
    )
    .max(20)
    .default([]),
  sort: z
    .array(z.object({ field: path, desc: z.boolean().optional() }))
    .max(3)
    .default([]),
  columns: z.array(path).max(20).optional(),
  /** A table's groups: a field whose value heads each group. */
  groupBy: path.optional(),
  /** A kanban's columns: a choice field. */
  by: path.optional(),
  /** A calendar's day: a date field. */
  date: path.optional(),
  /** A map's place: a location field. */
  location: path.optional(),
  /** A gallery's picture: a file field. */
  image: path.optional(),
  /** A timeline's start and end: date or datetime fields (the end may be missing). */
  start: path.optional(),
  end: path.optional(),
  /** A tree's parent: a link to the same kind. */
  parent: path.optional(),
  app: z.string().trim().min(1).max(60).optional(),
  label: labelSchema.optional(),
  /** The view an app opens first for its kind. */
  default: z.boolean().optional(),
  limit: z.number().int().min(1).max(2000).optional(),
});
export type ViewData = z.input<typeof viewDataSchema>;

/** A view's shape, checked; throws a sentence that says what to fix. */
export function checkView(data: unknown): z.infer<typeof viewDataSchema> {
  const parsed = viewDataSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'view'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `A « ${VIEW_KIND} » is { kind, type: table|kanban|calendar, filters?: [{ field, op: ${OPERATORS.join('|')}, value? }], sort?: [{ field, desc? }], columns?, groupBy?, by?, date?, label?, default? } — ${issues}.`,
    );
  }
  return parsed.data;
}

const quote = (value: unknown) =>
  typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : `'${String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")}'`;
const pathOf = (field: string) =>
  field
    .split('.')
    .map((part) =>
      /^[\p{L}_][\p{L}\p{N}_]*$/u.test(part) ? part : `\`${part.replace(/`/g, '')}\``,
    )
    .join('.');

/** One filter as a formula: `fund.title = 'Courses'`, `this_month(date)`. */
export function filterFormula(filter: {
  field: string;
  op: Operator;
  value?: string | number | boolean | undefined;
}): string {
  const p = pathOf(filter.field);
  const v = quote(filter.value);
  switch (filter.op) {
    case 'eq':
      return `${p} = ${v}`;
    case 'ne':
      return `${p} != ${v}`;
    case 'gt':
      return `${p} > ${v}`;
    case 'gte':
      return `${p} >= ${v}`;
    case 'lt':
      return `${p} < ${v}`;
    case 'lte':
      return `${p} <= ${v}`;
    case 'contains':
      return `contains(${p}, ${v})`;
    case 'not_contains':
      return `not contains(${p}, ${v})`;
    case 'empty':
      return `(${p} = null or ${p} = '')`;
    case 'not_empty':
      return `not (${p} = null or ${p} = '')`;
    case 'this_month':
      return `this_month(${p})`;
    case 'last_days':
      return `last_days(${p}, ${Number(filter.value) || 30})`;
  }
}

/** A field she can filter, sort or show: on the kind, or one link away (`fund.title`). */
export interface ViewField {
  path: string;
  type: string;
  label: Label | null;
  options?: string[];
  optionLabels?: Record<string, Label>;
  /** The kind a link points to. */
  via?: string;
}

const plain = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(plain)
    : isScope(value)
      ? ((value as unknown as EntryView).row?.title ?? null)
      : (value ?? null);

function fieldsOf(reader: Reader, kind: string): ViewField[] {
  const model = reader.model(kind);
  const own = (model?.fields ?? []).filter((field) => !['lines', 'list'].includes(field.type));
  const describe = (field: ModelField, prefix = '', via?: string): ViewField => ({
    path: `${prefix}${field.name}`,
    type: field.type,
    label: field.label ?? null,
    ...(field.options ? { options: field.options } : {}),
    ...(field.optionLabels ? { optionLabels: field.optionLabels } : {}),
    ...(via ? { via } : {}),
  });
  const out: ViewField[] = [
    { path: 'title', type: 'text', label: null },
    ...own.map((field) => describe(field)),
  ];
  for (const link of own.filter(
    (field) => field.type === 'link' && field.target && field.cardinality !== 'many',
  )) {
    const target = reader.model(link.target!);
    out.push({
      path: `${link.name}.title`,
      type: 'text',
      label: link.label ?? null,
      via: link.target!,
    });
    for (const field of (target?.fields ?? []).filter(
      (one) => !['lines', 'list', 'link'].includes(one.type),
    )) {
      out.push(describe(field, `${link.name}.`, link.target!));
    }
  }
  if (!model) {
    for (const time of TIME_FIELDS)
      out.push({
        path: time,
        type: time === 'date' || time === 'due' ? 'date' : 'datetime',
        label: null,
      });
  }
  return out;
}

export interface ViewResult {
  kind: string;
  type: ViewType;
  /** What this kind can be shown as, from its model. */
  types: ViewType[];
  fields: ViewField[];
  columns: string[];
  rows: Record<string, unknown>[];
  groups?: { name: string; rows: Record<string, unknown>[] }[];
  kanban?: { by: string; columns: { name: string; items: { id: string; title: string }[] }[] };
  calendar?: { date: string; items: { id: string; title: string; day: string }[] };
  map?: {
    field: string;
    items: { id: string; title: string; lat: number; lng: number; address: string | null }[];
  };
  gallery?: { field: string; items: { id: string; title: string; file: string | null }[] };
  timeline?: {
    start: string;
    end: string | null;
    items: { id: string; title: string; start: string; end: string }[];
  };
  tree?: { parent: string; rows: (Record<string, unknown> & { depth: number })[] };
  /** Columns that are amounts or numbers, totalled. */
  totals: Record<string, number>;
  truncated: boolean;
  view: z.infer<typeof viewDataSchema>;
}

/** The entries of a view, filtered, sorted and shaped for its type. */
export async function runView(
  tx: Tx,
  spaceId: string,
  raw: ViewData,
  clock = { now: new Date() },
): Promise<ViewResult> {
  const view = checkView(raw);
  const reader = await readerOf(tx, spaceId, clock);
  const fields = fieldsOf(reader, view.kind);
  const known = new Map(fields.map((field) => [field.path, field]));
  const types: ViewResult['types'] = ['table'];
  if (fields.some((field) => field.type === 'choice' && !field.via)) types.push('kanban');
  if (fields.some((field) => ['date', 'datetime'].includes(field.type) && !field.via))
    types.push('calendar', 'timeline');
  if (fields.some((field) => field.type === 'location' && !field.via)) types.push('map');
  if (fields.some((field) => field.type === 'file' && !field.via)) types.push('gallery');
  const selfLink = reader
    .model(view.kind)
    ?.fields.find(
      (field) =>
        field.type === 'link' &&
        field.target &&
        field.target.toLowerCase() === view.kind.toLowerCase(),
    );
  if (selfLink) types.push('tree');

  const type = types.includes(view.type) ? view.type : 'table';
  const by = view.by ?? fields.find((field) => field.type === 'choice' && !field.via)?.path;
  const date =
    view.date ??
    fields.find((field) => ['date', 'datetime'].includes(field.type) && !field.via)?.path;
  const own = (types: string[]) =>
    fields.find((field) => types.includes(field.type) && !field.via)?.path;
  const location = view.location ?? own(['location']);
  const image = view.image ?? own(['file']);
  const start = view.start ?? own(['date', 'datetime']);
  const end =
    view.end ??
    fields.find(
      (field) =>
        ['date', 'datetime'].includes(field.type) &&
        !field.via &&
        field.path !== start &&
        /end|fin|until/i.test(field.path),
    )?.path;
  const parent = view.parent ?? selfLink?.name;
  const where = view.filters.map((filter) => parse(filterFormula(filter)));
  const rows = await reader.kindRows(view.kind, view.limit ?? 2000);
  await reader.around(rows.map((row) => row.id));
  const matching: EntryView[] = [];
  for (const row of rows) {
    const one = reader.view(row);
    let keep = true;
    for (const tree of where) {
      if (!(await evaluate(tree, one, reader.clock))) {
        keep = false;
        break;
      }
    }
    if (keep) matching.push(one);
  }

  const model = reader.model(view.kind);
  const columns = (
    view.columns ??
    model?.columns ??
    fields
      .filter((field) => !field.via && field.path !== 'title' && field.type !== 'link')
      .slice(0, 5)
      .map((field) => field.path)
  ).filter((column) => column !== 'title');
  const wanted = [
    ...new Set(
      [
        ...columns,
        ...view.sort.map((one) => one.field),
        view.groupBy,
        type === 'kanban' ? by : undefined,
        type === 'calendar' ? date : undefined,
        type === 'map' ? location : undefined,
        type === 'gallery' ? image : undefined,
        type === 'timeline' ? start : undefined,
        type === 'timeline' ? end : undefined,
      ].filter((one): one is string => !!one),
    ),
  ];
  const trees = new Map(wanted.map((column) => [column, parse(pathOf(column))]));
  const lines: Record<string, unknown>[] = [];
  for (const one of matching) {
    const line: Record<string, unknown> = { id: one.row.id, title: one.row.title };
    for (const [column, tree] of trees)
      line[column] = plain(await evaluate(tree, one, reader.clock));
    lines.push(line);
  }

  const sorts = view.sort.length ? view.sort : [{ field: 'title', desc: false }];
  lines.sort((a, b) => {
    for (const { field, desc } of sorts) {
      const x = a[field];
      const y = b[field];
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const order =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      if (order) return desc ? -order : order;
    }
    return 0;
  });

  const totals: Record<string, number> = {};
  for (const column of columns) {
    const field = known.get(column);
    if (
      field &&
      ['amount', 'number', 'formula'].includes(field.type) &&
      lines.some((line) => typeof line[column] === 'number')
    ) {
      totals[column] = lines.reduce(
        (sum, line) => sum + (typeof line[column] === 'number' ? (line[column] as number) : 0),
        0,
      );
    }
  }

  const result: ViewResult = {
    kind: view.kind,
    type,
    types,
    fields,
    columns: ['title', ...columns],
    rows: lines.slice(0, 500),
    totals,
    truncated: lines.length > 500,
    view,
  };
  if (view.groupBy) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const line of lines) {
      const value = line[view.groupBy];
      const key =
        value === null || value === undefined || value === ''
          ? '—'
          : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
            ? value.slice(0, 7)
            : String(value);
      groups.set(key, [...(groups.get(key) ?? []), line]);
    }
    result.groups = [...groups].map(([name, rows]) => ({ name, rows }));
  }
  if (type === 'kanban' && by) {
    const options = known.get(by)?.options ?? [];
    const columnsOf = new Map<string, { id: string; title: string }[]>(
      options.map((option) => [option, []]),
    );
    for (const line of lines) {
      const value = String(line[by] ?? '—');
      columnsOf.set(value, [
        ...(columnsOf.get(value) ?? []),
        { id: String(line.id), title: String(line.title) },
      ]);
    }
    result.kanban = {
      by,
      columns: [...columnsOf].map(([name, items]) => ({ name, items: items.slice(0, 200) })),
    };
  }
  if (type === 'calendar' && date) {
    const items = lines.flatMap((line) => {
      const value = line[date];
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? [{ id: String(line.id), title: String(line.title), day: value.slice(0, 10) }]
        : [];
    });
    result.calendar = { date, items };
  }
  if (type === 'map' && location) {
    const items = lines.flatMap((line) => {
      const place = line[location] as { lat?: unknown; lng?: unknown; address?: unknown } | null;
      return place && typeof place.lat === 'number' && typeof place.lng === 'number'
        ? [
            {
              id: String(line.id),
              title: String(line.title),
              lat: place.lat,
              lng: place.lng,
              address: typeof place.address === 'string' ? place.address : null,
            },
          ]
        : [];
    });
    result.map = { field: location, items };
  }
  if (type === 'gallery' && image) {
    result.gallery = {
      field: image,
      items: lines.map((line) => ({
        id: String(line.id),
        title: String(line.title),
        file:
          ([line[image]].flat().find((one) => typeof one === 'string') as string | null) ?? null,
      })),
    };
  }
  if (type === 'timeline' && start) {
    const items = lines.flatMap((line) => {
      const from = typeof line[start] === 'string' ? String(line[start]).slice(0, 10) : null;
      if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return [];
      const to = end && typeof line[end] === 'string' ? String(line[end]).slice(0, 10) : from;
      return [
        { id: String(line.id), title: String(line.title), start: from, end: to < from ? from : to },
      ];
    });
    items.sort((a, b) => a.start.localeCompare(b.start));
    result.timeline = { start, end: end ?? null, items };
  }
  if (type === 'tree' && parent) {
    // Each entry under the one its parent link names; those without a parent at the top.
    const parentOf = new Map<string, string | null>();
    for (const one of matching) {
      const up = await one.get(parent);
      parentOf.set(one.row.id, isScopeLike(up) ? up.row.id : null);
    }
    const byId = new Map(lines.map((line) => [String(line.id), line]));
    const children = new Map<string | null, Record<string, unknown>[]>();
    for (const line of lines) {
      const up = parentOf.get(String(line.id)) ?? null;
      const key = up && byId.has(up) ? up : null;
      children.set(key, [...(children.get(key) ?? []), line]);
    }
    const rows: (Record<string, unknown> & { depth: number })[] = [];
    const walk = (key: string | null, depth: number) => {
      for (const line of children.get(key) ?? []) {
        if (rows.length > 1000 || depth > 12) return;
        rows.push({ ...line, depth });
        walk(String(line.id), depth + 1);
      }
    };
    walk(null, 0);
    result.tree = { parent, rows };
  }
  return result;
}

const isScopeLike = (value: unknown): value is EntryView =>
  !!value &&
  typeof value === 'object' &&
  'row' in value &&
  typeof (value as EntryView).get === 'function';

/** The views kept in a space (of one kind, of one app). */
export async function viewsOf(
  tx: Tx,
  spaceId: string,
  filter: { kind?: string | undefined; app?: string | undefined } = {},
) {
  const { rows } = await tx.query<{ id: string; title: string; data: Record<string, unknown> }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'view'
        and ($2::text is null or jarvis_fold(data->>'kind') = jarvis_fold($2))
        and ($3::text is null or jarvis_fold(coalesce(data->>'app', '')) = jarvis_fold($3))
      order by title`,
    [spaceId, filter.kind ?? null, filter.app ?? null],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: String(row.data.kind ?? ''),
    type: String(row.data.type ?? 'table'),
    label: (row.data.label as Label | undefined) ?? null,
    default: row.data.default === true,
  }));
}
