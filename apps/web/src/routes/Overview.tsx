import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClock, Flag, Layers3 } from 'lucide-react';
import { api } from '../lib/api';
import { useKindName, type Kind } from '../lib/kinds';
import { keyValue, showValue } from '../engine/format';
import { useFiles, useKindRows } from '../engine/sources';
import { asDate } from '../engine/renders/time';
import { Empty, Panel, Stat, Stats, colorOf, rowClass } from '../ui';
import { Journal } from './Activity';

// L'Aperçu d'une app (v3 D11, the « Aperçu » template): drawn from its kinds' facets only — the
// figures (how many, what is under way, what is due, the totals), its steps as a funnel, what
// comes, its goals and how far they went, its last files and its activity. Nothing is laid out by
// hand: an app that says what its kinds are gets this page.

type Facet = {
  facet: string;
  start?: string;
  end?: string;
  field?: string;
  amount?: string;
  target?: string;
};
type KindFacets = Kind & {
  facets?: Facet[];
  model?: Kind['model'] & { label?: Record<string, string> };
};

interface Goal {
  id: string;
  title: string;
  target: number | null;
  unit: string | null;
  deadline: string | null;
  current: number | null;
  ratio: number | null;
  daysLeft: number | null;
}

const has = (kind: KindFacets, facet: string): Facet | undefined =>
  ((kind.facets ?? []) as Facet[]).find((one) => one.facet === facet);

