import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  Button,
  Empty,
  Panel,
  Sheet,
  Segmented,
  Skeleton,
  Tag,
  cn,
  inputClass,
  rowClass,
} from '../ui';
import { Select, toast } from '../ui/more';
import { BlockView, PageBlocks, SPANS, say, sizeOf, type Drawn, type Vocabulary } from './Blocks';
import { AddBlock, type Composable } from '../routes/PageCompose';
import { CardSettings, QuickChart } from './CardSettings';
import { useKinds } from '../lib/kinds';

// The cards (spec 107): a page changed on the page itself. « Modifier » puts each card's gestures
// on it (move, its size, remove) and « Ajouter une carte » opens her cards — her pages' named
// blocks, each once, and for a fiche those her models give. The same pieces serve an app's page,
// Aujourd'hui's band and a fiche.

type Block = Record<string, unknown> & { block: string; title?: unknown; size?: string };
export type CardFamily = 'figure' | 'chart' | 'list' | 'input';
export interface Card {
  id: string;
  title: unknown;
  family: CardFamily;
  app: string | null;
  from: { id: string; title: string } | null;
  block: Block;
}
/** Where a page stands: in an app, Aujourd'hui's band, or a kind's fiche. */
export type Place = { app?: string; today?: true; for?: string };
interface Drawing {
  blocks: Drawn[];
  vocabulary: Vocabulary;
}
interface PageEntry {
  id: string;
  title: string;
  data: Record<string, unknown> & { blocks?: Block[] };
}

const FAMILIES: { value: CardFamily | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'figure', label: 'Chiffres' },
  { value: 'chart', label: 'Graphiques' },
  { value: 'list', label: 'Listes' },
  { value: 'input', label: 'Saisie' },
];
/** Figures stand in their band at the top of a page: moved or removed, never widened. */
const FIGURES = new Set(['stat', 'stat_delta']);
const SIZES = [
  { value: 's', label: 'S', words: 'Un tiers' },
  { value: 'm', label: 'M', words: 'La moitié' },
  { value: 'l', label: 'L', words: 'Toute la largeur' },
] as const;

/** A card's settings, its size aside, in a stable order: the same card twice is one. */
export function sameCard(block: Block): string {
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
  return JSON.stringify(stable(rest));
}

/** A block's family, as the core sorts cards. */
const familyOf = (block: string): CardFamily =>
  ['stat', 'stat_delta', 'gauge'].includes(block)
    ? 'figure'
    : ['bar', 'line', 'breakdown', 'heatmap', 'funnel', 'sql'].includes(block)
      ? 'chart'
      : block === 'form'
        ? 'input'
        : 'list';

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Her cards for a place: an app's first, or a fiche's. */
export function useCards(place: Place, enabled = true) {
  const query = place.for
    ? `?kind=${encodeURIComponent(place.for)}`
    : place.app
      ? `?app=${encodeURIComponent(place.app)}`
      : '';
  return useQuery({
    queryKey: ['cards', query],
    queryFn: () => api<Card[]>(`/cards${query}`),
    enabled,
  });
}

