import { readerOf } from './compute';
import type { Tx } from './db';
import type { Clock } from './formula';
import { listStats, type ListStats } from './lists';
import { modelsOf, type Label } from './models';

// Collections (spec 016): every kind with a model opens on its own — no app needed — with
// statistics read from its model, without configuration: how many, how they split on each choice,
// how they come week after week, the sums and averages of their numbers — those of any list.

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

/** A collection's statistics are those of any list (spec 017), read through its model. */
export type CollectionStats = ListStats & { kind: string };

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
  return {
    ...(await listStats(tx, spaceId, { kind: model.kind, limit: 2000 }, clock)),
    kind: model.kind,
  };
}
