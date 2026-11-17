import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Chip, Empty, PageHead, Panel, Skeleton, colorOf } from '../ui';

// Her apps (v3 D14, first form): each with its kinds and what they are (their facets). The app's
// views and its overview come with the view engine (V5) and the templates (V6).

interface MyApps {
  apps: { app: string; kinds: string[]; line?: string; role?: { covers?: unknown } }[];
}
interface Kind {
  kind: string;
  count: number;
  facets?: { facet: string }[];
  model?: { app?: string; label?: Record<string, string> };
  common?: { fr: string };
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

function AppMark({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-xl font-display font-bold text-white"
      style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.42 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function Apps() {
  const { space } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['apps', space.id],
    queryFn: () => api<MyApps>('/apps/mine'),
  });
  return (
    <>
      <PageHead title="Mes apps" lead={`Les apps de l’espace ${space.name}.`} />
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
          {data.apps.map((one) => (
            <Link
              key={one.app}
              to="/apps/$name"
              params={{ name: one.app }}
              className="flex min-w-0 gap-3 rounded-xl border border-rule bg-paper p-4 shadow-card hover:border-rule-strong"
            >
              <AppMark name={one.app} />
              <span className="min-w-0">
                <b className="block truncate font-display">{one.app}</b>
                <span className="line-clamp-2 text-[13px] text-bark">
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
  const { data: kinds, isLoading } = useQuery({
    queryKey: ['kinds'],
    queryFn: () => api<Kind[]>('/kinds'),
  });
  const mine = (kinds ?? []).filter((kind) => kind.model?.app === name);
  return (
    <>
      <PageHead
        title={name}
        icon={<AppMark name={name} size={32} />}
        lead="Ses types et ce qu’ils sont. Ses vues arrivent avec le moteur de vues."
      />
      <Panel title="Ses types">
        {isLoading ? (
          <Skeleton className="m-4 h-16" />
        ) : (
          mine.map((kind) => (
            <div
              key={kind.kind}
              className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3 last:border-0"
            >
              <b className="min-w-0 flex-1 truncate text-sm">{nameOf(kind)}</b>
              <span className="flex flex-wrap gap-1">
                {(kind.facets ?? []).map((facet) => (
                  <Chip key={facet.facet} tone="info">
                    {FACET_WORDS[facet.facet] ?? facet.facet}
                  </Chip>
                ))}
              </span>
              <span className="w-16 text-right font-mono text-xs text-bark">{kind.count}</span>
            </div>
          ))
        )}
      </Panel>
    </>
  );
}
