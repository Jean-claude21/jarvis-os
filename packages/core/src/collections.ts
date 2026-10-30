import { readerOf } from './compute';
import type { Tx } from './db';
import { isScope, todayOf, type Clock } from './formula';
import { modelsOf, type Label } from './models';

// Collections (spec 016): every kind with a model opens on its own — no app needed — with
// statistics read from its model, without configuration: how many, how they split on each choice,
// how they come week after week, the sums and averages of their numbers.

export interface Collection {
  kind: string;
  label: Label | null;
  app: string | null;
  area: string | null;
  count: number;
}

/** Her collections: every kind with a model, with how many entries. */
export async function collectionsOf(tx: Tx, spaceId: string): Promise<Collection[]> {
  const models = await modelsOf(tx, spaceId);
  const { rows } = await tx.query<{ kind: string; n: number }>(
    `select jarvis_fold(kind) as kind, count(*)::int as n from entry
      where space_id = $1 and archived_at is null group by jarvis_fold(kind)`,
    [spaceId],
  );
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const counts = new Map(rows.map((row) => [row.kind, row.n]));
  return models.map((model) => ({
    kind: model.kind,
    label: model.label ?? null,
    app: model.app ?? null,
    area: model.area ?? null,
    count: counts.get(fold(model.kind)) ?? 0,
  }));
}

export interface CollectionStats {
  kind: string;
  total: number;
  /** Entries of this month, by the first date field (else when they were made). */
  thisMonth: number;
  /** For each choice: how many entries hold each option. */
  splits: {
    field: string;
    label: Label | null;
    counts: { option: string; label: Label | null; n: number }[];
  }[];
  /** Entries per week, the last eight weeks, by the first date field. */
  weeks: { field: string; label: Label | null; points: { week: string; n: number }[] } | null;
  /** Sums (amounts) and averages (numbers, ratings, progress, formulas). */
  figures: {
    field: string;
    label: Label | null;
    kind: 'sum' | 'avg';
    value: number;
    unit: string | null;
  }[];
}

const dayOf = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

/** The statistics of a collection, from its model. */
export async function collectionStats(
  tx: Tx,
  spaceId: string,
  kind: string,
  clock: Clock = { now: new Date() },
): Promise<CollectionStats> {
  const reader = await readerOf(tx, spaceId, clock);
  const model = reader.model(kind);
  if (!model) throw new Error(`No collection « ${kind} » here: it needs a model.`);
  const rows = await reader.kindRows(model.kind, 5000);
  await reader.around(rows.map((row) => row.id));
  const today = todayOf(reader.clock);
  const dated = model.fields.find((field) => field.type === 'date' || field.type === 'datetime');
  const dayOfRow = (row: (typeof rows)[number]) =>
    (dated ? dayOf(row.data[dated.name]) : null) ?? row.createdAt.slice(0, 10);

  const splits = model.fields
    .filter((field) => field.type === 'choice' || field.type === 'multi_choice')
    .map((field) => ({
      field: field.name,
      label: field.label ?? null,
      counts: (field.options ?? []).map((option) => ({
        option,
        label: field.optionLabels?.[option] ?? null,
        n: rows.filter((row) => [row.data[field.name]].flat().includes(option)).length,
      })),
    }));

  // The last eight weeks, Monday to Sunday.
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - 7 * 7);
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const from = new Date(start.getTime() + index * 7 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(start.getTime() + (index + 1) * 7 * 86_400_000).toISOString().slice(0, 10);
    return {
      week: from,
      n: rows.filter((row) => dayOfRow(row) >= from && dayOfRow(row) < to).length,
    };
  });

  const figures: CollectionStats['figures'] = [];
  for (const field of model.fields) {
    if (!['amount', 'number', 'rating', 'progress', 'formula'].includes(field.type)) continue;
    const values: number[] = [];
    for (const row of rows) {
      const value =
        field.type === 'formula' ? await reader.view(row).get(field.name) : row.data[field.name];
      if (typeof value === 'number' && Number.isFinite(value) && !isScope(value))
        values.push(value);
    }
    if (!values.length) continue;
    const sum = values.reduce((total, one) => total + one, 0);
    const kindOf = field.type === 'amount' ? 'sum' : 'avg';
    figures.push({
      field: field.name,
      label: field.label ?? null,
      kind: kindOf,
      value: Math.round((kindOf === 'sum' ? sum : sum / values.length) * 100) / 100,
      unit: field.unit ?? (field.type === 'progress' ? '%' : null),
    });
  }

  return {
    kind: model.kind,
    total: rows.length,
    thisMonth: rows.filter((row) => dayOfRow(row).slice(0, 7) === today.slice(0, 7)).length,
    splits,
    weeks: { field: dated?.name ?? 'created', label: dated?.label ?? null, points: weeks },
    figures,
  };
}
