import type { Tx } from './db';
import { evaluate, parse, type Clock, type Node, type Scope } from './formula';
import { MODEL_KIND, modelsOf, type Model, type ModelField } from './models';
import { zoneOf } from './zone';

// What an app reads (spec 014): an entry seen through its model — its fields, its relations both
// ways, its lines, and its formulas computed now, never stored. One `Reader` per request keeps the
// space's links and models once, and loads entries in batches as relations are followed.

export interface EntryRow {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const MAX_DEPTH = 8;

/** A line of a `lines` field, read by name. */
class LineView implements Scope {
  constructor(private readonly line: Record<string, unknown>) {}
  get(name: string) {
    return this.line[name] ?? null;
  }
}

/** An entry, read by name: a field, a relation (one entry or a list), a line list, a formula. */
export class EntryView implements Scope {
  private readonly cache = new Map<string, unknown>();
  private readonly computing = new Set<string>();
  constructor(
    readonly reader: Reader,
    readonly row: EntryRow,
    private readonly depth = 0,
  ) {}

  get model(): Model | undefined {
    return this.reader.model(this.row.kind);
  }

  async get(name: string): Promise<unknown> {
    const key = fold(name);
    if (this.cache.has(key)) return this.cache.get(key);
    // A formula that comes back to itself reads nothing rather than waiting for ever.
    if (this.computing.has(key)) return null;
    this.computing.add(key);
    try {
      const value = await this.read(name);
      this.cache.set(key, value);
      return value;
    } finally {
      this.computing.delete(key);
    }
  }

  private async read(name: string): Promise<unknown> {
    const key = fold(name);
    if (key === 'id') return this.row.id;
    if (key === 'title' || key === 'titre') return this.row.title;
    if (key === 'kind') return this.row.kind;
    if (key === 'created') return this.row.createdAt.slice(0, 10);
    if (key === 'updated') return this.row.updatedAt.slice(0, 10);
    const field = this.model?.fields.find((one) => fold(one.name) === key);
    if (field) return this.field(field);
    const inverse = this.reader.inverseOf(this.row.kind, name);
    if (inverse)
      return this.reader.related(this.row.id, inverse.role, 'in', inverse.kind, this.depth);
    const own = Object.keys(this.row.data).find((one) => fold(one) === key);
    if (own !== undefined) return this.row.data[own] ?? null;
    // A relation without a model: a link of that role, the other way if none goes out.
    const out = await this.reader.related(this.row.id, name, 'out', null, this.depth);
    if (out.length) return out.length === 1 ? out[0] : out;
    const back = await this.reader.related(this.row.id, name, 'in', null, this.depth);
    return back.length ? back : null;
  }

  private async field(field: ModelField): Promise<unknown> {
    switch (field.type) {
      case 'link': {
        const found = await this.reader.related(
          this.row.id,
          field.name,
          'out',
          field.target ?? null,
          this.depth,
        );
        return field.cardinality === 'many' ? found : (found[0] ?? null);
      }
      case 'lines': {
        const lines = this.row.data[field.name];
        return Array.isArray(lines)
          ? lines
              .filter((line) => line && typeof line === 'object')
              .map((line) => new LineView(line as Record<string, unknown>))
          : [];
      }
      case 'formula': {
        if (this.depth >= MAX_DEPTH || !field.formula) return null;
        try {
          return await evaluate(this.reader.tree(field.formula), this, this.reader.clock);
        } catch {
          return null;
        }
      }
      default:
        return this.row.data[field.name] ?? null;
    }
  }

  /** Its formulas, computed: what a door shows beside its data. */
  async computed(): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const field of this.model?.fields ?? []) {
      if (field.type === 'formula') out[field.name] = await this.get(field.name);
    }
    return out;
  }
}

/** Reads a space's entries through their models, for one request. */
export class Reader {
  private models = new Map<string, Model>();
  private links: { from: string; to: string; role: string }[] = [];
  private byFrom = new Map<string, { to: string; role: string }[]>();
  private byTo = new Map<string, { from: string; role: string }[]>();
  private rows = new Map<string, EntryRow>();
  private views = new Map<string, EntryView>();
  private trees = new Map<string, Node>();
  private ready: Promise<void> | null = null;

  constructor(
    private readonly tx: Tx,
    readonly spaceId: string,
    readonly clock: Clock,
  ) {}

  /** The space's models and links, once. */
  load(): Promise<void> {
    this.ready ??= (async () => {
      for (const model of await modelsOf(this.tx, this.spaceId))
        this.models.set(fold(model.kind), model);
      // Her exchange rates (spec 016): entries « Rate » { currency, per_eur }, beside the fixed pegs.
      const { rows: rates } = await this.tx.query<{ currency: string; per_eur: string }>(
        `select upper(data->>'currency') as currency, data->>'per_eur' as per_eur from entry
          where space_id = $1 and archived_at is null and jarvis_fold(kind) = 'rate'
            and data ? 'currency' and data ? 'per_eur' order by created_at`,
        [this.spaceId],
      );
      const given = Object.fromEntries(
        rates
          .map((one) => [one.currency, Number(one.per_eur)])
          .filter(([, value]) => Number(value) > 0),
      );
      if (Object.keys(given).length) this.clock.rates = { ...(this.clock.rates ?? {}), ...given };
      const { rows } = await this.tx.query<{ from_id: string; to_id: string; role: string }>(
        `select l.from_id, l.to_id, l.role from link l
           join entry e on e.id = l.to_id and e.archived_at is null
          where l.space_id = $1 order by l.created_at limit 50000`,
        [this.spaceId],
      );
      this.links = rows.map((row) => ({ from: row.from_id, to: row.to_id, role: row.role }));
      for (const link of this.links) {
        this.byFrom.set(link.from, [
          ...(this.byFrom.get(link.from) ?? []),
          { to: link.to, role: link.role },
        ]);
        this.byTo.set(link.to, [
          ...(this.byTo.get(link.to) ?? []),
          { from: link.from, role: link.role },
        ]);
      }
    })();
    return this.ready;
  }