/** « Ajouter une carte »: her cards, searched, by family; « Sur la page » for those there. */
export function CardPanel({
  open,
  onOpenChange,
  place,
  onPage,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: Place;
  onPage: Set<string>;
  onAdd: (card: Card) => void;
}) {
  const cards = useCards(place, open);
  // « Créer une carte » (spec 107): a block from plain answers, named, added like the others.
  const [creating, setCreating] = useState(false);
  const composable = useQuery({
    queryKey: ['pages', 'composable', place.app ?? ''],
    queryFn: () =>
      api<Composable>(
        `/pages/composable${place.app ? `?app=${encodeURIComponent(place.app)}` : ''}`,
      ),
    enabled: open && creating,
  });
  const [family, setFamily] = useState<CardFamily | 'all'>('all');
  const [text, setText] = useState('');
  const shown = (cards.data ?? []).filter(
    (one) =>
      (family === 'all' || one.family === family) &&
      (!text.trim() ||
        fold(`${say(one.title as never)} ${one.app ?? ''}`).includes(fold(text.trim()))),
  );
  const present = new Set((cards.data ?? []).map((one) => one.family));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Ajouter une carte">
      <div className="flex flex-col gap-3 p-4">
        {!place.for &&
          (creating ? (
            composable.data ? (
              <AddBlock
                composable={composable.data}
                format="dashboard"
                onAdd={(block) => {
                  onAdd({
                    id: 'new',
                    title: block.title ?? block.block,
                    family: familyOf(block.block),
                    app: place.app ?? null,
                    from: null,
                    block: block as Block,
                  });
                  setCreating(false);
                }}
                onClose={() => setCreating(false)}
              />
            ) : (
              <Skeleton className="h-24" />
            )
          ) : (
            <Button onClick={() => setCreating(true)}>
              <Plus size={14} />
              Créer une carte
            </Button>
          ))}
        <label className="relative block">
          <Search size={15} className="absolute top-2.5 left-3 text-faint" aria-hidden />
          <input
            aria-label="Chercher une carte"
            placeholder="Chercher une carte"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={cn(inputClass, 'pl-9')}
          />
        </label>
        <Segmented
          label="Familles"
          value={family}
          onChange={setFamily}
          options={FAMILIES.filter((one) => one.value === 'all' || present.has(one.value))}
        />
        {cards.isLoading ? (
          <Skeleton className="h-40" />
        ) : !shown.length ? (
          <Empty
            title="Aucune carte ici"
            lead={
              place.for
                ? 'Une fiche reçoit ses cartes des types qui pointent vers elle.'
                : 'Les cartes viennent des pages de tes apps.'
            }
          />
        ) : (
          <ul className="rounded-[2px] border border-rule">
            {shown.map((card) => {
              const there = onPage.has(sameCard(card.block));
              return (
                <li key={card.id} className={cn(rowClass, 'flex items-center gap-3')}>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">{say(card.title as never)}</b>
                    <span className="block truncate text-[12px] text-bark">
                      {[card.app, card.from?.title].filter(Boolean).join(' · ') || 'Tes types'}
                    </span>
                  </span>
                  {there ? (
                    <Tag tone="neutral">Sur la page</Tag>
                  ) : (
                    <Button
                      size="sm"
                      aria-label={`Ajouter « ${say(card.title as never)} »`}
                      onClick={() => onAdd(card)}
                    >
                      <Plus size={14} />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/**
 * A page in « Modifier »: its cards with their gestures, computed as she goes; « Enregistrer »
 * keeps it (a new page for its place when there was none), « Annuler » leaves it as it was.
 */
export function CardsEditor({
  page,
  place,
  title,
  record,
  onDone,
}: {
  page: PageEntry | null;
  place: Place;
  /** The name of a page made here. */
  title: string;
  /** The entry a fiche shows. */
  record?: string;
  onDone: (saved: boolean, id?: string) => void;
}) {
  const client = useQueryClient();
  const [blocks, setBlocks] = useState<Block[]>(() => page?.data.blocks ?? []);
  const [adding, setAdding] = useState(false);
  // « Régler » (spec 107): the card whose settings are open.
  const [setting, setSetting] = useState<number | null>(null);
  const data = useMemo(
    () => ({ ...(page?.data ?? place), blocks }) as Record<string, unknown>,
    [page, place, blocks],
  );
  const drawn = useQuery({
    queryKey: ['entries', 'cards-try', JSON.stringify(data), record ?? ''],
    queryFn: () =>
      api<Drawing>(`/pages/try${record ? `?record=${encodeURIComponent(record)}` : ''}`, {
        method: 'POST',
        body: data,
      }),
    enabled: blocks.length > 0,
    placeholderData: (previous) => previous,
  });
  const onPage = useMemo(() => new Set(blocks.map(sameCard)), [blocks]);
  const move = (at: number, by: number) =>
    setBlocks((was) => {
      const next = [...was];
      const [one] = next.splice(at, 1);
      next.splice(Math.max(0, Math.min(next.length, at + by)), 0, one!);
      return next;
    });
  const save = useMutation({
    mutationFn: async () => {
      // A page never kept had no card yet: said, rather than lost without a word.
      if (!blocks.length && !page)
        throw new Error('Ajoute au moins une carte : une page sans carte n’est pas gardée.');
      if (!blocks.length) {
        // Nothing left: the page goes (archived, undone from the Activity).
        if (page) await api(`/entries/${page.id}/archive`, { method: 'POST', body: {} });
        return undefined;
      }
      const saved = await api<{ entries: { id: string }[] }>('/save', {
        method: 'POST',
        body: {
          entries: [
            page
              ? { id: page.id, title: page.title, data: { ...page.data, blocks } }
              : { kind: 'Page', title, data: { ...place, blocks } },
          ],
        },
      });
      return saved.entries[0]?.id;
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (id) => {
      toast(blocks.length ? 'Page enregistrée.' : 'Page retirée.');
      void client.invalidateQueries({ queryKey: ['pages'] });
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['entry'] });
      void client.invalidateQueries({ queryKey: ['cards'] });
      onDone(true, id);
    },
  });
  const shown = drawn.data?.blocks ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[2px] border border-primary/40 bg-sand px-3 py-2">
        <span className="mr-auto text-[13px] text-bark">
          Tu modifies la page : déplace, élargis ou retire une carte.
        </span>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} />
          Ajouter une carte
        </Button>
        <Button size="sm" tone="quiet" onClick={() => onDone(false)}>
          Annuler
        </Button>
        <Button size="sm" tone="solid" disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </div>
      {!blocks.length ? (
        <Empty title="Aucune carte" lead="Ajoute une carte : elle se calcule sur tes données." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-6">
          {blocks.map((block, at) => {
            // Its drawing, once computed for this very card (a move recomputes the page).
            const candidate = shown[at];
            const one =
              candidate &&
              candidate.block === block.block &&
              JSON.stringify(candidate.title ?? null) === JSON.stringify(block.title ?? null)
                ? candidate
                : null;
            const name = say((block.title ?? '') as never, block.block);
            const gestures = (
              <span className="flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  tone="quiet"
                  aria-label={`Monter « ${name} »`}
                  disabled={at === 0}
                  onClick={() => move(at, -1)}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  size="sm"
                  tone="quiet"
                  aria-label={`Descendre « ${name} »`}
                  disabled={at === blocks.length - 1}
                  onClick={() => move(at, 1)}
                >
                  <ArrowDown size={14} />
                </Button>
                {!FIGURES.has(block.block) && (
                  <span role="group" aria-label={`Taille de « ${name} »`} className="flex">
                    {SIZES.map((size) => (
                      <button
                        key={size.value}
                        title={size.words}
                        aria-label={`${size.words} pour « ${name} »`}
                        aria-pressed={sizeOf(block) === size.value}
                        onClick={() =>
                          setBlocks((was) =>
                            was.map((b, i) => (i === at ? { ...b, size: size.value } : b)),
                          )
                        }
                        className={cn(
                          'h-7 w-7 cursor-pointer border border-rule text-[12px] font-semibold first:rounded-l-[2px] last:rounded-r-[2px]',
                          sizeOf(block) === size.value ? 'bg-ink text-paper' : 'bg-paper',
                        )}
                      >
                        {size.label}
                      </button>
                    ))}
                  </span>
                )}
                <Button
                  size="sm"
                  tone="quiet"
                  aria-label={`Régler « ${name} »`}
                  onClick={() => setSetting(at)}
                >
                  <SlidersHorizontal size={14} />
                </Button>
                <Button
                  size="sm"
                  tone="quiet"
                  aria-label={`Retirer « ${name} »`}
                  onClick={() => setBlocks((was) => was.filter((_, i) => i !== at))}
                >
                  <X size={14} />
                </Button>
              </span>
            );
            return one ? (
              <BlockView
                key={`${sameCard(block)}-${at}`}
                block={{ ...one, size: block.size ?? sizeOf(block) }}
                vocabulary={drawn.data?.vocabulary ?? ({} as Vocabulary)}
                refresh={() => undefined}
                action={gestures}
              />
            ) : (
              <Panel
                key={`${sameCard(block)}-${at}`}
                title={name}
                action={gestures}
                className={SPANS[sizeOf(block)]}
              >
                <Skeleton className="m-4 h-16" />
              </Panel>
            );
          })}
        </div>
      )}
      {setting !== null && blocks[setting] && (
        <CardSettings
          block={blocks[setting]}
          open
          onOpenChange={(open) => !open && setSetting(null)}
          onApply={(set) =>
            setBlocks((was) => was.map((one, i) => (i === setting ? (set as Block) : one)))
          }
        />
      )}
      <CardPanel
        open={adding}
        onOpenChange={setAdding}
        place={place}
        onPage={onPage}
        onAdd={(card) => {
          setBlocks((was) => [...was, card.block]);
          toast(`« ${say(card.title as never)} » ajoutée.`);
        }}
      />
    </div>
  );
}

/**
 * The cards of a place that has one page at most — Aujourd'hui's band, a kind's fiche: shown, then
 * changed on the spot; empty, one gesture to start.
 */
export function PlaceCards({
  place,
  title,
  record,
  heading,
  emptyLead,
}: {
  place: Place;
  title: string;
  record?: string;
  heading: string;
  emptyLead: string;
}) {
  const [editing, setEditing] = useState(false);
  const key = place.today ? 'today=1' : `for=${encodeURIComponent(place.for ?? '')}`;
  const pages = useQuery({
    queryKey: ['pages', 'place', key],
    queryFn: () => api<{ id: string }[]>(`/pages?${key}`),
  });
  const id = pages.data?.[0]?.id ?? null;
  const entry = useQuery({
    queryKey: ['entry', id ?? ''],
    queryFn: () => api<PageEntry>(`/entries/${id}`),
    enabled: !!id,
  });
  const drawn = useQuery({
    queryKey: ['entries', 'page', id ?? '', record ?? ''],
    queryFn: () =>
      api<Drawing>(`/pages/${id}${record ? `?record=${encodeURIComponent(record)}` : ''}`),
    enabled: !!id && !editing,
  });
  const client = useQueryClient();
  const actionFor = useQuickCharts(entry.data);
  if (pages.isLoading || (id && entry.isLoading)) return <Skeleton className="h-24" />;
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto font-display text-[15px] font-semibold text-ink">{heading}</h2>
        {!editing && (
          <Button size="sm" onClick={() => setEditing(true)}>
            {id ? <Pencil size={14} /> : <Plus size={14} />}
            {id ? 'Modifier' : 'Ajouter une carte'}
          </Button>
        )}
      </div>
      {editing ? (
        <CardsEditor
          page={id ? (entry.data ?? null) : null}
          place={place}
          title={title}
          {...(record ? { record } : {})}
          onDone={() => setEditing(false)}
        />
      ) : !id ? (
        <p className="text-[13px] text-bark">{emptyLead}</p>
      ) : drawn.data ? (
        <PageBlocks
          blocks={drawn.data.blocks}
          vocabulary={drawn.data.vocabulary}
          refresh={() => void client.invalidateQueries({ queryKey: ['entries'] })}
          actionFor={actionFor}
        />
      ) : (
        <Skeleton className="h-24" />
      )}
    </section>
  );
}

/** A card put at the end of a page: one of hers, or Aujourd'hui's band (made when there is none). */
export async function addCardTo(target: 'today' | string, card: Card): Promise<void> {
  const id =
    target === 'today' ? ((await api<{ id: string }[]>('/pages?today=1'))[0]?.id ?? null) : target;
  if (!id) {
    await api('/save', {
      method: 'POST',
      body: {
        entries: [
          { kind: 'Page', title: 'Mes cartes', data: { today: true, blocks: [card.block] } },
        ],
      },
    });
    return;
  }
  const page = await api<PageEntry>(`/entries/${id}`);
  const blocks = page.data.blocks ?? [];
  if (blocks.some((one) => sameCard(one) === sameCard(card.block)))
    throw new Error('Cette carte est déjà sur cette page.');
  await api('/save', {
    method: 'POST',
    body: {
      entries: [{ id, title: page.title, data: { ...page.data, blocks: [...blocks, card.block] } }],
    },
  });
}

/** The catalogue's cards (spec 107): each seen on her data, then put on a page of hers. */
export function CatalogCards() {
  const cards = useCards({});
  const pages = useQuery({
    queryKey: ['pages', 'all'],
    queryFn: () => api<{ id: string; title: string; app: string | null }[]>('/pages'),
  });
  const client = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const tried = useQuery({
    queryKey: ['entries', 'card-try', open ?? ''],
    queryFn: () =>
      api<Drawing>('/pages/try', {
        method: 'POST',
        body: { blocks: [(cards.data ?? []).find((one) => one.id === open)!.block] },
      }),
    enabled: !!open && !!cards.data,
  });
  const put = useMutation({
    mutationFn: ({ target, card }: { target: string; card: Card }) => addCardTo(target, card),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (_, { target, card }) => {
      const where =
        target === 'today'
          ? 'Aujourd’hui'
          : `« ${(pages.data ?? []).find((one) => one.id === target)?.title ?? 'la page'} »`;
      toast(`« ${say(card.title as never)} » ajoutée à ${where}.`);
      void client.invalidateQueries({ queryKey: ['pages'] });
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['entry'] });
    },
  });
  if (cards.isLoading) return <Skeleton className="h-24" />;
  if (!cards.data?.length) return null;
  const targets = [
    { value: 'today', label: 'Aujourd’hui' },
    ...(pages.data ?? []).map((one) => ({
      value: one.id,
      label: one.app ? `${one.app} › ${one.title}` : one.title,
    })),
  ];
  return (
    <section className="grid gap-3" aria-label="Cartes de tes apps">
      <h2 className="font-display text-[17px] font-semibold">Cartes de tes apps</h2>
      <p className="-mt-2 text-[13px] text-bark">
        Des blocs déjà réglés et nommés, tirés des pages de tes apps : vois-les sur tes données,
        pose-les où tu veux.
      </p>
      <ul className="rounded-[2px] border border-rule bg-paper">
        {cards.data.map((card) => (
          <li key={card.id} className="border-b border-rule last:border-b-0">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px]">{say(card.title as never)}</b>
                <span className="block truncate text-[12px] text-bark">
                  {[card.app, FAMILIES.find((f) => f.value === card.family)?.label]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Button
                size="sm"
                tone="quiet"
                aria-expanded={open === card.id}
                onClick={() => setOpen(open === card.id ? null : card.id)}
              >
                {open === card.id ? 'Fermer' : 'Voir'}
              </Button>
              <Select
                label={`Ajouter « ${say(card.title as never)} » à…`}
                value=""
                placeholder="Ajouter à…"
                onChange={(target) => put.mutate({ target, card })}
                options={targets}
                className="w-48"
              />
            </div>
            {open === card.id && (
              <div className="px-4 pb-4">
                {tried.data?.blocks[0] ? (
                  <BlockView
                    block={tried.data.blocks[0]}
                    vocabulary={tried.data.vocabulary}
                    refresh={() => undefined}
                  />
                ) : (
                  <Skeleton className="h-20" />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * On a saved page (spec 107), the quick settings of its charts — shape and time — kept on the page
 * at once: `actionFor` for `PageBlocks`.
 */
export function useQuickCharts(page: PageEntry | undefined) {
  const client = useQueryClient();
  const { data: kinds = [] } = useKinds();
  const save = async (at: number, block: Block) => {
    if (!page) return;
    const blocks = (page.data.blocks ?? []).map((one, i) => (i === at ? block : one));
    await api('/save', {
      method: 'POST',
      body: { entries: [{ id: page.id, title: page.title, data: { ...page.data, blocks } }] },
    });
    await client.invalidateQueries({ queryKey: ['entry'] });
    await client.invalidateQueries({ queryKey: ['entries'] });
  };
  return (at: number) => {
    const block = page?.data.blocks?.[at];
    if (!block || !['bar', 'line', 'breakdown'].includes(block.block)) return null;
    const kind = (block.query as { kind?: string } | undefined)?.kind;
    const dated =
      kinds.find((one) => one.kind === kind)?.facets?.some((one) => one.facet === 'dated') ?? false;
    return <QuickChart block={block} dated={dated} onChange={(set) => save(at, set)} />;
  };
}
