import { z } from 'zod';
import type { EntryView, Reader } from './compute';
import { evaluate, isScope, parse, type Node, type Scope } from './formula';

// Declarative queries (spec 014): what a page block asks — a kind, which entries (`where`), how to
// group them, what to compute per group — written over models and formulas, never SQL. Raw SQL
// (`query`, decision 0004) stays for what this cannot say.

export const requestSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  /** A formula each entry must hold; `{month}` and other page filters are put in as text. */
  where: z.string().trim().min(1).max(2000).optional(),
  /** A formula giving each entry's group: « month(date) », « fonds.title », « nature ». */
  groupBy: z.string().trim().min(1).max(500).optional(),
  /** What to compute per group (or over all): `{ total: "sum(montant)", n: "count()" }`. */
  aggregate: z.record(z.string().trim().min(1).max(60), z.string().trim().min(1).max(1000)).optional(),
  /** Without `aggregate`: what to show of each entry, by name or formula. */
  fields: z
    .array(z.union([z.string().trim().min(1).max(500), z.object({ name: z.string().min(1).max(60), formula: z.string().min(1).max(1000) })]))
    .max(20)
    .optional(),
  /** A column to sort by, « -total » for the largest first. */
  sort: z.string().trim().min(1).max(60).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});
export type Request = z.infer<typeof requestSchema>;

export interface RequestResult {
  columns: string[];
  rows: Record<string, unknown>[];
  /** More rows matched than the limit. */
  truncated: boolean;
}

const AGGREGATES = new Set(['sum', 'avg', 'count', 'min', 'max', 'streak']);

/** Puts the page's filters in a formula: `{month}` becomes « '2026-10' ». */
export function withParams(formula: string, params: Record<string, string>): string {
  return formula.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(name in params)) throw new Error(`« {${name}} » is not a filter of this page (${Object.keys(params).join(', ') || 'none'}).`);
    return `'${String(params[name]).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  });
}

/** In an aggregate, names go over the group's rows: `sum(montant)` is `sum(rows.montant)`. */
function overRows(node: Node, inside = false): Node {
  switch (node.t) {
    case 'call': {
      const aggregate = AGGREGATES.has(node.name);
      if (aggregate && node.args.length === 0) return { ...node, args: [{ t: 'path', parts: ['rows'] }] };
      const args = node.args.map((arg, index) => {
        if (aggregate && index === 0 && node.args.length === 1 && arg.t === 'path' && arg.parts[0] !== 'rows') {
          return { ...arg, parts: ['rows', ...arg.parts] };
        }
        return overRows(arg, inside || aggregate);
      });
      return { ...node, args };
    }
    case 'binary':
      return { ...node, left: overRows(node.left, inside), right: overRows(node.right, inside) };
    case 'not':
    case 'neg':
      return { ...node, arg: overRows(node.arg, inside) };
    default:
      return node;
  }
}

const shown = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shown);
  if (isScope(value)) {
    const view = value as unknown as EntryView;
    return view.row ? view.row.title : null;
  }
  return value ?? null;
};

/** The rows of a declarative query, from a reader of the space. */
export async function runRequest(reader: Reader, raw: Request, params: Record<string, string> = {}): Promise<RequestResult> {
  const request = requestSchema.parse(raw);
  const where = request.where ? parse(withParams(request.where, params)) : null;
  const rows = await reader.kindRows(request.kind);
  await reader.around(rows.map((row) => row.id));
  const views: EntryView[] = [];
  for (const row of rows) {
    const view = reader.view(row);
    if (!where || (await evaluate(where, view, reader.clock))) views.push(view);
  }

  let columns: string[];
  let out: Record<string, unknown>[];
  if (request.aggregate || request.groupBy) {
    const aggregate = request.aggregate ?? { count: 'count()' };
    const trees = Object.entries(aggregate).map(([name, formula]) => [name, overRows(parse(withParams(formula, params)))] as const);
    const groups = new Map<string, EntryView[]>();
    const keyOf = request.groupBy ? parse(withParams(request.groupBy, params)) : null;
    for (const view of views) {
      const key = keyOf ? shown(await evaluate(keyOf, view, reader.clock)) : '';
      const label = key === null || key === undefined || key === '' ? (keyOf ? '—' : '') : String(key);
      groups.set(label, [...(groups.get(label) ?? []), view]);
    }
    if (!keyOf && !groups.size) groups.set('', []);
    out = [];
    for (const [group, members] of groups) {
      const scope: Scope = { get: (name) => (name === 'rows' ? members : null) };
      const line: Record<string, unknown> = keyOf ? { group } : {};
      for (const [name, tree] of trees) line[name] = shown(await evaluate(tree, scope, reader.clock));
      out.push(line);
    }
    columns = [...(keyOf ? ['group'] : []), ...Object.keys(aggregate)];
    if (keyOf && !request.sort) out.sort((a, b) => String(a.group).localeCompare(String(b.group)));
  } else {
    const model = reader.model(request.kind);
    const fields = (
      request.fields ??
      model?.columns ??
      model?.fields
        .filter((field) => !['lines', 'list'].includes(field.type))
        .slice(0, 6)
        .map((field) => field.name) ??
      []
    ).map((one) => (typeof one === 'string' ? { name: one, formula: one } : one));
    const trees = fields.map((field) => [field.name, parse(withParams(field.formula, params))] as const);
    out = [];
    for (const view of views) {
      const line: Record<string, unknown> = { id: view.row.id, title: view.row.title };
      for (const [name, tree] of trees) line[name] = shown(await evaluate(tree, view, reader.clock));
      out.push(line);
    }
    columns = ['title', ...fields.map((field) => field.name)];
  }

  if (request.sort) {
    const descending = request.sort.startsWith('-');
    const key = request.sort.replace(/^-/, '');
    out.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return descending ? -order : order;
    });
  }
  const limit = request.limit ?? 500;
  return { columns, rows: out.slice(0, limit), truncated: out.length > limit };
}