export function Overview({ kinds }: { kinds: KindFacets[] }) {
  const kindName = useKindName();
  const names = kinds.map((one) => one.kind);
  const source = useKindRows(names);
  const { files } = useFiles(names);
  const goalsWanted = kinds.some((one) => has(one, 'measurable'));
  const { data: goals = [] } = useQuery({
    queryKey: ['entries', 'goals'],
    queryFn: () => api<Goal[]>('/goals'),
    enabled: goalsWanted,
  });
  if (!kinds.length) return <Empty title="Aucun type" lead="Cette app n’a pas encore de types." />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today.getTime() + 30 * 86_400_000);
  // The app's main kind: the one that carries its steps or its targets (an Objectif, not each of
  // its Avancées), else the one with the most entries.
  const weight = (one: KindFacets) => (has(one, 'stages') || has(one, 'measurable') ? 1 : 0);
  const main = [...kinds].sort((a, b) => weight(b) - weight(a) || b.count - a.count)[0]!;
  const stages = kinds
    .map((one) => ({ kind: one, facet: has(one, 'stages') }))
    .find((one) => one.facet?.field);
  const stageField = stages
    ? source.fields.find((one) => one.path === stages.facet!.field)
    : undefined;
  const amounts = kinds.flatMap((one) => {
    const facet = has(one, 'amount');
    return facet?.amount ? [{ kind: one.kind, path: facet.amount }] : [];
  });
  const coming = source.rows
    .filter((row) => row.start && asDate(row.start) >= today)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const myGoals = goals.filter((goal) => source.rows.some((row) => row.id === goal.id));

  // The figures: as many as the facets say, four at most.
  const stats: { label: string; value: string | number; sub?: string }[] = [
    { label: kindName(main.kind), value: main.count, sub: `${source.rows.length} entrées en tout` },
  ];
  if (stages && stageField) {
    const first = stageField.options?.[0];
    const atFirst = source.rows.filter(
      (row) => row.kind === stages.kind.kind && keyValue(row.values[stageField.path]) === first,
    ).length;
    stats.push({
      label: first ? showValue(first, stageField) : 'Étapes',
      value: atFirst,
      sub: `sur ${source.rows.filter((row) => row.kind === stages.kind.kind).length} ${kindName(stages.kind.kind).toLowerCase()}`,
    });
  }
  if (kinds.some((one) => has(one, 'dated')))
    stats.push({
      label: 'Dans les 30 jours',
      value: coming.filter((row) => asDate(row.start!) < in30).length,
      sub: coming[0] ? `prochain : ${showValue(coming[0].start)}` : 'rien de prévu',
    });
  for (const one of amounts.slice(0, 4 - stats.length)) {
    const field = source.fields.find((f) => f.path === one.path);
    const total = source.rows
      .filter((row) => row.kind === one.kind)
      .reduce(
        (sum, row) =>
          sum + (typeof row.values[one.path] === 'number' ? (row.values[one.path] as number) : 0),
        0,
      );
    stats.push({
      label: `Total · ${field?.label ?? one.path}`,
      value: showValue(total, field) || '0',
    });
  }
  if (goalsWanted && stats.length < 4 && myGoals.length) {
    const ratios = myGoals.map((goal) => goal.ratio).filter((one): one is number => one !== null);
    stats.push({
      label: 'Avancement moyen',
      value: ratios.length
        ? `${Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)} %`
        : '—',
      sub: `${myGoals.length} objectif(s)`,
    });
  }

  const counts = stageField
    ? [...(stageField.options ?? []), ''].map((option) => ({
        option,
        n: source.rows.filter(
          (row) =>
            row.kind === stages!.kind.kind && keyValue(row.values[stageField.path]) === option,
        ).length,
      }))
    : [];
  const most = Math.max(1, ...counts.map((one) => one.n));

  return (
    <>
      <Stats>
        {stats.slice(0, 4).map((one) => (
          <Stat
            key={one.label}
            label={one.label}
            value={one.value}
            {...(one.sub ? { sub: one.sub } : {})}
          />
        ))}
      </Stats>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {myGoals.length > 0 && (
            <Panel title="Objectifs" icon={<Flag size={16} />}>
              {myGoals.map((goal) => (
                <Link
                  key={goal.id}
                  to="/entree/$id"
                  params={{ id: goal.id }}
                  className={rowClass + ' flex-wrap'}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{goal.title}</span>
                    <span className="block text-[12.5px] text-bark">
                      {goal.target !== null
                        ? `${goal.current ?? 0} / ${goal.target}${goal.unit ? ` ${goal.unit}` : ''}`
                        : 'sans chiffre'}
                      {goal.daysLeft !== null ? ` · ${goal.daysLeft} j restants` : ''}
                    </span>
                  </span>
                  <span className="flex w-40 items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                      <span
                        className="block h-full rounded-full bg-success"
                        style={{ width: `${Math.round((goal.ratio ?? 0) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-xs text-bark">
                      {goal.ratio === null ? '—' : `${Math.round(goal.ratio * 100)} %`}
                    </span>
                  </span>
                </Link>
              ))}
            </Panel>
          )}
          {counts.length > 0 && (
            <Panel title={`${kindName(stages!.kind.kind)} par étape`} icon={<Layers3 size={16} />}>
              <div className="flex flex-col gap-2 px-4 py-3">
                {counts
                  .filter((one) => one.option || one.n)
                  .map(({ option, n }) => (
                    <div
                      key={option || 'none'}
                      className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_40px] items-center gap-3"
                    >
                      <span className="truncate text-[13px]">
                        {option ? showValue(option, stageField) : 'Sans étape'}
                      </span>
                      <span className="h-6 overflow-hidden rounded-[6px] bg-sand">
                        <span
                          className="block h-full rounded-[6px]"
                          style={{
                            width: `${(n / most) * 100}%`,
                            background: `color-mix(in srgb, ${colorOf(stages!.kind.kind)} 35%, var(--paper))`,
                          }}
                        />
                      </span>
                      <span className="text-right font-mono text-xs text-bark">{n}</span>
                    </div>
                  ))}
              </div>
            </Panel>
          )}
          <Journal
            title="Activité"
            query={`limit=8&kinds=${encodeURIComponent(names.join(','))}`}
            queryKey={['history', 'overview', names.join(',')]}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {kinds.some((one) => has(one, 'dated')) && (
            <Panel title="À venir" icon={<CalendarClock size={16} />}>
              {coming.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-bark">Rien de prévu.</p>
              ) : (
                coming.slice(0, 6).map((row) => (
                  <Link
                    key={row.id + row.start}
                    to="/entree/$id"
                    params={{ id: row.id }}
                    className={rowClass}
                  >
                    <time className="w-16 flex-none font-mono text-xs text-bark">
                      {showValue(row.start)}
                    </time>
                    <span className="min-w-0 truncate">{row.title}</span>
                  </Link>
                ))
              )}
            </Panel>
          )}
          <Panel title="Derniers fichiers">
            {files.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-bark">Aucun fichier lié.</p>
            ) : (
              files.slice(0, 4).map((file) => (
                <Link
                  key={file.entryId}
                  to="/entree/$id"
                  params={{ id: file.entryId }}
                  className={rowClass}
                >
                  <span className="min-w-0 flex-1 truncate">{file.title || file.name}</span>
                </Link>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
