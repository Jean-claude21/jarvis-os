import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { api } from '../lib/api';

import { useSession } from '../lib/session';
import { type Kind, useKinds } from '../lib/kinds';
import {
  AppIcon,
  Button,
  Caps,
  Empty,
  PageHead,
  Panel,
  Sheet,
  Skeleton,
  Tabs,
  Tag,
  cn,
  inputClass,
  type TagTone,
} from '../ui';
import { Select } from '../ui/more';
import { PageBlocks, say, type Drawn, type Vocabulary } from '../blocks/Blocks';
import { Overview } from './Overview';
import { useFiles, useKindRows } from '../engine/sources';
import type { RenderKey } from '../engine/types';
import { View } from '../engine/View';
import { Journal } from './Activity';

// Her apps (v3 D14, first form): each with its kinds and what they are (their facets). The app's
// views and its overview come with the view engine (V5) and the templates (V6).

interface MyApps {
  apps: { app: string; kinds: string[]; line?: string }[];
}

const nameOf = (kind: Kind) => kind.model?.label?.fr ?? kind.common?.fr ?? kind.kind;

interface CatalogApp {
  app: string;
  description: string | { fr?: string; en?: string };
  release: number;
  kinds: string[];
  /** Each kind in her words (« Goal » → « Objectif »). */
  labels?: Record<string, string>;
  installed: number | null;
}
interface Tried<T> {
  result: T;
}
interface InstallReport {
  created: string[];
  kept: string[];
  reuse: { from: string; to: string; count: number }[];
}
interface UpdateReport {
  from: number;
  to: number;
  created: string[];
  updated: string[];
  conflicts: string[];
  skipped: string[];
}

const words = (one: CatalogApp['description']) =>
  typeof one === 'string' ? one : (one.fr ?? one.en ?? '');
/**
 * What an app adds, in her words (v3 D2): its kinds by their names (« Objectif »), its pages, its
 * automations and its agents; never « Model » or « type ». The app itself is not listed.
 */
const piecesSaid = (pieces: string[], labels: Record<string, string> = {}) =>
  pieces
    .filter((text) => !/^App « /.test(text))
    .map((text) =>
      text
        .replace(/^Model « (.*) »$/, (_m, kind: string) => labels[kind] ?? kind)
        .replace(
          /^Page « (.*) »$/,
          (_m, page: string) => `page « ${labels[`page:${page}`] ?? page} »`,
        )
        .replace(/^Rule « (.*) »$/, 'automatisme « $1 »')
        .replace(/^Script « (.*) »$/, 'calcul « $1 »')
        .replace(/^Agent « (.*) »$/, '$1 (agent)'),
    );

