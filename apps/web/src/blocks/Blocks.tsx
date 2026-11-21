import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { showValue } from '../engine/format';
import { Value } from '../ui/Value';
import { Button, Empty, Panel, Stat, Stats, Tag, cn, inputClass, rowClass } from '../ui';
import { Markdown } from '../ui/Markdown';
import { Select, toast } from '../ui/more';
import { Bars, Funnel, GaugeBar, Heat, Line, Share, type Point } from './charts';
import { HighlightsBlock } from './review';

// The render of every page block (v3 D21): one function per block of the registry, fed by what the
// core computed (`renderPage`). A new block = its entry in the registry + its render here.

export type Words = { fr?: string; en?: string } | string | null | undefined;
export const say = (one: Words, fallback = '') =>
  !one ? fallback : typeof one === 'string' ? one : (one.fr ?? one.en ?? fallback);

export interface Vocabulary {
  [kind: string]: {
    label: Words;
    fields: Record<string, { label: Words; options: Record<string, Words>; order?: string[] }>;
  };
}
export type Drawn = Record<string, unknown> & {
  block: string;
  title: Words;
  kind?: string;
  error?: string;
};

export interface BlockProps {
  block: Drawn;
  vocabulary: Vocabulary;
  /** After a gesture changed her entries: the page computes again. */
  refresh: () => void;
}

const fieldLabel = (voc: Vocabulary, kind: string | undefined, name: string) =>
  say(
    kind ? voc[kind]?.fields[name]?.label : null,
    name === 'title' ? 'Titre' : name.replace(/_/g, ' '),
  );
const optionLabel = (voc: Vocabulary, kind: string | undefined, field: string, value: unknown) => {
  const words = kind ? voc[kind]?.fields[field]?.options?.[String(value)] : null;
  return words ? say(words) : showValue(value);
};
const num = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);
const pointsOf = (block: Drawn): Point[] =>
  ((block.points as { label: unknown; value: unknown }[] | undefined) ?? []).map((p) => ({
    label: showValue(p.label) || '—',
    value: num(p.value),
  }));
const empty = (lead = 'Rien à montrer pour l’instant.') => (
  <p className="px-4 py-5 text-[13px] text-bark">{lead}</p>
);

/** A gesture on an entry (« Payée », « Écarter »): its fields set, the page computed again. */
function useGesture(refresh: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, set }: { id: string; set: Record<string, unknown> }) =>
      api('/save', { method: 'POST', body: { entries: [{ id, data: set }] } }),
    onSuccess: () => toast('Fait. Annulable depuis l’Activité.'),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      refresh();
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
}
type Gesture = { label: string; set: Record<string, unknown> };
function Gestures({
  id,
  actions,
  refresh,
}: {
  id: string;
  actions: Gesture[];
  refresh: () => void;
}) {
  const gesture = useGesture(refresh);
  return (
    <span className="relative z-[1] flex flex-none flex-wrap gap-1.5">
      {actions.map((one, at) => (
        <Button
          key={one.label + at}
          size="sm"
          tone={at === 0 ? 'solid' : 'plain'}
          disabled={gesture.isPending}
          onClick={() => gesture.mutate({ id, set: one.set })}
        >
          {one.label}
        </Button>
      ))}
    </span>
  );
}
const WebLink = ({ href }: { href: unknown }) =>
  typeof href === 'string' && href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="relative z-[1] grid h-8 w-8 flex-none place-items-center rounded-[2px] border border-rule text-bark hover:text-ink"
      aria-label="Ouvrir le lien"
    >
      <ExternalLink size={14} />
    </a>
  ) : null;

function StatBlock({ block }: BlockProps) {
  const delta = block.block === 'stat_delta' ? (block.delta as number | null) : null;
  return (
    <Stat
      label={say(block.title, 'Chiffre')}
      value={`${showValue(block.value) || '0'}${block.unit ? ` ${String(block.unit)}` : ''}`}
      {...(block.block === 'stat_delta'
        ? {
            sub:
              delta === null
                ? `mois d’avant : ${showValue(block.previous) || '0'}`
                : `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr')} % sur le mois d’avant`,
          }
        : {})}
    />
  );
}

function GaugeBlock({ block }: BlockProps) {
  const items =
    (block.items as { id: string; label: unknown; value: unknown; max: unknown }[]) ?? [];
  if (!items.length) return empty();
  return (
    <div className="grid gap-3 px-4 py-3">
      {items.map((one) => (
        <Link
          key={one.id}
          to="/entree/$id"
          params={{ id: one.id }}
          className="block hover:opacity-90"
        >
          <GaugeBar label={showValue(one.label)} value={num(one.value)} max={num(one.max)} />
        </Link>
      ))}
    </div>
  );
}

