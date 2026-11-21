import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Database,
  FileText,
  History,
  Inbox,
  LayoutGrid,
  Compass,
  Link2,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { PeriodBar } from './PageCompose';
import { FieldsEditor, openFollow, type Field as EditableField } from './Follow';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { api } from '../lib/api';

import { useSession } from '../lib/session';
import { type Kind, useKindName, useKinds } from '../lib/kinds';
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
import { Select, toast } from '../ui/more';
import { showValue } from '../engine/format';
import { PageBlocks, say, type Drawn, type Vocabulary } from '../blocks/Blocks';
import { CardsEditor } from '../blocks/Cards';
import { Overview } from './Overview';
import { useFiles, useKindRows } from '../engine/sources';
import type { RenderKey } from '../engine/types';
import { View } from '../engine/View';
import { Journal } from './Activity';
import { QueuePanel, forApp, useQueue, type ToSort } from './Queue';

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
interface Example {
  kind: string;
  label: string;
  title: string;
  fields: { name: string; label: string; type: string; value: unknown }[];
}
interface InstallReport {
  /** One example entry of each kind it brings (v3 F7): drawn from its models, nothing written. */
  examples?: Example[];
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
/**
 * Collections that live in no app yet (made before, or by an assistant): each placed in one in a
 * gesture, so nothing she keeps is out of reach of the menu.
 */
function Unplaced({ apps }: { apps: string[] }) {
  const client = useQueryClient();
  const { data: kinds = [] } = useKinds();
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const place = useMutation({
    mutationFn: ({ kind, app }: { kind: string; app: string }) =>
      api(`/collections/${encodeURIComponent(kind)}/app`, { method: 'PUT', body: { app } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['apps'] });
    },
  });
  const lost = kinds.filter((one) => one.model && !one.model.app);
  if (!lost.length) return null;
  return (
    <Panel title={`À ranger (${lost.length})`} className="mb-4">
      <p className="px-4 pt-3 text-[13px] text-bark">
        Ces collections ne sont dans aucune app : range chacune là où tu la cherches.
      </p>
      {lost.map((one) => (
        <div
          key={one.kind}
          className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5 last:border-0"
        >
          <span className="min-w-0 flex-1 truncate font-semibold">
            {one.model?.label?.fr ?? one.kind}
            <span className="ml-2 font-mono text-[11px] text-faint">{one.count}</span>
          </span>
          <Select
            label={`Ranger ${one.kind}`}
            value=""
            placeholder="Ranger dans…"
            className="w-auto"
            onChange={(app) =>
              app === '__new__'
                ? setFresh({ ...fresh, [one.kind]: '' })
                : place.mutate({ kind: one.kind, app })
            }
            options={[
              ...apps.map((app) => ({ value: app, label: app })),
              { value: '__new__', label: 'Une nouvelle app…' },
            ]}
          />
          {one.kind in fresh && (
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (fresh[one.kind]?.trim())
                  place.mutate({ kind: one.kind, app: fresh[one.kind]!.trim() });
              }}
            >
              <input
                autoFocus
                className={inputClass.replace('w-full', 'w-44')}
                value={fresh[one.kind]}
                placeholder="Nom de l’app"
                onChange={(event) => setFresh({ ...fresh, [one.kind]: event.target.value })}
              />
              <Button size="sm" type="submit">
                Ranger
              </Button>
            </form>
          )}
        </div>
      ))}
    </Panel>
  );
}

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
        actions={
          <Button tone="solid" onClick={() => openFollow()}>
            <Plus size={15} />
            Suivre quelque chose
          </Button>
        }
      />
      <Unplaced apps={[...installed.map((one) => one.app), ...own.map((one) => one.app)]} />
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
                    {!!report.examples?.length && <Examples examples={report.examples} />}
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

