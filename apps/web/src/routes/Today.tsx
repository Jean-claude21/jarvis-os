import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { api, type JournalLine } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { useSession } from '../lib/session';
import { said, titleOf, whoOf } from '../lib/words';
import {
  Avatar,
  Empty,
  PageHead,
  Panel,
  Skeleton,
  Stat,
  Stats,
  Tag,
  ago,
  rowClass,
  type TagTone,
} from '../ui';

// « Aujourd'hui » (v3 D11), drawn like the v2 « Maintenant »: the figures in one panel ruled
// between them, what waits for her by group (« À valider » first), her day, and what was done.

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

const GROUPS: { group: AttentionItem['group']; label: string; tone: TagTone }[] = [
  { group: 'proposed', label: 'À valider', tone: 'late' },
  { group: 'fix', label: 'À régler', tone: 'error' },
  { group: 'late', label: 'En retard', tone: 'error' },
  { group: 'today', label: 'Aujourd’hui', tone: 'info' },
  { group: 'week', label: 'Cette semaine', tone: 'neutral' },
];

const when = (one: AttentionItem) =>
  one.when
    ? new Date(one.when).toLocaleString(
        'fr',
        one.allDay || one.when.length <= 10
          ? { day: 'numeric', month: 'short' }
          : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
      )
    : null;

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
    {
      label: 'À valider',
      value: count('proposed'),
      icon: Inbox,
      bad: false,
      sub: count('proposed') ? 'attendent ton oui' : 'rien',
    },
    {
      label: 'Aujourd’hui',
      value: count('today'),
      icon: CheckCircle2,
      bad: false,
      sub: `${count('week')} cette semaine`,
    },
    {
      label: 'En retard',
      value: count('late'),
      icon: Clock,
      bad: count('late') > 0,
      sub: count('late') ? 'attendent ton geste' : 'rien',
    },
    {
      label: 'À régler',
      value: count('fix'),
      icon: AlertTriangle,
      bad: count('fix') > 0,
      sub: count('fix') ? 'une connexion, une erreur' : 'rien',
    },
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
      <Stats>
        {stats.map(({ label, value, icon: Icon, bad, sub }) => (
          <Stat
            key={label}
            label={label}
            icon={<Icon size={15} />}
            value={now.isLoading ? <Skeleton className="h-7 w-10" /> : value}
            sub={sub}
            bad={bad}
          />
        ))}
      </Stats>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Ce qui t’attend">
          {now.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ) : items.length === 0 ? (
            <Empty title="Rien ne t’attend" lead="Tout est à jour." />
          ) : (
            <div className="max-h-[min(62vh,640px)] overflow-y-auto">
              {GROUPS.filter(({ group }) => count(group) > 0).map(({ group, label, tone }) => (
                <div key={group}>
                  <div className="flex items-center gap-2 border-b border-rule bg-sand px-4 py-1.5">
                    <Tag tone={tone}>{label}</Tag>
                    <span className="font-mono text-[11px] text-faint">{count(group)}</span>
                  </div>
                  {items
                    .filter((one) => one.group === group)
                    .map((one) => (
                      <Link
                        key={one.id + group}
                        to="/entree/$id"
                        params={{ id: one.id }}
                        className={rowClass}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{one.title}</span>
                          <span className="block truncate text-[12.5px] text-bark">
                            {kindName(one.kind)} · {one.space}
                            {when(one) ? ` · ${when(one)}` : ''}
                          </span>
                        </span>
                        {one.status && <Tag tone="plain">{one.status}</Tag>}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Ta journée">
            {(now.data?.day ?? []).length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-bark">Rien de prévu aujourd’hui.</p>
            ) : (
              <ul className="max-h-[40vh] overflow-y-auto">
                {now.data!.day.map((one) => (
                  <li key={one.id + one.start} className={rowClass}>
                    <time className="w-12 flex-none font-mono text-xs text-bark">
                      {one.allDay
                        ? 'journée'
                        : new Date(one.start).toLocaleTimeString('fr', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </time>
                    <span className="min-w-0 truncate">{one.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            title="Ce qui a été fait"
            action={
              <Link to="/activite" className="text-[12.5px] text-bark hover:text-ink">
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
                    <Avatar name={who.name} size={26} />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className="font-semibold">{who.name}</b> {said(line.command)}{' '}
                      <span className="text-bark">{titleOf(line)}</span>
                    </span>
                    <time className="flex-none font-mono text-[11px] text-faint">
                      {ago(line.at)}
                    </time>
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
