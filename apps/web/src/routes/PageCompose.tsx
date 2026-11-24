import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useKindName, useKinds } from '../lib/kinds';
import { fieldWord } from '../engine/format';
import { PageBlocks, say, type Drawn, type Vocabulary } from '../blocks/Blocks';
import { Button, Empty, PageHead, Panel, Segmented, Skeleton, cn, inputClass } from '../ui';
import { Select, toast } from '../ui/more';

// Pages made on screen (v3 F4): a page is a format — « Tableau de bord » or « Revue » — and blocks
// taken from the registry. She picks a block, answers what it asks in plain choices (which of her
// things, how to count, by what), sees the page computed on her data as she goes, and keeps it.
// The same screen makes an app's page and her bilan; the assistant makes the same pages by MCP.

export interface PageRow {
  id: string;
  title: string;
  app: string | null;
  label: { fr?: string; en?: string } | null;
  format: 'dashboard' | 'review';
}
type Block = Record<string, unknown> & { block: string; title?: unknown };
interface PageData {
  app?: string;
  format?: 'dashboard' | 'review';
  label?: { fr?: string; en?: string };
  filters?: { name: string; type: string; default?: string; options?: string[]; label?: unknown }[];
  blocks: Block[];
  order?: number;
}
export interface Composable {
  categories: { id: string; fr: string }[];
  components: {
    id: string;
    category: string;
    label: { fr: string };
    when: string;
    asks: string[];
    kinds: string[];
  }[];
  kinds: { kind: string; measures: string[]; groups: string[]; fields: string[] }[];
  labels: Record<string, string>;
}
interface DrawnPage {
  id: string;
  title: string;
  format: 'dashboard' | 'review';
  period: { period: string; unit: 'week' | 'month'; from: string; to: string } | null;
  filters: { name: string; type: string; options?: string[]; value: string; label?: unknown }[];
  blocks: Drawn[];
  vocabulary: Vocabulary;
}

const PARTS: { value: string; label: string }[] = [
  { value: 'figures', label: 'Chiffres' },
  { value: 'done', label: 'Fait' },
  { value: 'commitments', label: 'Engagements' },
  { value: 'goals', label: 'Objectifs' },
  { value: 'habits', label: 'Habitudes' },
  { value: 'money', label: 'Argent' },
  { value: 'people', label: 'Personnes' },
  { value: 'intentions', label: 'Dit, pas fait' },
];