/** What the app's entries would look like (v3 F7): one example of each kind, as a small fiche. */
function Examples({ examples }: { examples: Example[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <b className="text-[13px] font-semibold">À quoi ça ressemble</b>
      <div className="grid gap-2 sm:grid-cols-2">
        {examples.map((one) => (
          <div key={one.kind} className="min-w-0 rounded-[12px] border border-rule bg-paper">
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
              <Tag tone="neutral" dot={false}>
                {one.label}
              </Tag>
              <span className="min-w-0 truncate text-[13px] font-semibold text-bark italic">
                {one.title}
              </span>
            </div>
            <dl className="grid gap-1 px-3 py-2">
              {one.fields.map((field) => (
                <div
                  key={field.name}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 text-[12.5px]"
                >
                  <dt className="truncate text-bark">{field.label}</dt>
                  <dd className="truncate">
                    {showValue(field.value, {
                      path: field.name,
                      label: field.label,
                      type: field.type,
                    } as never)}
                    {field.type === 'amount' ? ' €' : ''}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="text-xs text-faint">Un exemple, pour voir : rien n’est écrit chez toi.</p>
    </div>
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
export type AppTab = 'overview' | 'queue' | 'activity' | 'data' | `page:${string}`;

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
    // Cards for people (who they are) and for what has a photo (its cover).
    ...(has('who') || scope.some((one) => (one.model?.fields ?? []).some((f) => f.type === 'file'))
      ? (['cards'] as const)
      : []),
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
  // « Désinstaller » (v3 F7): what would go, tried first; her entries always stay; one gesture to
  // undo it from the Activity.
  const client = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const labelsHere = Object.fromEntries(mine.map((one) => [one.kind, nameOf(one)]));
  const removal = useQuery({
    queryKey: ['apps', 'remove', name],
    queryFn: () =>
      api<Tried<{ removed: string[]; kept: string[] }>>('/apps/remove', {
        method: 'POST',
        body: { name, dryRun: true },
      }),
    enabled: leaving,
  });
  const uninstall = useMutation({
    mutationFn: () => api('/apps/remove', { method: 'POST', body: { name, dryRun: false } }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => {
      setLeaving(false);
      toast(`« ${name} » est désinstallée. Tes entrées restent ; l’Activité l’annule d’un geste.`);
      void client.invalidateQueries({ queryKey: ['apps'] });
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['history'] });
      void navigate({ to: '/apps' });
    },
  });
  // What waits for her yes among this app's kinds (F5): the one queue, seen from here.
  const { data: queue = [] } = useQueue();
  const kindsHere = mine.map((one) => one.kind);
  const waitsHere = (one: ToSort) => forApp(one, name, kindsHere);
  const waiting = queue.filter(waitsHere).length;

  type Item = {
    key: string;
    label: string;
    n?: number;
    on: boolean;
    go: () => void;
    icon: LucideIcon;
  };
  const groups: { title: string | null; items: Item[] }[] = [
    {
      title: null,
      items: [
        {
          key: 'overview',
          label: 'Aperçu',
          icon: LayoutGrid,
          on: tab === 'overview',
          go: () => go({ t: 'overview' }),
        },
        ...(waiting || tab === 'queue'
          ? [
              {
                key: 'queue',
                label: 'À valider',
                icon: Inbox,
                n: waiting,
                on: tab === 'queue',
                go: () => go({ t: 'queue' }),
              },
            ]
          : []),
      ],
    },
    {
      title: 'Pages',
      items: pages
        .map((one) => ({
          key: one.id,
          label: say(one.label, one.title),
          icon: FileText,
          on: tab === `page:${one.id}`,
          go: () => go({ t: `page:${one.id}` }),
        }))
        .concat({
          key: 'new-page',
          label: 'Nouvelle page',
          icon: Plus,
          on: false,
          go: () => void navigate({ to: '/composer', search: { app: name } }),
        }),
    },
    {
      title: 'Données',
      items: (withData.length ? withData : mine)
        .map((one): Item => ({
          key: one.kind,
          label: nameOf(one),
          icon: Database,
          n: one.count,
          on: tab === 'data' && kind === one.kind,
          go: () => go({ t: 'data', kind: one.kind }),
        }))
        .concat({
          key: 'follow',
          label: 'Suivre quelque chose',
          icon: Plus,
          on: false,
          go: () => openFollow(name),
        }),
    },
    {
      title: null,
      items: [
        {
          key: 'activity',
          label: 'Activité',
          icon: History,
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
        actions={
          <Button size="sm" tone="quiet" onClick={() => setLeaving(true)}>
            <Trash2 size={14} />
            Désinstaller
          </Button>
        }
      />
      <Sheet open={leaving} onOpenChange={setLeaving} title={`Désinstaller ${name}`}>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-[13.5px]">
            Ses pages, ses règles, ses scripts et ses types à elle sont mis de côté.{' '}
            <b>Tes entrées restent toutes</b>, et les types communs restent pour tes autres apps.
          </p>
          {removal.isLoading ? (
            <Skeleton className="h-20" />
          ) : removal.error ? (
            <p className="text-[13px] text-error">{(removal.error as Error).message}</p>
          ) : removal.data ? (
            <>
              <Section
                title="Mis de côté"
                items={piecesSaid(removal.data.result.removed, labelsHere)}
              />
              <Section title="Gardé" items={piecesSaid(removal.data.result.kept, labelsHere)} />
              <div className="flex gap-2">
                <Button
                  tone="danger"
                  disabled={uninstall.isPending}
                  onClick={() => uninstall.mutate()}
                >
                  Désinstaller
                </Button>
                <Button onClick={() => setLeaving(false)}>Annuler</Button>
              </div>
              <p className="text-xs text-faint">
                Une seule ligne au journal : annulable d’un geste depuis l’Activité.
              </p>
            </>
          ) : null}
        </div>
      </Sheet>
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
        <nav aria-label="Menu de l’app" className="sticky top-0 hidden flex-col lg:flex">
          {groups
            .filter((g) => g.items.length)
            .map((g, at) => (
              <div
                key={at}
                className={cn('flex flex-col gap-0.5', at > 0 && 'mt-3 border-t border-rule pt-3')}
              >
                {g.title && <Caps className="px-2.5 pb-1.5">{g.title}</Caps>}
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
                    <one.icon
                      size={14}
                      className={cn('flex-none', one.on ? 'text-primary' : 'text-faint')}
                    />
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
              <>
                <Overview kinds={mine} />
                <AppRole name={name} />
              </>
            )
          ) : tab === 'queue' ? (
            waiting ? (
              <QueuePanel only={waitsHere} />
            ) : (
              <Panel>
                <Empty
                  title="Rien n’attend ton oui ici"
                  lead="Ce qu’un agent, un document ou un assistant propose pour cette app arrivera ici."
                />
              </Panel>
            )
          ) : tab === 'activity' ? (
            <Journal
              query={`limit=200&kinds=${encodeURIComponent(mine.map((one) => one.kind).join(','))}`}
              queryKey={['history', 'app', name]}
            />
          ) : page ? (
            <PageView id={page.id} app={name} />
          ) : (
            <>
              {kind && <KindName kind={mine.find((one) => one.kind === kind)!} />}
              <View source={source} files={files} renders={renders} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** A kind's name as she reads it, changed in place (its model's label; v3). */
function KindName({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: (label: string) =>
      api('/kinds/label', { method: 'POST', body: { kind: kind.kind, label } }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => setDraft(null),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
  return draft === null ? (
    <div className="flex flex-wrap items-center gap-2">
      <b className="font-display text-[16px]">{nameOf(kind)}</b>
      <Button size="sm" tone="quiet" onClick={() => setDraft(nameOf(kind))}>
        <Pencil size={13} />
        Renommer
      </Button>
      <KindFields kind={kind} />
      <ShareKind kind={kind} />
    </div>
  ) : (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim()) rename.mutate(draft.trim());
      }}
    >
      <input
        autoFocus
        aria-label="Nouveau nom"
        className={inputClass.replace('w-full', 'w-64')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button size="sm" tone="solid" disabled={!draft.trim() || rename.isPending}>
        Garder
      </Button>
      <Button size="sm" type="button" onClick={() => setDraft(null)}>
        Annuler
      </Button>
    </form>
  );
}

/**
 * A kind's fields changed on screen (v3 D4, the types' editor): renamed in her words, another
 * simple type, options, added or taken off the model. Her entries keep their values.
 */
function KindFields({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const { data: kinds = [] } = useKinds();
  const [fields, setFields] = useState<EditableField[] | null>(null);
  const start = () =>
    setFields(
      (kind.model?.fields ?? [])
        .filter((field) => SIMPLE.has(field.type))
        .map((field) => ({
          name: field.name,
          label: (field as { label?: { fr?: string } }).label?.fr ?? field.name.replace(/_/g, ' '),
          type: field.type as EditableField['type'],
          ...((field as { options?: string[] }).options
            ? { options: (field as { options?: string[] }).options }
            : {}),
          ...((field as { target?: string }).target
            ? { target: (field as { target?: string }).target }
            : {}),
        })),
    );
  const save = useMutation({
    mutationFn: () =>
      api(`/collections/${encodeURIComponent(kind.kind)}/fields`, {
        method: 'PUT',
        body: { fields },
      }),
    onSuccess: () => {
      toast('Champs gardés — annulable dans l’Activité.');
      setFields(null);
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['entries'] });
    },
  });
  if (!kind.model) return null;
  return (
    <>
      <Button size="sm" tone="quiet" onClick={start}>
        <ListTree size={13} />
        Ses champs
      </Button>
      <Sheet
        open={fields !== null}
        onOpenChange={(open) => !open && setFields(null)}
        title={`Les champs de « ${nameOf(kind)} »`}
        wide
      >
        {fields && (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[13px] text-bark">
              Un champ retiré l’est du modèle seulement : les valeurs déjà notées restent sur tes
              entrées.
            </p>
            <FieldsEditor
              fields={fields}
              setFields={setFields}
              keepNames
              collections={kinds
                .filter((one) => one.model)
                .map((one) => ({ kind: one.kind, label: nameOf(one) }))}
            />
            <span className="flex gap-2">
              <Button
                tone="solid"
                disabled={!fields.length || save.isPending}
                onClick={() => save.mutate()}
              >
                Garder
              </Button>
              <Button onClick={() => setFields(null)}>Annuler</Button>
            </span>
          </div>
        )}
      </Sheet>
    </>
  );
}
const SIMPLE = new Set([
  'text',
  'long_text',
  'date',
  'datetime',
  'number',
  'amount',
  'choice',
  'multi_choice',
  'boolean',
  'rating',
  'duration',
  'link',
  'file',
  'location',
  'url',
]);

interface ShareRow {
  id: string;
  title: string;
  mode: 'form' | 'view';
  kind: string | null;
}

/**
 * A public link to one of her collections (spec 016): a form others fill (what comes through waits
 * in « À valider »), or a list she shows. The link is shown once; closing it stops it at once.
 */
function ShareKind({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'form' | 'view'>('form');
  const [link, setLink] = useState<string | null>(null);
  const fields = (kind.model?.fields ?? []).filter(
    (field) => !['formula', 'lines', 'button', 'link'].includes(field.type),
  );
  const [asked, setAsked] = useState<string[]>(fields.map((field) => field.name));
  const shares = useQuery({
    queryKey: ['shares'],
    queryFn: () => api<ShareRow[]>('/shares'),
    enabled: open,
  });
  const make = useMutation({
    mutationFn: () =>
      api<{ link: string }>('/shares', {
        method: 'POST',
        body: {
          name: `${mode === 'form' ? 'Formulaire' : 'Liste'} « ${nameOf(kind)} »`,
          data:
            mode === 'form'
              ? { mode, kind: kind.kind, fields: asked }
              : { mode, view: { kind: kind.kind } },
        },
      }),
    onSuccess: (made) => setLink(made.link),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => void client.invalidateQueries({ queryKey: ['shares'] }),
  });
  const close = useMutation({
    mutationFn: (id: string) =>
      api(`/entries/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
    onSuccess: () => toast('Lien fermé.'),
    onSettled: () => void client.invalidateQueries({ queryKey: ['shares'] }),
  });
  const mine = (shares.data ?? []).filter((one) => one.kind === kind.kind || one.mode === 'view');
  return (
    <>
      <Button size="sm" tone="quiet" onClick={() => setOpen(true)}>
        <Link2 size={13} />
        Partager par un lien
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={`Partager « ${nameOf(kind)} »`}>
        <div className="flex flex-col gap-4 p-4 text-[13.5px]">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'form'} onChange={() => setMode('form')} />
              Un formulaire pour en ajouter (ce qui arrive t’attend dans « À valider »)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'view'} onChange={() => setMode('view')} />
              Une liste à montrer, en lecture seule
            </label>
          </div>
          {mode === 'form' && fields.length > 0 && (
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5">
              <legend className="pb-1 text-[12.5px] text-bark">Ce que le formulaire demande</legend>
              {fields.map((field) => (
                <label key={field.name} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={asked.includes(field.name)}
                    onChange={(event) =>
                      setAsked(
                        event.target.checked
                          ? [...asked, field.name]
                          : asked.filter((one) => one !== field.name),
                      )
                    }
                  />
                  {field.name.replace(/_/g, ' ')}
                </label>
              ))}
            </fieldset>
          )}
          {link ? (
            <div className="flex flex-col gap-1.5">
              <input
                readOnly
                aria-label="Lien de partage"
                className={inputClass}
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <span className="text-xs text-faint">
                Montré une seule fois : copie-le maintenant. Qui a le lien peut l’ouvrir.
              </span>
            </div>
          ) : (
            <span>
              <Button tone="solid" disabled={make.isPending} onClick={() => make.mutate()}>
                Créer le lien
              </Button>
            </span>
          )}
          {mine.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-rule pt-3">
              <b className="text-[13px]">Liens ouverts</b>
              {mine.map((one) => (
                <div key={one.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{one.title}</span>
                  <Button size="sm" disabled={close.isPending} onClick={() => close.mutate(one.id)}>
                    Fermer le lien
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}

interface AppRoleData {
  app: string;
  role: {
    covers?: string | { fr?: string };
    intents: string[];
    reads: string[];
    writes: string[];
    watches: string[];
  };
  kinds: string[];
}

/**
 * An app's role among her apps (spec 033): what it covers, the words that call it, what it reads
 * and writes, its bridges to the others. Assistants read the same, to know when it is concerned.
 */
function AppRole({ name }: { name: string }) {
  const kindName = useKindName();
  const mine = useQuery({
    queryKey: ['apps', 'mine-role'],
    queryFn: () =>
      api<{ apps: AppRoleData[]; bridges: { app?: string; title: string }[] }>('/apps/mine'),
  });
  const one = mine.data?.apps.find((app) => app.app === name);
  if (!one) return null;
  const said = (text: AppRoleData['role']['covers']) =>
    typeof text === 'string' ? text : (text?.fr ?? '');
  const bridges = (mine.data?.bridges ?? []).filter((bridge) => bridge.app === name);
  const chips = (list: string[], kinds: boolean) =>
    list.length ? (
      <span className="flex flex-wrap gap-1">
        {[...new Set(list)].map((word) => (
          <Tag key={word} tone="neutral" dot={false}>
            {kinds ? kindName(word) : `« ${word} »`}
          </Tag>
        ))}
      </span>
    ) : (
      <span className="text-faint">—</span>
    );
  const line = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-baseline gap-3 border-b border-rule px-4 py-2.5 last:border-0">
      <dt className="text-[13px] text-bark">{label}</dt>
      <dd className="min-w-0 text-[13.5px]">{value}</dd>
    </div>
  );
  return (
    <Panel title="Son rôle" icon={<Compass size={16} />}>
      <dl>
        {line('Ce qu’elle couvre', said(one.role.covers) || '—')}
        {line('Ce que tu dis', chips(one.role.intents.slice(0, 20), false))}
        {line('Elle lit', chips([...one.role.reads, ...one.role.watches], true))}
        {line('Elle écrit', chips([...one.role.writes, ...one.kinds], true))}
        {line(
          'Ses ponts',
          bridges.length ? bridges.map((bridge) => bridge.title).join(' · ') : '—',
        )}
      </dl>
    </Panel>
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
  period: { period: string; unit: 'week' | 'month'; from: string; to: string } | null;
  label: { fr?: string; en?: string } | null;
  filters: { name: string; type: string; options?: string[]; value: string; label?: unknown }[];
  blocks: Drawn[];
  vocabulary: Vocabulary;
}

/** A page of an app as a dashboard (v3 D21): its filters, then its blocks from the registry. */
export function PageView({ id, app }: { id: string; app?: string }) {
  const client = useQueryClient();
  const [params, setParams] = useState<Record<string, string>>({});
  // « Modifier » (spec 107): the page changed on the page itself.
  const [editing, setEditing] = useState(false);
  const raw = useQuery({
    queryKey: ['entry', id],
    queryFn: () =>
      api<{ id: string; title: string; data: Record<string, unknown> & { blocks?: never[] } }>(
        `/entries/${id}`,
      ),
    enabled: editing,
  });
  const query = new URLSearchParams(params).toString();
  const { data, isLoading, error } = useQuery({
    queryKey: ['entries', 'page', id, query],
    queryFn: () => api<DrawnPage>(`/pages/${id}${query ? `?${query}` : ''}`),
  });
  if (isLoading) return <Skeleton className="h-60" />;
  if (error || !data)
    return <Empty title="Page indisponible" lead={(error as Error | null)?.message ?? ''} />;
  if (editing)
    return raw.data ? (
      <CardsEditor
        page={raw.data}
        place={app ? { app } : {}}
        title={raw.data.title}
        onDone={() => setEditing(false)}
      />
    ) : (
      <Skeleton className="h-60" />
    );
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {data.period && (
          <PeriodBar
            period={data.period}
            onChange={(value) =>
              setParams({
                ...params,
                [data.filters.find((one) => one.type === 'period')?.name ?? 'period']: value,
              })
            }
          />
        )}
        <Button size="sm" className="ml-auto" onClick={() => setEditing(true)}>
          <Pencil size={14} />
          Modifier
        </Button>
      </div>
      {data.filters.some((one) => one.type === 'month' || one.type === 'choice') && (
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