function SeriesBlock({ block, vocabulary }: BlockProps) {
  const field = block.groupField as string | undefined;
  const points = pointsOf(block).map((p) => ({
    ...p,
    label: field ? optionLabel(vocabulary, block.kind, field, p.label) : p.label,
  }));
  if (!points.length) return empty();
  if (block.block === 'line') return <Line points={points} />;
  if (block.block === 'breakdown') return <Share points={points} />;
  return <Bars points={points} />;
}

function FunnelBlock({ block, vocabulary }: BlockProps) {
  const steps = ((block.steps as { name: string; count: number }[]) ?? []).map((s) => ({
    label: optionLabel(vocabulary, block.kind, String(block.by ?? ''), s.name),
    value: s.count,
  }));
  return steps.length ? <Funnel steps={steps} /> : empty();
}

function HeatBlock({ block }: BlockProps) {
  return <Heat cells={(block.cells as { day: string; done: boolean }[]) ?? []} />;
}

function TableBlock({ block, vocabulary }: BlockProps) {
  const columns = (block.columns as string[]) ?? [];
  const rows = (block.rows as Record<string, unknown>[]) ?? [];
  if (!rows.length) return empty();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead>
          <tr className="border-b border-rule bg-sand/60 text-left font-mono text-[11px] tracking-[0.04em] text-bark uppercase">
            {columns.map((one) => (
              <th key={one} className="px-3 py-2 font-medium">
                {fieldLabel(vocabulary, block.kind, one)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, at) => (
            <tr
              key={String(row.id ?? at)}
              className="border-b border-rule last:border-0 hover:bg-sand"
            >
              {columns.map((one, n) => (
                <td key={one} className="px-3 py-2 align-top">
                  {n === 0 && typeof row.id === 'string' ? (
                    <Link
                      to="/entree/$id"
                      params={{ id: row.id }}
                      className="font-semibold hover:underline"
                    >
                      {showValue(row[one]) || '—'}
                    </Link>
                  ) : typeof row[one] === 'string' && /^https?:\/\//i.test(row[one]) ? (
                    <Value value={row[one]} />
                  ) : (
                    optionLabel(vocabulary, block.kind, one, row[one]) || '—'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {block.totalValue !== null && block.totalValue !== undefined && (
          <tfoot>
            <tr className="border-t border-rule bg-sand/60 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td colSpan={Math.max(1, columns.length - 1)} className="px-3 py-2 text-right">
                {showValue(block.totalValue)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

type Item = {
  id: string;
  title: string;
  values?: Record<string, unknown>;
  detail?: unknown;
  badge?: unknown;
  link?: unknown;
};

/** A data table: searched, narrowed by its facets, each row with its gestures. */
function DataTableBlock({ block, vocabulary, refresh }: BlockProps) {
  const items = (block.items as Item[]) ?? [];
  const columns = (block.columns as string[]) ?? [];
  const facets = (block.facets as string[]) ?? [];
  const actions = (block.actions as Gesture[]) ?? [];
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const shown = items.filter(
    (one) =>
      (!q ||
        `${one.title} ${Object.values(one.values ?? {}).join(' ')}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      Object.entries(chosen).every(
        ([field, value]) => !value || String(one.values?.[field] ?? '') === value,
      ),
  );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-sand px-3 py-2">
        <input
          className={inputClass + ' max-w-[260px]'}
          placeholder="Chercher"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Chercher dans le tableau"
        />
        {facets.map((field) => {
          const values = [
            ...new Set(items.map((one) => String(one.values?.[field] ?? '')).filter(Boolean)),
          ];
          return (
            <Select
              key={field}
              label={fieldLabel(vocabulary, block.kind, field)}
              value={chosen[field] ?? ''}
              placeholder={fieldLabel(vocabulary, block.kind, field)}
              onChange={(value) => setChosen({ ...chosen, [field]: value === '*' ? '' : value })}
              options={[
                { value: '*', label: 'Tous' },
                ...values.map((value) => ({
                  value,
                  label: optionLabel(vocabulary, block.kind, field, value),
                })),
              ]}
              className="w-auto"
            />
          );
        })}
        <span className="ml-auto font-mono text-xs text-faint">{shown.length}</span>
      </div>
      {!shown.length
        ? empty('Aucune entrée ici.')
        : shown.map((one) => (
            <div key={one.id} className={rowClass + ' relative flex-wrap'}>
              <span className="min-w-0 flex-1">
                <Link
                  to="/entree/$id"
                  params={{ id: one.id }}
                  className="block truncate font-semibold after:absolute after:inset-0"
                >
                  {one.title}
                </Link>
                <span className="block truncate text-[12.5px] text-bark">
                  {columns
                    .filter((c) => c !== block.link)
                    .map((c) => optionLabel(vocabulary, block.kind, c, one.values?.[c]))
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <WebLink href={block.link ? one.values?.[String(block.link)] : null} />
              {actions.length > 0 && <Gestures id={one.id} actions={actions} refresh={refresh} />}
            </div>
          ))}
    </div>
  );
}

function TaskListBlock({ block, refresh }: BlockProps) {
  const items = (block.items as Item[]) ?? [];
  const actions = ((block.actions as Gesture[]) ?? []).length
    ? (block.actions as Gesture[])
    : block.action
      ? [block.action as Gesture]
      : [];
  if (!items.length) return empty('Rien à traiter.');
  return (
    <div>
      {items.map((one) => (
        <div key={one.id} className={rowClass + ' relative'}>
          <span className="min-w-0 flex-1">
            <Link
              to="/entree/$id"
              params={{ id: one.id }}
              className="block truncate font-semibold after:absolute after:inset-0"
            >
              {one.title}
            </Link>
            {one.detail ? (
              <span className="block truncate text-[12.5px] text-bark">
                {showValue(one.detail)}
              </span>
            ) : null}
          </span>
          <WebLink href={one.link} />
          <Gestures id={one.id} actions={actions} refresh={refresh} />
        </div>
      ))}
    </div>
  );
}

/** A review: the list, the one picked read in full, its gestures (decide one by one). */
function ReviewBlock({ block, vocabulary, refresh }: BlockProps) {
  const items = (block.items as Item[]) ?? [];
  const fields = (block.fields as string[]) ?? [];
  const subtitle = (block.subtitle as string[]) ?? [];
  const actions = (block.actions as Gesture[]) ?? [];
  const [pick, setPick] = useState<string | null>(null);
  const one = items.find((item) => item.id === pick) ?? items[0];
  if (!one) return empty('Rien à décider.');
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="max-h-[480px] overflow-y-auto border-b border-rule md:border-r md:border-b-0">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setPick(item.id)}
            className={cn(
              rowClass,
              'w-full cursor-pointer text-left',
              item.id === one.id && 'bg-sand',
            )}
          >
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{item.title}</b>
              <span className="block truncate text-[12.5px] text-bark">
                {subtitle
                  .map((s) => showValue(item.values?.[s]))
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {block.badge && item.values?.[String(block.badge)] !== undefined ? (
              <Tag tone="info" dot={false}>
                {showValue(item.values?.[String(block.badge)])}
              </Tag>
            ) : null}
          </button>
        ))}
      </div>
      <div className="min-w-0 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <Link
            to="/entree/$id"
            params={{ id: one.id }}
            className="font-display text-[16px] font-semibold hover:underline"
          >
            {one.title}
          </Link>
          <span className="flex gap-1.5">
            <WebLink href={block.link ? one.values?.[String(block.link)] : null} />
            <Gestures id={one.id} actions={actions} refresh={refresh} />
          </span>
        </div>
        <dl className="grid gap-2">
          {fields
            .filter(
              (f) =>
                f !== block.link &&
                one.values?.[f] !== undefined &&
                one.values?.[f] !== null &&
                one.values?.[f] !== '',
            )
            .map((f) => (
              <div
                key={f}
                className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-3 text-[13px]"
              >
                <dt className="text-bark">{fieldLabel(vocabulary, block.kind, f)}</dt>
                <dd className="min-w-0">
                  {typeof one.values?.[f] === 'string' && String(one.values?.[f]).length > 120 ? (
                    <Markdown text={String(one.values?.[f])} className="text-[13px]" />
                  ) : (
                    optionLabel(vocabulary, block.kind, f, one.values?.[f])
                  )}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}

function KanbanBlock({ block, vocabulary }: BlockProps) {
  const columns = (block.columns as { name: string; items: Item[]; muted?: boolean }[]) ?? [];
  return (
    <div className="flex gap-3 overflow-x-auto p-3">
      {columns.map((column) => (
        <div
          key={column.name}
          className={cn(
            'w-[240px] flex-none rounded-[10px] bg-sand p-2',
            column.muted && 'opacity-60',
          )}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <b className="text-[13px]">
              {optionLabel(vocabulary, block.kind, String(block.by ?? ''), column.name)}
            </b>
            <span className="font-mono text-[11px] text-faint">{column.items.length}</span>
          </div>
          <div className="grid gap-2">
            {column.items.map((item) => (
              <Link
                key={item.id}
                to="/entree/$id"
                params={{ id: item.id }}
                className="block rounded-[8px] border border-rule bg-paper p-2.5 text-[13px] hover:border-rule-strong"
              >
                <b className="block font-semibold">{item.title}</b>
                {item.detail ? (
                  <span className="block text-[12px] text-bark">{showValue(item.detail)}</span>
                ) : null}
                {item.badge !== undefined && item.badge !== null ? (
                  <span className="mt-1 inline-block">
                    <Tag tone="info" dot={false}>
                      {showValue(item.badge)}
                    </Tag>
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarBlock({ block }: BlockProps) {
  const items =
    (block.occurrences as { id: string; title: string; start: string; allDay?: boolean }[]) ?? [];
  if (!items.length) return empty('Rien de prévu.');
  return (
    <div>
      {items.map((one, at) => (
        <Link key={one.id + at} to="/entree/$id" params={{ id: one.id }} className={rowClass}>
          <time className="w-28 flex-none font-mono text-xs text-bark">{showValue(one.start)}</time>
          <span className="min-w-0 truncate">{one.title}</span>
        </Link>
      ))}
    </div>
  );
}

type FormField = {
  name: string;
  label: Words;
  type: string;
  required?: boolean;
  options?: string[];
  target?: string;
};
/** A form from the kind's model: one field per field, the entry saved, the page computed again. */
function FormBlock({ block, refresh }: BlockProps) {
  const fields = ((block.fields as FormField[]) ?? []).filter(
    (f) => !['formula', 'lines', 'button'].includes(f.type),
  );
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = values[f.name];
        if (raw === undefined || raw === '') continue;
        data[f.name] = ['number', 'amount', 'progress'].includes(f.type) ? Number(raw) : raw;
      }
      return api('/save', {
        method: 'POST',
        body: { entries: [{ kind: block.kind, title: title || 'Sans titre', data }] },
      });
    },
    onSuccess: () => {
      setTitle('');
      setValues({});
      toast('Ajouté.');
      refresh();
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  return (
    <form
      className="grid gap-2.5 px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <input
        className={inputClass}
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Titre"
      />
      {fields.map((f) => (
        <label key={f.name} className="grid gap-1">
          <span className="text-[12.5px] text-bark">
            {say(f.label, f.name)}
            {f.required ? ' *' : ''}
          </span>
          {f.options?.length ? (
            <Select
              label={say(f.label, f.name)}
              value={values[f.name] ?? ''}
              placeholder="—"
              onChange={(value) => setValues({ ...values, [f.name]: value })}
              options={f.options.map((o) => ({ value: o, label: showValue(o) }))}
            />
          ) : (
            <input
              className={inputClass}
              type={
                f.type === 'date'
                  ? 'date'
                  : f.type === 'datetime'
                    ? 'datetime-local'
                    : ['number', 'amount', 'progress'].includes(f.type)
                      ? 'number'
                      : 'text'
              }
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              placeholder={
                f.type === 'link' ? `l’identifiant d’un(e) ${f.target ?? 'entrée'}` : undefined
              }
            />
          )}
        </label>
      ))}
      <span>
        <Button tone="solid" disabled={save.isPending}>
          Ajouter
        </Button>
      </span>
    </form>
  );
}

function RecordBlock({ block, vocabulary }: BlockProps) {
  const record = block.record as {
    id: string;
    kind: string;
    title: string;
    fields: { name: string; value: unknown }[];
  } | null;
  if (!record) return empty('Choisis une entrée.');
  return (
    <dl>
      {(record.fields ?? []).map((f) => (
        <div
          key={f.name}
          className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 border-b border-rule px-4 py-2 text-[13px] last:border-0"
        >
          <dt className="text-bark">{fieldLabel(vocabulary, record.kind, f.name)}</dt>
          <dd>{optionLabel(vocabulary, record.kind, f.name, f.value) || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function SqlBlock(props: BlockProps) {
  const { block } = props;
  const rows = (block.rows as Record<string, unknown>[]) ?? [];
  const columns = (block.columns as string[]) ?? Object.keys(rows[0] ?? {});
  if (block.chart === 'number')
    return (
      <Stat
        label={say(block.title, 'Chiffre')}
        value={showValue(Object.values(rows[0] ?? {})[0]) || '0'}
      />
    );
  if (block.chart === 'bar' || block.chart === 'line') {
    const points = rows.map((r) => ({
      label: showValue(r[columns[0]!]),
      value: num(r[columns[1]!]),
    }));
    return block.chart === 'bar' ? <Bars points={points} /> : <Line points={points} />;
  }
  return <TableBlock {...props} block={{ ...block, columns, rows }} />;
}

/** A live block: the code an assistant wrote, isolated (no access to Jarvis), with its data only. */
function LiveBlock({ block }: BlockProps) {
  const html = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const theme = Object.fromEntries(
      [
        'primary',
        'ochre',
        'info',
        'success',
        'error',
        'bark',
        'faint',
        'ink',
        'rule',
        'rule-strong',
        'sand',
        'paper',
      ].map((k) => [k, css.getPropertyValue(`--${k}`).trim()]),
    );
    const data = JSON.stringify({
      rows: block.rows ?? [],
      labels: block.labels ?? {},
      theme,
      lang: 'fr',
    }).replace(/</g, '\\u003c');
    return `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:13px Archivo,system-ui,sans-serif;color:${theme.ink};background:transparent}</style><script>window.JARVIS=${data}</script>${String(block.code ?? '')}`;
  }, [block]);
  return (
    <iframe
      title={say(block.title, 'Bloc')}
      sandbox="allow-scripts"
      srcDoc={html}
      className="block w-full border-0"
      style={{ height: num(block.height) || 320 }}
    />
  );
}

function ViewBlock({ block }: BlockProps) {
  const result = block.result as
    { rows?: Record<string, unknown>[]; columns?: string[] } | undefined;
  return (
    <TableBlock
      block={{ ...block, rows: result?.rows ?? [], columns: result?.columns ?? ['title'] }}
      vocabulary={{}}
      refresh={() => undefined}
    />
  );
}

/** The registry's renders: a block's name → how it draws. */
export const BLOCK_RENDERS: Record<string, (props: BlockProps) => ReactNode> = {
  stat: StatBlock,
  stat_delta: StatBlock,
  gauge: GaugeBlock,
  bar: SeriesBlock,
  line: SeriesBlock,
  breakdown: SeriesBlock,
  funnel: FunnelBlock,
  heatmap: HeatBlock,
  table: TableBlock,
  datatable: DataTableBlock,
  task_list: TaskListBlock,
  review: ReviewBlock,
  kanban: KanbanBlock,
  calendar: CalendarBlock,
  form: FormBlock,
  record: RecordBlock,
  sql: SqlBlock,
  live: LiveBlock,
  view: ViewBlock,
  highlights: HighlightsBlock,
};

/** Blocks that take the whole width of a dashboard. */
export const WIDE = new Set([
  'table',
  'datatable',
  'review',
  'kanban',
  'view',
  'live',
  'sql',
  'highlights',
]);

/** One block in its panel (a figure stands alone, in the band of figures). */
/** A card's width (spec 107): what it says, or a wide block the whole width, the others half. */
export const sizeOf = (block: { block: string; size?: unknown }): 's' | 'm' | 'l' =>
  block.size === 's' || block.size === 'm' || block.size === 'l'
    ? block.size
    : WIDE.has(block.block)
      ? 'l'
      : 'm';
/** Its columns in the page's grid of six (one column on a narrow screen). */
export const SPANS = { s: 'lg:col-span-2', m: 'lg:col-span-3', l: 'lg:col-span-6' } as const;

export function BlockView(props: BlockProps & { action?: ReactNode }) {
  const { block, action } = props;
  const Render = BLOCK_RENDERS[block.block];
  const body = block.error ? (
    <p className="px-4 py-4 text-[13px] text-error">{block.error}</p>
  ) : Render ? (
    <Render {...props} />
  ) : (
    <Empty title={`« ${block.block} »`} lead="Ce composant n’a pas encore de rendu." />
  );
  return (
    <Panel title={say(block.title, '')} action={action} className={SPANS[sizeOf(block)]}>
      {body}
    </Panel>
  );
}

/** A page as a dashboard (v3 D21): its filters, its band of figures, then its blocks in a grid. */
export function PageBlocks({
  blocks,
  vocabulary,
  refresh,
}: {
  blocks: Drawn[];
  vocabulary: Vocabulary;
  refresh: () => void;
}) {
  const figures = blocks.filter(
    (b) => (b.block === 'stat' || b.block === 'stat_delta') && !b.error,
  );
  const rest = blocks.filter((b) => !figures.includes(b));
  return (
    <>
      {figures.length > 0 && (
        <Stats>
          {figures.map((block, at) => (
            <StatBlock key={at} block={block} vocabulary={vocabulary} refresh={refresh} />
          ))}
        </Stats>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-6">
        {rest.map((block, at) => (
          <BlockView key={at} block={block} vocabulary={vocabulary} refresh={refresh} />
        ))}
      </div>
    </>
  );
}
