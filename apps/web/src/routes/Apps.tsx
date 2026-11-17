import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { api } from '../lib/api';

import { useSession } from '../lib/session';
import { type Kind, useKinds } from '../lib/kinds';
import {
  AppIcon,
  Button,
  Empty,
  PageHead,
  Panel,
  Segmented,
  Sheet,
  Skeleton,
  Tabs,
  Tag,
  type TagTone,
} from '../ui';
import { Overview } from './Overview';
import { useFiles, useKindRows } from '../engine/sources';
import { RENDER_WORDS } from '../engine/Toolbar';
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
/** « Model « Plante » » → « Plante (type) »: the pieces in her words. */
const piece = (text: string) =>
  text
    .replace(/^Model « (.*) »$/, '$1 (type)')
    .replace(/^Page « (.*) »$/, '$1 (page)')
    .replace(/^Rule « (.*) »$/, '$1 (règle)')
    .replace(/^Script « (.*) »$/, '$1 (script)')
    .replace(/^App « (.*) »$/, '$1 (app)');

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
                    <Section title="Ce qu’elle crée" items={report.created.map(piece)} />
                    {report.kept.length > 0 && (
                      <Section title="Déjà là, gardé tel quel" items={report.kept.map(piece)} />
                    )}
                    {report.reuse.length > 0 && (
                      <Section
                        title="Ce que tu as déjà et qu’elle peut utiliser"
                        items={report.reuse.map(
                          (one) => `${one.count} « ${one.from} » → ${one.to}`,
                        )}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px]">
                      Version {report.from} → {report.to}. Ce que tu as changé reste à toi.
                    </p>
                    <Section title="Mis à jour" items={report.updated.map(piece)} />
                    <Section title="Ajouté" items={report.created.map(piece)} />
                    {report.conflicts.length > 0 && (
                      <Section
                        title="Gardé comme tu l’as fait (l’app l’a aussi changé)"
                        items={report.conflicts.map(piece)}
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

export type AppTab = 'overview' | 'activity';

/** An app's kinds, those that hold something first. */
function useAppKinds(name: string) {
  const { data: kinds = [], isLoading } = useKinds();
  const mine = kinds.filter((kind) => kind.model?.app === name).sort((a, b) => b.count - a.count);
  return { mine, isLoading };
}

// An app (v3 D14), as gr8r shows a project: its tabs — Aperçu, then the renders its kinds allow
// (by their facets: a board for steps, a calendar and a timeline for dates), its files and its
// activity — all the same view engine as the views across her life, its source being its kinds.
export function AppPage() {
  const { name } = useParams({ from: '/apps/$name' });
  const search = useSearch({ from: '/apps/$name' });
  const navigate = useNavigate({ from: '/apps/$name' });
  const { mine, isLoading } = useAppKinds(name);
  const kinds = mine.map((one) => one.kind);
  const has = (facet: string) =>
    mine.some((one) => (one.facets ?? []).some((f) => f.facet === facet));
  const renders: RenderKey[] = [
    'list',
    ...(has('who') ? (['cards'] as const) : []),
    'table',
    ...(has('stages') ? (['board'] as const) : []),
    ...(has('dated') ? (['calendar', 'timeline'] as const) : []),
    'files',
  ];
  const tab: AppTab | RenderKey =
    search.t ?? (search.v && renders.includes(search.v) ? search.v : 'overview');
  const go = (next: AppTab | RenderKey) =>
    void navigate({
      search: (was: Record<string, unknown>) =>
        (next === 'overview' || next === 'activity'
          ? { t: next === 'overview' ? undefined : next }
          : { ...was, t: undefined, v: next }) as never,
      replace: true,
    });
  const source = useKindRows(kinds);
  const { files } = useFiles(kinds);
  const tabs: { key: AppTab | RenderKey; label: string }[] = [
    { key: 'overview', label: 'Aperçu' },
    ...renders.map((key) => ({ key, label: RENDER_WORDS[key].label })),
    { key: 'activity', label: 'Activité' },
  ];
  const withData = mine.filter((one) => one.count > 0);
  return (
    <>
      <PageHead
        title={name}
        icon={<AppIcon name={name} size={28} />}
        badge={`${mine.length} type(s)`}
        lead={mine.map((one) => nameOf(one)).join(' · ')}
      />
      <Tabs tabs={tabs} value={tab} onChange={go} label="Vues de l’app" />
      {tab === 'overview' ? (
        isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <Overview kinds={mine} />
        )
      ) : tab === 'activity' ? (
        <Journal
          query={`limit=200&kinds=${encodeURIComponent(kinds.join(','))}`}
          queryKey={['history', 'app', name]}
        />
      ) : (
        <>
          {withData.length > 1 && tab !== 'files' && (
            <Segmented
              label="Type"
              value={search.kind ?? ''}
              onChange={(value) =>
                void navigate({
                  search: (was: Record<string, unknown>) =>
                    ({ ...was, kind: value || undefined }) as never,
                  replace: true,
                })
              }
              options={[
                { value: '', label: 'Tous' },
                ...withData.map((one) => ({ value: one.kind, label: nameOf(one), n: one.count })),
              ]}
            />
          )}
          <View source={source} files={files} renders={[tab as RenderKey]} />
        </>
      )}
    </>
  );
}