// Her apps and the catalogue (v3 D14): the ones she has (a newer release offered, layer by layer),
// the ones Jarvis ships — each tried first: what it would create, what of hers it can use.
export function Apps() {
  const { space } = useSession();
  const client = useQueryClient();
  const { data: mine } = useQuery({
    queryKey: ['apps', space.id],
    queryFn: () => api<MyApps>('/apps/mine'),
  });
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['apps', 'catalog', space.id],
    queryFn: () => api<CatalogApp[]>('/apps/catalog'),
  });
  const [open, setOpen] = useState<{ app: CatalogApp; update: boolean } | null>(null);
  const tried = useQuery({
    queryKey: ['apps', 'try', open?.app.app, open?.update],
    queryFn: () =>
      api<Tried<InstallReport | UpdateReport>>(open!.update ? '/apps/update' : '/apps/install', {
        method: 'POST',
        body: { name: open!.app.app, dryRun: true },
      }),
    enabled: !!open,
  });
  const go = useMutation({
    mutationFn: () =>
      api(open!.update ? '/apps/update' : '/apps/install', {
        method: 'POST',
        body: { name: open!.app.app, dryRun: false },
      }),
    onSuccess: () => {
      setOpen(null);
      void client.invalidateQueries({ queryKey: ['apps'] });
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
  const installed = catalog.filter((one) => one.installed !== null);
  const others = catalog.filter((one) => one.installed === null);
  // Her own apps (made with an assistant) are hers: listed with the shipped ones she has.
  const own = (mine?.apps ?? []).filter(
    (one) => !catalog.some((app) => app.app.toLowerCase() === one.app.toLowerCase()),
  );
  const card = (name: string, lead: string, action?: React.ReactNode, href = true) => (
    <div
      key={name}
      className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-rule bg-paper p-3.5"
    >
      <div className="flex min-w-0 gap-3">
        <AppIcon name={name} size={32} />
        <span className="min-w-0">
          {href ? (
            <Link
              to="/apps/$name"
              params={{ name }}
              className="block truncate font-display text-[15px] font-semibold hover:underline"
            >
              {name}
            </Link>
          ) : (
            <b className="block truncate font-display text-[15px] font-semibold">{name}</b>
          )}
          <span className="line-clamp-2 text-[12.5px] text-bark">{lead}</span>
        </span>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
  const report = tried.data?.result;
  return (
    <>
      <PageHead
        title="Mes apps"
        badge={`${installed.length + own.length} app(s)`}
        lead={`Les services de l’espace ${space.name}. Demande-en une autre à ton assistant : elle t’attendra dans « À valider ».`}
      />
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-4">
            {installed.map((one) =>
              card(
                one.app,
                words(one.description),
                (one.installed ?? 0) < one.release ? (
                  <Button
                    size="sm"
                    tone="solid"
                    onClick={() => setOpen({ app: one, update: true })}
                  >
                    Mettre à jour
                  </Button>
                ) : undefined,
              ),
            )}
            {own.map((one) => card(one.app, one.line ?? `${one.kinds.length} types`))}
            {!installed.length && !own.length && (
              <Panel className="col-span-full">
                <Empty
                  title="Aucune app ici"
                  lead="Choisis-en une ci-dessous, ou demande-la à ton assistant."
                />
              </Panel>
            )}
          </div>
          {others.length > 0 && (
            <>
              <h2 className="pt-2 font-display text-[17px] font-semibold">À ajouter</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-4">
                {others.map((one) =>
                  card(
                    one.app,
                    words(one.description),
                    <Button size="sm" onClick={() => setOpen({ app: one, update: false })}>
                      Essayer
                    </Button>,
                    false,
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
      <Sheet
        open={!!open}
        onOpenChange={(value) => !value && setOpen(null)}
        title={open ? `${open.update ? 'Mettre à jour' : 'Ajouter'} ${open.app.app}` : ''}
      >
        {open && (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-[13.5px] text-bark">{words(open.app.description)}</p>
            {tried.isLoading ? (
              <Skeleton className="h-24" />
            ) : tried.error ? (
              <p className="text-[13px] text-error">{(tried.error as Error).message}</p>
            ) : report ? (
              <>
                {'reuse' in report ? (
                  <>
                    <Section
                      title="Ce qu’elle ajoute"
                      items={piecesSaid(report.created, open.app.labels)}
                    />
                    {report.kept.length > 0 && (
                      <Section
                        title="Déjà là, gardé tel quel"
                        items={piecesSaid(report.kept, open.app.labels)}
                      />
                    )}
                    {report.reuse.length > 0 && (
                      <Section
                        title="Ce que tu as déjà et qu’elle peut utiliser"
                        items={report.reuse.map(
                          (one) =>
                            `tes ${one.count} « ${one.from} » deviennent des « ${open.app.labels?.[one.to] ?? one.to} »`,
                        )}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px]">
                      Version {report.from} → {report.to}. Ce que tu as changé reste à toi.
                    </p>
                    <Section
                      title="Mis à jour"
                      items={piecesSaid(report.updated, open.app.labels)}
                    />
                    <Section title="Ajouté" items={piecesSaid(report.created, open.app.labels)} />
                    {report.conflicts.length > 0 && (
                      <Section
                        title="Gardé comme tu l’as fait (l’app l’a aussi changé)"
                        items={piecesSaid(report.conflicts, open.app.labels)}
                        tone="late"
                      />
                    )}
                  </>
                )}
                <div className="flex gap-2">
                  <Button tone="solid" disabled={go.isPending} onClick={() => go.mutate()}>
                    {open.update ? 'Mettre à jour' : 'Ajouter'}
                  </Button>
                  <Button onClick={() => setOpen(null)}>Annuler</Button>
                </div>
                <p className="text-xs text-faint">
                  Une seule ligne au journal : annulable d’un geste.
                </p>
              </>
            ) : null}
          </div>
        )}
      </Sheet>
    </>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone?: TagTone }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <b className="text-[13px] font-semibold">{title}</b>
      <div className="flex flex-wrap gap-1.5">
        {items.map((one) => (
          <Tag key={one} tone={tone ?? 'neutral'} dot={false}>
            {one}
          </Tag>
        ))}
      </div>
    </div>
  );
}

/** Where she is in an app: its overview, a page of it, its data, its activity. */
export type AppTab = 'overview' | 'activity' | 'data' | `page:${string}`;

/** An app's kinds, those that hold something first. */
function useAppKinds(name: string) {
  const { data: kinds = [], isLoading } = useKinds();
  const mine = kinds.filter((kind) => kind.model?.app === name).sort((a, b) => b.count - a.count);
  return { mine, isLoading };
}

// An app (v3 D21, « Modèle d'app »): its menu on the left — Aperçu, its pages (dashboards its
// bundle declares), its data (each kind, with the renders its facets allow, « Liste + détail »
// first), its activity — and the content on the right. On a phone, the menu becomes tabs. A richer
// app adds pages, never a layout: every app is drawn by this one shell.
export function AppPage() {
  const { name } = useParams({ from: '/apps/$name' });
  const search = useSearch({ from: '/apps/$name' });
  const navigate = useNavigate({ from: '/apps/$name' });
  const { mine, isLoading } = useAppKinds(name);
  const { data: pages = [] } = useQuery({
    queryKey: ['pages', name],
    queryFn: () => api<AppPageRow[]>(`/pages?app=${encodeURIComponent(name)}`),
  });
  const withData = mine.filter((one) => one.count > 0);
  const tab: AppTab = search.t ?? (search.v || search.kind ? 'data' : 'overview');
  const kind =
    search.kind && mine.some((one) => one.kind === search.kind) ? search.kind : undefined;
  const scope = kind ? mine.filter((one) => one.kind === kind) : mine;
  const has = (facet: string) =>
    scope.some((one) => (one.facets ?? []).some((f) => f.facet === facet));
  const renders: RenderKey[] = [
    'split',
    'list',
    ...(has('who') ? (['cards'] as const) : []),
    ...(has('place') ? (['map'] as const) : []),
    'table',
    ...(has('stages') ? (['board'] as const) : []),
    ...(has('dated') ? (['calendar', 'timeline'] as const) : []),
    'files',
  ];
  const go = (next: { t?: AppTab; kind?: string }) =>
    void navigate({
      search: (was: Record<string, unknown>) =>
        ({
          ...(next.t === 'data' ? { v: was.v } : {}),
          t: next.t === 'overview' ? undefined : next.t,
          kind: next.kind,
        }) as never,
      replace: true,
    });
  const names = scope.map((one) => one.kind);
  const source = useKindRows(names);
  const { files } = useFiles(names);
  const page = tab.startsWith('page:') ? pages.find((one) => `page:${one.id}` === tab) : undefined;

  type Item = { key: string; label: string; n?: number; on: boolean; go: () => void };
  const groups: { title: string | null; items: Item[] }[] = [
    {
      title: null,
      items: [
        {
          key: 'overview',
          label: 'Aperçu',
          on: tab === 'overview',
          go: () => go({ t: 'overview' }),
        },
      ],
    },
    {
      title: 'Pages',
      items: pages.map((one) => ({
        key: one.id,
        label: say(one.label, one.title),
        on: tab === `page:${one.id}`,
        go: () => go({ t: `page:${one.id}` }),
      })),
    },
    {
      title: 'Données',
      items: (withData.length ? withData : mine).map((one) => ({
        key: one.kind,
        label: nameOf(one),
        n: one.count,
        on: tab === 'data' && kind === one.kind,
        go: () => go({ t: 'data', kind: one.kind }),
      })),
    },
    {
      title: null,
      items: [
        {
          key: 'activity',
          label: 'Activité',
          on: tab === 'activity',
          go: () => go({ t: 'activity' }),
        },
      ],
    },
  ];
  const all = groups.flatMap((g) => g.items);
  return (
    <>
      <PageHead
        title={name}
        icon={<AppIcon name={name} size={28} />}
        lead={mine.map((one) => nameOf(one)).join(' · ')}
      />
      {/* On a phone and a tablet: the menu as tabs. */}
      <div className="lg:hidden">
        <Tabs
          tabs={all.map((one) => ({ key: one.key, label: one.label }))}
          value={all.find((one) => one.on)?.key ?? 'overview'}
          onChange={(key) => all.find((one) => one.key === key)?.go()}
          label="Menu de l’app"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Menu de l’app" className="sticky top-0 hidden flex-col gap-3 lg:flex">
          {groups
            .filter((g) => g.items.length)
            .map((g, at) => (
              <div key={at} className="flex flex-col gap-0.5">
                {g.title && <Caps className="px-2.5 pb-1">{g.title}</Caps>}
                {g.items.map((one) => (
                  <button
                    key={one.key}
                    onClick={one.go}
                    aria-current={one.on ? 'page' : undefined}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[2px] px-2.5 py-1.5 text-left text-[13.5px]',
                      one.on
                        ? 'bg-paper font-semibold text-ink shadow-card'
                        : 'text-bark hover:bg-sand hover:text-ink',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{one.label}</span>
                    {one.n !== undefined && (
                      <span className="font-mono text-[11px] text-faint">{one.n}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
        </nav>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] auto-rows-max gap-4">
          {tab === 'overview' ? (
            isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <Overview kinds={mine} />
            )
          ) : tab === 'activity' ? (
            <Journal
              query={`limit=200&kinds=${encodeURIComponent(mine.map((one) => one.kind).join(','))}`}
              queryKey={['history', 'app', name]}
            />
          ) : page ? (
            <PageView id={page.id} />
          ) : (
            <View source={source} files={files} renders={renders} />
          )}
        </div>
      </div>
    </>
  );
}

interface AppPageRow {
  id: string;
  title: string;
  app: string | null;
  label: { fr?: string; en?: string } | null;
}
interface DrawnPage {
  id: string;
  title: string;
  label: { fr?: string; en?: string } | null;
  filters: { name: string; type: string; options?: string[]; value: string; label?: unknown }[];
  blocks: Drawn[];
  vocabulary: Vocabulary;
}

/** A page of an app as a dashboard (v3 D21): its filters, then its blocks from the registry. */
export function PageView({ id }: { id: string }) {
  const client = useQueryClient();
  const [params, setParams] = useState<Record<string, string>>({});
  const query = new URLSearchParams(params).toString();
  const { data, isLoading, error } = useQuery({
    queryKey: ['entries', 'page', id, query],
    queryFn: () => api<DrawnPage>(`/pages/${id}${query ? `?${query}` : ''}`),
  });
  if (isLoading) return <Skeleton className="h-60" />;
  if (error || !data)
    return <Empty title="Page indisponible" lead={(error as Error | null)?.message ?? ''} />;
  return (
    <>
      {data.filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {data.filters.map((filter) =>
            filter.type === 'month' ? (
              <input
                key={filter.name}
                type="month"
                aria-label={say(filter.label as never, filter.name)}
                value={params[filter.name] ?? filter.value}
                onChange={(event) => setParams({ ...params, [filter.name]: event.target.value })}
                className={inputClass.replace('w-full', 'w-auto')}
              />
            ) : filter.type === 'choice' ? (
              <Select
                key={filter.name}
                label={say(filter.label as never, filter.name)}
                value={params[filter.name] ?? filter.value}
                onChange={(value) => setParams({ ...params, [filter.name]: value })}
                options={(filter.options ?? []).map((one) => ({ value: one, label: one }))}
                className="w-auto"
              />
            ) : null,
          )}
        </div>
      )}
      <PageBlocks
        blocks={data.blocks}
        vocabulary={data.vocabulary}
        refresh={() => void client.invalidateQueries({ queryKey: ['entries'] })}
      />
    </>
  );
}