// ——— The period of a review, moved back and forth ———

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const shift = (iso: string, days: number) =>
  new Date(day(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const weekOfDay = (iso: string) => {
  const date = day(iso);
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * 86_400_000);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * 86_400_000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};
const short = (iso: string) =>
  day(iso).toLocaleDateString('fr', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « Semaine 47 · 16 – 22 nov. » or « novembre 2026 », with ‹ › and the unit to switch. */
export function PeriodBar({
  period,
  onChange,
}: {
  period: NonNullable<DrawnPage['period']>;
  onChange: (value: string) => void;
}) {
  const label =
    period.unit === 'week'
      ? `Semaine ${Number(period.period.slice(-2))} · ${short(period.from)} – ${short(shift(period.to, -1))}`
      : day(period.from).toLocaleDateString('fr', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });
  const move = (way: -1 | 1) => {
    if (period.unit === 'week') onChange(weekOfDay(shift(period.from, way * 7)));
    else onChange((way < 0 ? shift(period.from, -1) : period.to).slice(0, 7));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-[10px] border border-rule bg-paper">
        <button
          onClick={() => move(-1)}
          aria-label="Période précédente"
          className="grid h-9 w-9 cursor-pointer place-items-center text-bark hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        <b className="min-w-[180px] px-1 text-center text-[13.5px] font-semibold first-letter:uppercase">
          {label}
        </b>
        <button
          onClick={() => move(1)}
          aria-label="Période suivante"
          className="grid h-9 w-9 cursor-pointer place-items-center text-bark hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
      </span>
      <Segmented
        label="Durée"
        value={period.unit}
        onChange={(unit) => onChange(unit)}
        options={[
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />
    </div>
  );
}

/** A page computed and drawn: a review's period on top, its filters, then its blocks. */
export function DrawnPageView({
  page,
  params,
  setParams,
  refresh,
}: {
  page: DrawnPage;
  params: Record<string, string>;
  setParams: (next: Record<string, string>) => void;
  refresh: () => void;
}) {
  const periodFilter = page.filters.find((one) => one.type === 'period');
  return (
    <>
      {page.period && (
        <PeriodBar
          period={page.period}
          onChange={(value) => setParams({ ...params, [periodFilter?.name ?? 'period']: value })}
        />
      )}
      <PageBlocks blocks={page.blocks} vocabulary={page.vocabulary} refresh={refresh} />
    </>
  );
}

// ——— Composing ———

/** What a block reads as in the list being composed. */
function useBlockWords(composable: Composable | undefined) {
  const kindName = useKindName();
  return (block: Block) => {
    const name = composable?.labels[block.block] ?? block.block;
    const query = block.query as { kind?: string; groupBy?: string } | undefined;
    const kind = (block.kind as string | undefined) ?? query?.kind;
    const by = (block.by as string | undefined) ?? query?.groupBy;
    return [
      name,
      kind ? kindName(kind) : null,
      by ? `par ${fieldWord(by.replace(/^month\((.*)\)$/, 'mois'))}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };
}

export function AddBlock({
  composable,
  format,
  onAdd,
  onClose,
}: {
  composable: Composable;
  format: 'dashboard' | 'review';
  onAdd: (block: Block) => void;
  onClose: () => void;
}) {
  const kindName = useKindName();
  const { data: kinds = [] } = useKinds();
  const [component, setComponent] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const info = composable.components.find((one) => one.id === component);
  const kindChoices = composable.kinds.find((one) => one.kind === answers.kind);
  const fieldLabel = (kind: string | undefined, name: string) => {
    if (name === 'month') return 'Par mois';
    const field = kinds
      .find((one) => one.kind === kind)
      ?.model?.fields?.find((f) => f.name === name) as { label?: { fr?: string } } | undefined;
    return field?.label?.fr ?? fieldWord(name);
  };
  // A block always says what it shows, in her words, when she gave it no title.
  const titleOf = () => {
    if (answers.title || !info) return answers.title;
    const kind = answers.kind ? kindName(String(answers.kind)) : null;
    const measure =
      answers.measure && answers.measure !== 'count'
        ? `Total ${fieldLabel(kind ?? undefined, String(answers.measure)).toLowerCase()}`
        : null;
    const group = answers.group ? fieldLabel(answers.kind as string, String(answers.group)) : null;
    if (!kind) return info.label.fr;
    if (info.id === 'stat') return measure ? `${measure} · ${kind}` : `Nombre · ${kind}`;
    if (info.id === 'line') return `${measure ?? kind} par mois`;
    if (group)
      return `${measure ? `${measure} · ` : ''}${kind} ${group === 'Par mois' ? 'par mois' : `par ${group.toLowerCase()}`}`;
    return `${info.label.fr} · ${kind}`;
  };
  const compose = useMutation({
    mutationFn: () =>
      api<{ block: Block }>('/pages/compose', {
        method: 'POST',
        body: { component, ...answers, ...(titleOf() ? { title: titleOf() } : {}) },
      }),
    onSuccess: ({ block }) => onAdd(block),
    onError: (error) => toast((error as Error).message, 'error'),
  });
  if (!info)
    return (
      <Panel
        title="Ajouter un bloc"
        action={
          <Button size="sm" onClick={onClose}>
            Fermer
          </Button>
        }
      >
        <div className="grid gap-3 p-3">
          {composable.categories
            .map((cat) => ({
              cat,
              items: composable.components.filter((one) => one.category === cat.id),
            }))
            .filter((group) => group.items.length)
            .map(({ cat, items }) => (
              <div key={cat.id} className="grid gap-1.5">
                <b className="font-mono text-[11px] tracking-[0.06em] text-bark uppercase">
                  {cat.fr}
                </b>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((one) => {
                    const blocked = one.asks.includes('kind') && one.kinds.length === 0;
                    return (
                      <button
                        key={one.id}
                        disabled={blocked}
                        onClick={() => {
                          setComponent(one.id);
                          const most = [...one.kinds].sort(
                            (a, b) =>
                              (kinds.find((k) => k.kind === b)?.count ?? 0) -
                              (kinds.find((k) => k.kind === a)?.count ?? 0),
                          )[0];
                          setAnswers(most ? { kind: most } : {});
                        }}
                        className={cn(
                          'grid gap-0.5 rounded-[10px] border border-rule bg-paper px-3 py-2 text-left',
                          blocked
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:border-rule-strong',
                        )}
                        title={blocked ? 'Aucune de tes données n’a ce qu’il demande.' : one.when}
                      >
                        <span className="text-[13.5px] font-semibold">{one.label.fr}</span>
                        <span className="line-clamp-2 text-[12px] text-bark">{one.when}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          <p className="text-[12px] text-faint">
            D’autres blocs (requête SQL, bloc vivant, fiche) se demandent à l’assistant.
          </p>
        </div>
      </Panel>
    );
  const set = (key: string, value: unknown) => setAnswers({ ...answers, [key]: value });
  const kindName0 = answers.kind as string | undefined;
  return (
    <Panel
      title={info.label.fr}
      action={
        <Button size="sm" onClick={() => setComponent(null)}>
          Autre bloc
        </Button>
      }
    >
      <div className="grid gap-3 p-3">
        <p className="text-[12.5px] text-bark">{info.when}</p>
        <label className="grid gap-1 text-[13px]">
          <span className="text-bark">Titre du bloc (facultatif)</span>
          <input
            className={inputClass}
            value={(answers.title as string) ?? ''}
            onChange={(event) => set('title', event.target.value || undefined)}
          />
        </label>
        {info.asks.includes('kind') && (
          <Select
            label="De quoi ?"
            value={kindName0 ?? ''}
            onChange={(value) => setAnswers({ kind: value, title: answers.title })}
            options={info.kinds.map((one) => ({ value: one, label: kindName(one) }))}
          />
        )}
        {info.asks.includes('measure') && kindChoices && (
          <Select
            label="Compter"
            value={(answers.measure as string) ?? 'count'}
            onChange={(value) => set('measure', value)}
            options={[
              { value: 'count', label: 'Le nombre' },
              ...kindChoices.measures.map((one) => ({
                value: one,
                label: `La somme de ${fieldLabel(kindName0, one).toLowerCase()}`,
              })),
            ]}
          />
        )}
        {info.asks.includes('group') && kindChoices && (
          <Select
            label="Par"
            value={(answers.group as string) ?? ''}
            placeholder="Choisir"
            onChange={(value) => set('group', value)}
            options={kindChoices.groups.map((one) => ({
              value: one,
              label: fieldLabel(kindName0, one),
            }))}
          />
        )}
        {info.asks.includes('fields') && kindChoices && (
          <div className="grid gap-1 text-[13px]">
            <span className="text-bark">Colonnes</span>
            <span className="flex flex-wrap gap-1.5">
              {kindChoices.fields.map((one) => {
                const chosen = ((answers.fields as string[]) ?? []).includes(one);
                return (
                  <button
                    key={one}
                    onClick={() =>
                      set(
                        'fields',
                        chosen
                          ? ((answers.fields as string[]) ?? []).filter((f) => f !== one)
                          : [...((answers.fields as string[]) ?? []), one],
                      )
                    }
                    aria-pressed={chosen}
                    className={cn(
                      'cursor-pointer rounded-[6px] border px-2 py-1 text-[12.5px]',
                      chosen ? 'border-primary bg-sand font-semibold' : 'border-rule bg-paper',
                    )}
                  >
                    {fieldLabel(kindName0, one)}
                  </button>
                );
              })}
            </span>
          </div>
        )}
        {info.asks.includes('days') && (
          <label className="grid gap-1 text-[13px]">
            <span className="text-bark">Sur combien de jours</span>
            <input
              type="number"
              min={1}
              max={366}
              className={cn(inputClass, 'w-32')}
              value={(answers.days as number) ?? (info.id === 'calendar' ? 7 : 35)}
              onChange={(event) => set('days', Number(event.target.value) || undefined)}
            />
          </label>
        )}
        {info.asks.includes('parts') && (
          <div className="grid gap-1 text-[13px]">
            <span className="text-bark">Ce qu’il montre</span>
            <span className="flex flex-wrap gap-1.5">
              {PARTS.map((one) => {
                const all = (answers.parts as string[]) ?? PARTS.map((p) => p.value);
                const chosen = all.includes(one.value);
                return (
                  <button
                    key={one.value}
                    onClick={() =>
                      set(
                        'parts',
                        chosen ? all.filter((p) => p !== one.value) : [...all, one.value],
                      )
                    }
                    aria-pressed={chosen}
                    className={cn(
                      'cursor-pointer rounded-[6px] border px-2 py-1 text-[12.5px]',
                      chosen ? 'border-primary bg-sand font-semibold' : 'border-rule bg-paper',
                    )}
                  >
                    {one.label}
                  </button>
                );
              })}
            </span>
          </div>
        )}
        {info.asks.includes('prompt') && (
          <label className="grid gap-1 text-[13px]">
            <span className="text-bark">La question qui t’invite à écrire (facultatif)</span>
            <input
              className={inputClass}
              value={(answers.prompt as string) ?? ''}
              placeholder="Ce qui a marché, ce que je garde…"
              onChange={(event) => set('prompt', event.target.value || undefined)}
            />
          </label>
        )}
        {info.asks.includes('period') && format === 'review' && (
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={answers.inPeriod !== false}
              onChange={(event) => set('inPeriod', event.target.checked)}
            />
            Seulement ce qui tombe dans la période
          </label>
        )}
        <span className="flex gap-1.5">
          <Button
            tone="solid"
            size="sm"
            disabled={compose.isPending}
            onClick={() => {
              if (
                format === 'review' &&
                info.asks.includes('period') &&
                answers.inPeriod === undefined
              )
                answers.inPeriod = true;
              compose.mutate();
            }}
          >
            <Plus size={14} />
            Ajouter à la page
          </Button>
          <Button size="sm" onClick={onClose}>
            Annuler
          </Button>
        </span>
      </div>
    </Panel>
  );
}

/** The page being made or changed: its name, its format, its blocks, and the page as it will be. */
export function ComposePage() {
  const search = useSearch({ from: '/composer' });
  const navigate = useNavigate();
  const client = useQueryClient();
  const app = search.app ?? null;
  const composable = useQuery({
    queryKey: ['pages', 'composable', app ?? ''],
    queryFn: () =>
      api<Composable>(`/pages/composable${app ? `?app=${encodeURIComponent(app)}` : ''}`),
  });
  const existing = useQuery({
    queryKey: ['entry', search.page ?? ''],
    queryFn: () => api<{ id: string; title: string; data: PageData }>(`/entries/${search.page}`),
    enabled: !!search.page,
  });
  const [title, setTitle] = useState('');
  const [data, setData] = useState<PageData | null>(null);
  const [adding, setAdding] = useState(false);
  const words = useBlockWords(composable.data);
  // Where it starts: the page she changes, a format she chose, or an empty dashboard.
  useEffect(() => {
    if (data) return;
    if (search.page) {
      if (existing.data) {
        setTitle(existing.data.title);
        setData({ ...existing.data.data, blocks: existing.data.data.blocks ?? [] });
      }
      return;
    }
    if (!composable.data) return;
    setData({ format: search.format === 'review' ? 'review' : 'dashboard', blocks: [] });
  }, [search.page, existing.data, composable.data]);
  const draft = useMemo<PageData | null>(() => {
    if (!data) return null;
    const format = data.format ?? 'dashboard';
    const others = (data.filters ?? []).filter((one) => one.type !== 'period');
    const period = (data.filters ?? []).find((one) => one.type === 'period');
    return {
      ...data,
      format,
      filters:
        format === 'review'
          ? [period ?? { name: 'period', type: 'period', default: 'week' }, ...others]
          : others,
    };
  }, [data]);
  const [params, setParams] = useState<Record<string, string>>({});
  const preview = useQuery({
    queryKey: ['entries', 'page-try', JSON.stringify(draft), JSON.stringify(params)],
    queryFn: () =>
      api<DrawnPage>('/pages/try', {
        method: 'POST',
        body: {
          ...draft,
          ...(params.period
            ? {
                filters: (draft?.filters ?? []).map((one) =>
                  one.type === 'period' ? { ...one, default: params.period } : one,
                ),
              }
            : {}),
        },
      }),
    enabled: !!draft && draft.blocks.length > 0,
  });
  const keep = useMutation({
    mutationFn: async () => {
      if (!draft || !title.trim()) throw new Error('Donne un nom à la page.');
      const body = {
        ...draft,
        ...(app ? { app } : {}),
        label: { fr: title.trim() },
      };
      const saved = await api<{ entries: { id: string }[] }>('/save', {
        method: 'POST',
        body: {
          entries: [
            search.page
              ? { id: search.page, title: title.trim(), data: body }
              : { kind: 'Page', title: title.trim(), data: body },
          ],
        },
      });
      return saved.entries[0]!.id;
    },
    onSuccess: (id) => {
      toast('Page gardée.');
      void client.invalidateQueries({ queryKey: ['pages'] });
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['entry', id] });
      if (app)
        void navigate({ to: '/apps/$name', params: { name: app }, search: { t: `page:${id}` } });
      else void navigate({ to: '/bilans', search: { page: id } });
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  if (!data || !draft || composable.isLoading) return <Skeleton className="h-60" />;
  const move = (at: number, way: -1 | 1) => {
    const blocks = [...data.blocks];
    const [one] = blocks.splice(at, 1);
    blocks.splice(at + way, 0, one!);
    setData({ ...data, blocks });
  };
  return (
    <>
      <PageHead
        title={search.page ? 'Modifier la page' : 'Nouvelle page'}
        lead={
          app
            ? `Une page de l’app ${app}, faite de blocs choisis dans le registre.`
            : 'Une page à toi, faite de blocs choisis dans le registre.'
        }
        actions={
          <span className="flex gap-2">
            <Button onClick={() => history.back()}>Annuler</Button>
            <Button tone="solid" disabled={keep.isPending} onClick={() => keep.mutate()}>
              <Save size={15} />
              Garder la page
            </Button>
          </span>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <Panel title="La page">
            <div className="grid gap-3 p-3">
              <label className="grid gap-1 text-[13px]">
                <span className="text-bark">Son nom</span>
                <input
                  className={inputClass}
                  value={title}
                  placeholder="Ex. : Mes dépenses du mois"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className="grid gap-1 text-[13px]">
                <span className="text-bark">Son format</span>
                <Segmented
                  label="Format"
                  value={draft.format ?? 'dashboard'}
                  onChange={(format) => setData({ ...data, format })}
                  options={[
                    { value: 'dashboard', label: 'Tableau de bord' },
                    { value: 'review', label: 'Revue (bilan)' },
                  ]}
                />
                <span className="text-[12px] text-faint">
                  {draft.format === 'review'
                    ? 'Une période (semaine ou mois) qu’on avance et recule, ses chiffres, ce qui a marqué, ton texte.'
                    : 'Une rangée de chiffres, puis une grille de blocs.'}
                </span>
              </div>
            </div>
          </Panel>
          <Panel title={`Ses blocs (${data.blocks.length})`}>
            {data.blocks.length === 0 && (
              <p className="px-4 py-3 text-[13px] text-bark">Aucun bloc pour l’instant.</p>
            )}
            {data.blocks.map((block, at) => (
              <div
                key={at}
                className="flex items-center gap-1.5 border-b border-rule px-3 py-2 last:border-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {say(block.title as never, '') || words(block)}
                  </span>
                  {say(block.title as never, '') && (
                    <span className="block truncate text-[12px] text-bark">{words(block)}</span>
                  )}
                </span>
                <button
                  disabled={at === 0}
                  onClick={() => move(at, -1)}
                  aria-label="Monter"
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] text-bark hover:bg-sand disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  disabled={at === data.blocks.length - 1}
                  onClick={() => move(at, 1)}
                  aria-label="Descendre"
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] text-bark hover:bg-sand disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() =>
                    setData({ ...data, blocks: data.blocks.filter((_, i) => i !== at) })
                  }
                  aria-label="Retirer"
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] text-bark hover:bg-sand"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full cursor-pointer items-center gap-2 border-t border-rule px-4 py-2.5 text-left text-[13px] font-semibold text-primary hover:bg-sand"
              >
                <Plus size={14} />
                Ajouter un bloc
              </button>
            )}
          </Panel>
          {adding && composable.data && (
            <AddBlock
              composable={composable.data}
              format={draft.format ?? 'dashboard'}
              onAdd={(block) => {
                setData({ ...data, blocks: [...data.blocks, block] });
                setAdding(false);
              }}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          <span className="font-mono text-[11px] tracking-[0.06em] text-bark uppercase">
            Aperçu, sur tes données
          </span>
          {draft.blocks.length === 0 ? (
            <Empty
              title="La page est vide"
              lead="Ajoute un bloc : il s’affiche ici, calculé sur tes données."
            />
          ) : preview.isLoading || !preview.data ? (
            <Skeleton className="h-60" />
          ) : (
            <DrawnPageView
              page={preview.data}
              params={params}
              setParams={setParams}
              refresh={() => void preview.refetch()}
            />
          )}
        </div>
      </div>
    </>
  );
}
