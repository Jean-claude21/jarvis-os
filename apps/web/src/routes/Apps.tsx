import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Shapes } from 'lucide-react';
import { api } from '../lib/api';

import { useSession } from '../lib/session';
import { type Kind, useKinds } from '../lib/kinds';
import { AppIcon, Empty, PageHead, Panel, Segmented, Skeleton, Tag, rowClass } from '../ui';
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

const FACET_WORDS: Record<string, string> = {
  dated: 'daté',
  todo: 'à faire',
  recurring: 'récurrent',
  measurable: 'mesurable',
  amount: 'montant',
  stages: 'étapes',
  document: 'document',
  who: 'personne',
  place: 'lieu',
};

const nameOf = (kind: Kind) => kind.model?.label?.fr ?? kind.common?.fr ?? kind.kind;

export function Apps() {
  const { space } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['apps', space.id],
    queryFn: () => api<MyApps>('/apps/mine'),
  });
  return (
    <>
      <PageHead
        title="Mes apps"
        badge={data ? `${data.apps.length} app(s)` : undefined}
        lead={`Les services de l’espace ${space.name}.`}
      />
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !data?.apps.length ? (
        <Panel>
          <Empty
            title="Aucune app ici"
            lead="Demande à ton assistant l’app qu’il te faut : il te la propose, tu l’essaies, puis tu l’installes."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
          {data.apps.map((one) => (
            <Link
              key={one.app}
              to="/apps/$name"
              params={{ name: one.app }}
              className="flex min-w-0 gap-3 rounded-[2px] border border-rule bg-paper p-3.5 hover:bg-sand"
            >
              <AppIcon name={one.app} size={32} />
              <span className="min-w-0">
                <b className="block truncate font-display text-[15px] font-semibold">{one.app}</b>
                <span className="line-clamp-2 text-[12.5px] text-bark">
                  {one.line ?? `${one.kinds.length} types`}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
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
      <nav
        className="-mt-1 flex gap-0.5 overflow-x-auto border-b border-rule"
        aria-label="Vues de l’app"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => go(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={
              '-mb-px cursor-pointer border-b-2 px-3 py-2 text-[13.5px] whitespace-nowrap ' +
              (tab === key
                ? 'border-primary font-semibold text-ink'
                : 'border-transparent text-bark hover:text-ink')
            }
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <Panel title="Ses types" icon={<Shapes size={16} />}>
          {isLoading ? (
            <Skeleton className="m-4 h-16" />
          ) : (
            mine.map((kind) => (
              <div key={kind.kind} className={rowClass + ' flex-wrap'}>
                <b className="min-w-0 flex-1 truncate font-semibold">{nameOf(kind)}</b>
                <span className="flex flex-wrap gap-1">
                  {(kind.facets ?? []).map((facet) => (
                    <Tag key={facet.facet} tone="info">
                      {FACET_WORDS[facet.facet] ?? facet.facet}
                    </Tag>
                  ))}
                </span>
                <span className="w-12 text-right font-mono text-xs text-bark">{kind.count}</span>
              </div>
            ))
          )}
        </Panel>
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