  model(kind: string): Model | undefined {
    return this.models.get(fold(kind));
  }

  allModels(): Model[] {
    return [...this.models.values()];
  }

  tree(formula: string): Node {
    let tree = this.trees.get(formula);
    if (!tree) {
      tree = parse(formula);
      this.trees.set(formula, tree);
    }
    return tree;
  }

  /** The relation another kind declares with this `inverse` name: who links here, by which role. */
  inverseOf(kind: string, name: string): { kind: string; role: string } | null {
    for (const model of this.models.values()) {
      for (const field of model.fields) {
        if (
          field.type === 'link' &&
          field.inverse &&
          fold(field.inverse) === fold(name) &&
          field.target &&
          fold(field.target) === fold(kind)
        ) {
          return { kind: model.kind, role: field.name };
        }
      }
    }
    return null;
  }

  /** Entries by id, loaded in one query for those not known yet. */
  async rowsOf(ids: string[]): Promise<EntryRow[]> {
    const missing = [...new Set(ids)].filter((id) => !this.rows.has(id));
    if (missing.length) {
      const { rows } = await this.tx.query<EntryRow>(
        `select id, kind, title, data,
                to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
                to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
           from entry where space_id = $1 and id = any($2) and archived_at is null`,
        [this.spaceId, missing],
      );
      for (const row of rows) this.rows.set(row.id, row);
    }
    return ids.flatMap((id) => this.rows.get(id) ?? []);
  }

  /** The entries of a kind (at most `limit`), newest first. */
  async kindRows(kind: string, limit = 5000): Promise<EntryRow[]> {
    const { rows } = await this.tx.query<EntryRow>(
      `select id, kind, title, data,
              to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
              to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
         from entry where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
        order by created_at desc limit $3`,
      [this.spaceId, kind, limit],
    );
    for (const row of rows) this.rows.set(row.id, row);
    return rows;
  }

  view(row: EntryRow, depth = 0): EntryView {
    let view = this.views.get(row.id);
    if (!view) {
      view = new EntryView(this, row, depth);
      this.views.set(row.id, view);
    }
    return view;
  }

  /** The entries linked to `id` by `role`, going out or coming in, of a kind if given. */
  async related(
    id: string,
    role: string,
    direction: 'out' | 'in',
    kind: string | null,
    depth: number,
  ): Promise<EntryView[]> {
    await this.load();
    const ends =
      direction === 'out'
        ? (this.byFrom.get(id) ?? [])
            .filter((one) => fold(one.role) === fold(role))
            .map((one) => one.to)
        : (this.byTo.get(id) ?? [])
            .filter((one) => fold(one.role) === fold(role))
            .map((one) => one.from);
    const rows = await this.rowsOf(ends);
    return rows
      .filter((row) => kind === null || fold(row.kind) === fold(kind))
      .map((row) => this.view(row, depth + 1));
  }

  /** Loads at once the entries next to many (before reading a table of them). */
  async around(ids: string[]): Promise<void> {
    await this.load();
    const near: string[] = [];
    for (const id of ids) {
      for (const one of this.byFrom.get(id) ?? []) near.push(one.to);
      for (const one of this.byTo.get(id) ?? []) near.push(one.from);
    }
    await this.rowsOf(near);
  }
}

/** A reader for a request, its models and links loaded. */
export async function readerOf(
  tx: Tx,
  spaceId: string,
  given: Clock = { now: new Date() },
): Promise<Reader> {
  // « today » is on her clock unless the caller says which.
  const clock = given.zone ? given : { ...given, zone: await zoneOf(tx) };
  const reader = new Reader(tx, spaceId, clock);
  await reader.load();
  return reader;
}

/**
 * The formulas of entries, computed now: `{ id: { field: value } }` for those whose kind has
 * formulas. What a door adds beside `data` — never written back.
 */
export async function computedOf(
  tx: Tx,
  spaceId: string,
  entries: EntryRow[],
  clock: Clock = { now: new Date() },
): Promise<Record<string, Record<string, unknown>>> {
  const reader = await readerOf(tx, spaceId, clock);
  const withFormulas = entries.filter((entry) =>
    reader.model(entry.kind)?.fields.some((field) => field.type === 'formula'),
  );
  if (!withFormulas.length) return {};
  await reader.around(withFormulas.map((entry) => entry.id));
  const out: Record<string, Record<string, unknown>> = {};
  for (const entry of withFormulas) out[entry.id] = await reader.view(entry).computed();
  return out;
}

/** Entries with their formulas beside their data (`computed`), for a door to return. */
export async function withComputed<T extends EntryRow>(
  tx: Tx,
  spaceId: string,
  entries: T[],
  clock: Clock = { now: new Date() },
): Promise<(T & { computed?: Record<string, unknown> })[]> {
  const computed = await computedOf(tx, spaceId, entries, clock);
  return entries.map((entry) =>
    computed[entry.id] ? { ...entry, computed: computed[entry.id] } : entry,
  );
}

export { MODEL_KIND };
