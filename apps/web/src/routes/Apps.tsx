import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Shapes } from 'lucide-react';
import { api } from '../lib/api';

import { useSession } from '../lib/session';
import { type Kind, useKinds } from '../lib/kinds';
import { AppIcon, Empty, PageHead, Panel, Skeleton, Tag, rowClass } from '../ui';

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

export function AppPage() {
  const { name } = useParams({ from: '/apps/$name' });
  const { data: kinds, isLoading } = useKinds();
  const mine = (kinds ?? []).filter((kind) => kind.model?.app === name);
  return (
    <>
      <PageHead
        title={name}
        icon={<AppIcon name={name} size={28} />}
        badge={`${mine.length} type(s)`}
        lead="Ses types et ce qu’ils sont. Ses vues arrivent avec le moteur de vues."
      />
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
    </>
  );
}
