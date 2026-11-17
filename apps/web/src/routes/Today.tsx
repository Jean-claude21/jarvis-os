import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { api, type JournalLine } from '../lib/api';
import { useSession } from '../lib/session';
import { Avatar, Chip, Empty, PageHead, Panel, Skeleton, ago } from '../ui';
import { said, titleOf, whoOf } from '../lib/words';
import { useKindName } from '../lib/kinds';

// « Aujourd'hui » (v3 D11, first form for V3): what needs her, her day, and what was done — the
// glass box comes whole in V4.

interface AttentionItem {
  id: string;
  kind: string;
  title: string;
  space: string;
  group: 'fix' | 'late' | 'proposed' | 'intent' | 'today' | 'week';
  when: string | null;
  allDay?: boolean;
  status: string | null;
  reason: string;
}
interface Occurrence {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  kind: string;
}
interface Now {
  items: AttentionItem[];
  day: Occurrence[];
}

const GROUPS: {
  group: AttentionItem['group'];
  label: string;
  tone: 'error' | 'verify' | 'info';
}[] = [
  { group: 'fix', label: 'À régler', tone: 'error' },
  { group: 'late', label: 'En retard', tone: 'error' },
  { group: 'proposed', label: 'À valider', tone: 'verify' },
  { group: 'today', label: 'Aujourd’hui', tone: 'info' },
  { group: 'week', label: 'Cette semaine', tone: 'info' },
];

export function Today() {
  const { me } = useSession();
  const kindName = useKindName();
  const now = useQuery({ queryKey: ['now'], queryFn: () => api<Now>('/now') });
  const history = useQuery({
    queryKey: ['history', 'today'],
    queryFn: () => api<JournalLine[]>('/history?limit=12'),
  });
  const items = now.data?.items ?? [];
  const count = (group: AttentionItem['group']) =>
    items.filter((one) => one.group === group).length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const first = (me.person.name || '').split(' ')[0];
  const stats = [
    { label: 'À faire aujourd’hui', value: count('today'), icon: CheckCircle2 },
    { label: 'En retard', value: count('late'), icon: Clock },
    { label: 'À valider', value: count('proposed'), icon: Inbox },
    { label: 'À régler', value: count('fix'), icon: AlertTriangle },
  ];
  return (
    <>
      <PageHead
        title={`${hello}${first ? `, ${first}` : ''}`}
        lead={new Date().toLocaleDateString('fr', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-rule bg-paper p-4 shadow-card">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[13px]">{label}</span>
              <Icon size={16} />
            </div>
            <b className="mt-1 block font-display text-[28px] leading-none">
              {now.isLoading ? <Skeleton className="h-7 w-10" /> : value}
            </b>
          </div>
        ))}
      </div>
      <div className="grid gap-4 items-start lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Ce qui t’attend">
          {now.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ) : items.length === 0 ? (
            <Empty title="Rien ne t’attend" lead="Tout est à jour. Profite." />
          ) : (
            <div className="max-h-[62vh] overflow-y-auto">
              {GROUPS.filter(({ group }) => count(group) > 0).map(({ group, label, tone }) => (
                <div key={group}>
                  <p className="bg-sand px-4 py-1.5 font-mono text-[11px] tracking-wide text-bark uppercase">
                    {label} · {count(group)}
                  </p>
                  {items
                    .filter((one) => one.group === group)
                    .map((one) => (
                      <Link
                        key={one.id + group}
                        to="/entree/$id"
                        params={{ id: one.id }}
                        className="flex items-center gap-3 border-b border-rule px-4 py-2.5 last:border-0 hover:bg-sand"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{one.title}</span>
                          <span className="block truncate text-xs text-faint">
                            {kindName(one.kind)} · {one.space}
                            {one.when
                              ? ` · ${new Date(one.when).toLocaleString('fr', one.allDay || one.when.length <= 10 ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                              : ''}
                          </span>
                        </span>
                        {one.status && <Chip tone={tone}>{one.status}</Chip>}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Ma journée">
            {(now.data?.day ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-bark">Rien de prévu aujourd’hui.</p>
            ) : (
              <ul className="max-h-[40vh] overflow-y-auto">
                {now.data!.day.map((one) => (
                  <li
                    key={one.id + one.start}
                    className="flex gap-3 border-b border-rule px-4 py-2.5 last:border-0"
                  >
                    <time className="w-12 flex-none pt-0.5 font-mono text-xs text-bark">
                      {one.allDay
                        ? 'jour'
                        : new Date(one.start).toLocaleTimeString('fr', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </time>
                    <span className="min-w-0 truncate text-sm">{one.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            title="Ce que Jarvis et toi avez fait"
            action={
              <Link to="/activite" className="text-xs text-bark hover:text-ink">
                Tout voir
              </Link>
            }
          >
            <ul className="max-h-[40vh] overflow-y-auto">
              {(history.data ?? []).map((line) => {
                const who = whoOf(line, me.person.id);
                return (
                  <li
                    key={line.id}
                    className="flex items-start gap-2.5 border-b border-rule px-4 py-2.5 last:border-0"
                  >
                    <Avatar name={who.name} size={24} />
                    <span className="min-w-0 flex-1 text-sm">
                      <b className="font-medium">{who.name}</b> {said(line.command)}{' '}
                      <span className="text-bark">{titleOf(line)}</span>
                    </span>
                    <time className="flex-none text-xs text-faint">{ago(line.at)}</time>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
