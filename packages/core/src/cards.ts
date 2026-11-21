import { createHash } from 'node:crypto';
import { readerOf } from './compute';
import type { Tx } from './db';
import { facetsOf } from './facets';
import type { Label } from './models';
import { checkPage, PAGE_KIND, type Block } from './pages';

// The cards (spec 107): a card is a block of the registry, already set and named — the blocks with
// a title on her pages, each once, and for a fiche the cards her models' relations give. The panel
// « Ajouter une carte », the catalogue and the assistant read this one list.

/** How the panel sorts the cards: figures, charts, lists, input. */
export type CardFamily = 'figure' | 'chart' | 'list' | 'input';

const FAMILIES: Record<string, CardFamily> = {
  stat: 'figure',
  stat_delta: 'figure',
  gauge: 'figure',
  bar: 'chart',
  line: 'chart',
  breakdown: 'chart',
  heatmap: 'chart',
  funnel: 'chart',
  sql: 'chart',
  form: 'input',
};

export const familyOf = (block: string): CardFamily => FAMILIES[block] ?? 'list';

export interface Card {
  /** Stable while its settings are the same: « Sur la page » is decided by it. */
  id: string;
  title: string | Label;
  family: CardFamily;
  app: string | null;
  /** The page it comes from; null for a card her models give. */
  from: { id: string; title: string } | null;
  block: Block;
}

/** The settings that make a card, its size aside (a card widened is the same card). */
export function cardIdOf(block: Record<string, unknown>): string {
  const rest: Record<string, unknown> = { ...block };
  delete rest.size;
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, inner]) => [key, stable(inner)]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(stable(rest)))
    .digest('hex')
    .slice(0, 16);
}

/** « Mouvement » → « Mouvements »: enough for a title, never for grammar at large. */
const plural = (word: string) => (/[sxz]$/i.test(word) ? word : `${word}s`);
const lower = (word: string) => word.charAt(0).toLowerCase() + word.slice(1);

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Whether a block reads the entry a fiche shows. */
const readsRecord = (block: Block) => JSON.stringify(block).includes('{record}');

/**
 * Her cards. Without `kind`: those of her pages that do not need an entry, this app's first.
 * With `kind` (a fiche): those of the pages made for that kind, then those her models give.
 */
export async function cardsOf(
  tx: Tx,
  spaceId: string,
  place: { app?: string; kind?: string } = {},
): Promise<Card[]> {
  const { rows } = await tx.query<{ id: string; title: string; data: Record<string, unknown> }>(
    `select id, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) = jarvis_fold($2)
      order by created_at`,
    [spaceId, PAGE_KIND],
  );
  const seen = new Set<string>();
  const cards: Card[] = [];
  const add = (card: Card) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    cards.push(card);
  };
  for (const row of rows) {
    let blocks: Block[];
    try {
      blocks = checkPage(row.data).blocks;
    } catch {
      continue;
    }
    const pageFor = typeof row.data.for === 'string' ? row.data.for : null;
    if (place.kind ? !pageFor || fold(pageFor) !== fold(place.kind) : pageFor) continue;
    for (const block of blocks) {
      if (!block.title || (!place.kind && readsRecord(block))) continue;
      add({
        id: cardIdOf(block as Record<string, unknown>),
        title: block.title,
        family: familyOf(block.block),
        app: typeof row.data.app === 'string' ? row.data.app : null,
        from: { id: row.id, title: row.title },
        block,
      });
    }
  }
  if (place.kind) for (const card of await derivedCards(tx, spaceId, place.kind)) add(card);
  if (place.app && !place.kind) {
    const here = fold(place.app);
    cards.sort((a, b) => Number(fold(b.app ?? '') === here) - Number(fold(a.app ?? '') === here));
  }
  return cards;
}

/**
 * A fiche's cards from her models: every kind that points to this one by a link gives « its »
 * entries as a table, and their total when it counts money. Nothing is written per domain.
 */
async function derivedCards(tx: Tx, spaceId: string, kind: string): Promise<Card[]> {
  const reader = await readerOf(tx, spaceId);
  const models = reader.allModels();
  const cards: Card[] = [];
  for (const model of models) {
    const parent = model.extends
      ? (models.find((one) => fold(one.kind) === fold(model.extends!)) ?? null)
      : null;
    const fields = [...(parent?.fields ?? []), ...model.fields];
    const label = model.label?.fr ?? model.kind;
    for (const link of fields) {
      if (link.type !== 'link' || !link.target || fold(link.target) !== fold(kind)) continue;
      const where = `${link.name}.id = {record}`;
      const shown = fields
        .filter((one) => one.name !== link.name && !['lines', 'button'].includes(one.type))
        .slice(0, 4)
        .map((one) => one.name);
      const table: Block = {
        block: 'table',
        title: {
          fr: `${plural(label)} liés`,
          en: `Linked ${plural(model.label?.en ?? model.kind)}`,
        },
        query: { kind: model.kind, where, ...(shown.length ? { fields: shown } : {}) },
      };
      cards.push({
        id: cardIdOf(table as Record<string, unknown>),
        title: table.title!,
        family: 'list',
        app: model.app ?? null,
        from: null,
        block: table,
      });
      const amount = facetsOf(model, parent).find((one) => one.facet === 'amount');
      if (amount && 'amount' in amount) {
        const total: Block = {
          block: 'stat',
          title: {
            fr: `Total des ${lower(plural(label))}`,
            en: `Total ${lower(plural(model.label?.en ?? model.kind))}`,
          },
          query: { kind: model.kind, where, aggregate: { total: `sum(${amount.amount})` } },
        };
        cards.push({
          id: cardIdOf(total as Record<string, unknown>),
          title: total.title!,
          family: 'figure',
          app: model.app ?? null,
          from: null,
          block: total,
        });
      }
    }
  }
  return cards;
}
