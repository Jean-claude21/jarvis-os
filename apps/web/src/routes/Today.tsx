import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { api, type JournalLine } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { useSession } from '../lib/session';
import { stateOf, whoOf } from '../lib/words';
import {
  Avatar,
  Empty,
  PageHead,
  Panel,
  Skeleton,
  Stat,
  Stats,
  Tag,
  rowClass,
  type TagTone,
} from '../ui';
import { Welcome } from './Welcome';
import { QueuePanel, useQueue } from './Queue';

// « Aujourd'hui » (v3 D11), the one door of the present, drawn like the v2 « Maintenant »: the
// figures; « À valider » first (the one queue, v3 D13); what else waits for her; her day; and the
// receipt — what Jarvis, her assistants and her sources did for her today (v3 D9).

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

// « À valider » has its own panel: the attention groups show the rest.
const GROUPS: { group: AttentionItem['group']; label: string; tone: TagTone }[] = [
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

const VERBS: Record<string, [string, string]> = {
  'entry.create': ['a créé', 'entrée'],
  'entry.update': ['a modifié', 'entrée'],
  'entry.archive': ['a mis de côté', 'entrée'],
  'link.add': ['a relié', 'lien'],
  'connector.call': ['a appelé', 'service'],
};

/** What was done for her today, by whom: « Source « Jours fériés » a créé 13 entrées ». */
function Receipt() {
  const { me } = useSession();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data = [], isLoading } = useQuery({
    queryKey: ['history', 'receipt', start.toISOString().slice(0, 10)],
    queryFn: () =>
      api<JournalLine[]>(`/history?limit=500&since=${encodeURIComponent(start.toISOString())}`),
  });
  const byWho = new Map<string, { name: string; counts: Map<string, number> }>();
  for (const line of data) {
    const who = whoOf(line, me.person.id);
    if (who.kind === 'person' || line.undoneBy !== null) continue;
    const one = byWho.get(who.name) ?? { name: who.name, counts: new Map() };
    one.counts.set(line.command, (one.counts.get(line.command) ?? 0) + 1);
    byWho.set(who.name, one);
  }
  const rows = [...byWho.values()];
  const sentence = (counts: Map<string, number>) =>
    [...counts.entries()]
      .map(([command, n]) => {
        const [verb, noun] = VERBS[command] ?? [command, 'fois'];
        return `${verb} ${n} ${noun}${n > 1 && noun !== 'fois' ? 's' : ''}`;
      })
      .join(' · ');
  return (
    <Panel
      title="Ce que Jarvis a fait pour toi"
      action={
        <Link
          to="/activite"
          search={{ period: 'today' }}
          className="text-[12.5px] text-bark hover:text-ink"
        >
          Tout voir
        </Link>
      }
    >
      {isLoading ? (
        <Skeleton className="m-4 h-10" />
      ) : rows.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-bark">
          Rien encore aujourd’hui : ni règle, ni source, ni assistant n’a agi.
        </p>
      ) : (
        rows.map((one) => (
          <div
            key={one.name}
            className="flex items-start gap-2.5 border-b border-rule px-4 py-2.5 last:border-0"
          >
            <Avatar name={one.name} size={26} />
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="font-semibold">{one.name}</b>
              <span className="block text-bark">{sentence(one.counts)}</span>
            </span>
          </div>
        ))
      )}
    </Panel>
  );
}

export function Today() {
  const { me } = useSession();
  const kindName = useKindName();
  const now = useQuery({ queryKey: ['now'], queryFn: () => api<Now>('/now') });
  const queue = useQueue();
  // What waits in the queue shows there only, never twice.
  const queued = new Set((queue.data ?? []).map((one) => one.id));
  const items = (now.data?.items ?? []).filter(
    (one) => one.group !== 'proposed' && !queued.has(one.id),
  );
  const day = (now.data?.day ?? []).filter((one) => !queued.has(one.id));
  const count = (group: AttentionItem['group']) =>
    items.filter((one) => one.group === group).length;
  const waiting = queue.data?.length ?? 0;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const first = (me.person.name || '').split(' ')[0];
  const stats = [
    {
      label: 'À valider',
      value: waiting,
      icon: Inbox,
      bad: false,
      sub: waiting ? 'attendent ton oui' : 'rien',
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
      <Welcome
        onNote={() =>
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
        }
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
        <div className="flex min-w-0 flex-col gap-4">
          <QueuePanel />
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
                          {one.status && <Tag tone="plain">{stateOf(one.status)}</Tag>}
                        </Link>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Ta journée">
            {day.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-bark">Rien de prévu aujourd’hui.</p>
            ) : (
              <ul className="max-h-[40vh] overflow-y-auto">
                {day.map((one) => (
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
          <Receipt />
        </div>
      </div>
    </>
  );
}
