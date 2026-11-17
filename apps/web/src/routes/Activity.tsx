import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowRight, ChevronDown, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type JournalLine } from '../lib/api';
import { onChange } from '../lib/live';
import { useSession } from '../lib/session';
import { doorOf, said, titleOf, whoOf } from '../lib/words';
import { Avatar, Button, Caps, Empty, PageHead, Panel, Segmented, Skeleton, Tag, cn } from '../ui';

// Activité (v3 D9), the glass box: everything that changed, filtered by who (her hand, an
// assistant, what runs alone, Telegram), by action and by period — the filters live in the URL;
// each line opens on what it changed (before → after) and can be undone. New lines are lit live.

export type Author = 'all' | 'me' | 'assistant' | 'auto' | 'telegram';
export type Action = 'all' | 'create' | 'update' | 'archive' | 'link';
export type Period = 'today' | '7' | '30' | 'all';
export interface ActivitySearch {
  author?: Author;
  action?: Action;
  period?: Period;
}

const ACTIONS: Record<Exclude<Action, 'all'>, string> = {
  create: 'entry.create',
  update: 'entry.update',
  archive: 'entry.archive',
  link: 'link.',
};

const sinceOf = (period: Period) => {
  if (period === 'all') return null;
  const at = new Date();
  at.setHours(0, 0, 0, 0);
  if (period !== 'today') at.setDate(at.getDate() - Number(period) + 1);
  return at.toISOString();
};

const showValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 80);
};

/** What a change changed: each field, before → after. */
function Changes({ line }: { line: JournalLine }) {
  const before = (line.before?.data ?? {}) as Record<string, unknown>;
  const after = (line.after?.data ?? {}) as Record<string, unknown>;
  const rows: [string, unknown, unknown][] = [];
  if (line.before?.title !== line.after?.title && line.after?.title !== undefined)
    rows.push(['titre', line.before?.title ?? null, line.after?.title]);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      rows.push([key, before[key] ?? null, after[key] ?? null]);
  if (!rows.length) return <p className="text-[12.5px] text-bark">Aucun champ changé.</p>;
  return (
    <dl className="grid gap-1">
      {rows.slice(0, 12).map(([key, was, now]) => (
        <div
          key={key}
          className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-2 text-[12.5px]"
        >
          <dt className="truncate font-mono text-bark">{key}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {line.command !== 'entry.create' && (
              <>
                <span className="text-faint line-through">{showValue(was)}</span>
                <ArrowRight size={12} className="flex-none text-faint" />
              </>
            )}
            <span>{showValue(now)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Activity() {
  const { me } = useSession();
  const client = useQueryClient();
  const navigate = useNavigate({ from: '/activite' });
  const search = useSearch({ from: '/activite' });
  const author: Author = search.author ?? 'all';
  const action: Action = search.action ?? 'all';
  const period: Period = search.period ?? '7';
  const set = (change: ActivitySearch) =>
    void navigate({ search: (was: ActivitySearch) => ({ ...was, ...change }), replace: true });
  const query = new URLSearchParams({ limit: '300' });
  if (author !== 'all') query.set('author', author);
  if (action !== 'all') query.set('commands', ACTIONS[action]);
  const since = sinceOf(period);
  if (since) query.set('since', since);
  const { data, isLoading } = useQuery({
    queryKey: ['history', 'activity', author, action, period],
    queryFn: () => api<JournalLine[]>(`/history?${query.toString()}`),
  });
  const [open, setOpen] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(
    () =>
      onChange((change) => {
        setFresh((was) => new Set(was).add(change.id));
        setTimeout(
          () =>
            setFresh((was) => {
              const next = new Set(was);
              next.delete(change.id);
              return next;
            }),
          4000,
        );
      }),
    [],
  );
  const undo = useMutation({
    mutationFn: (journalId: number) => api('/undo', { method: 'POST', body: { journalId } }),
    onSettled: () => client.invalidateQueries({ queryKey: ['history'] }),
  });
  const days: { day: string; lines: JournalLine[] }[] = [];
  for (const line of data ?? []) {
    const day = new Date(line.at).toLocaleDateString('fr', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const last = days[days.length - 1];
    if (last && last.day === day) last.lines.push(line);
    else days.push({ day, lines: [line] });
  }
  return (
    <>
      <PageHead
        title="Activité"
        badge={data ? `${data.length} changement(s)` : undefined}
        lead="Tout ce qui a changé, qui l’a fait et comment. Chaque changement s’ouvre et peut être annulé."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Qui"
          value={author}
          onChange={(value) => set({ author: value })}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'me', label: 'Toi' },
            { value: 'assistant', label: 'Assistants' },
            { value: 'auto', label: 'Automatique' },
            { value: 'telegram', label: 'Telegram' },
          ]}
        />
        <Segmented
          label="Quoi"
          value={action}
          onChange={(value) => set({ action: value })}
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'create', label: 'Créé' },
            { value: 'update', label: 'Modifié' },
            { value: 'archive', label: 'Mis de côté' },
            { value: 'link', label: 'Liens' },
          ]}
        />
        <Segmented
          label="Quand"
          value={period}
          onChange={(value) => set({ period: value })}
          options={[
            { value: 'today', label: 'Aujourd’hui' },
            { value: '7', label: '7 jours' },
            { value: '30', label: '30 jours' },
            { value: 'all', label: 'Tout' },
          ]}
        />
      </div>
      <Panel bodyClassName="max-h-[calc(100dvh-260px)] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : days.length === 0 ? (
          <Empty title="Rien ici" lead="Aucun changement pour ces filtres." />
        ) : (
          days.map(({ day, lines }) => (
            <div key={day}>
              <div className="sticky top-0 z-[1] border-b border-rule bg-sand px-4 py-1.5">
                <Caps>{day}</Caps>
              </div>
              {lines.map((line) => {
                const who = whoOf(line, me.person.id);
                const undone = line.undoneBy !== null || line.command === 'journal.undo';
                const isEntry = line.target.startsWith('ent_');
                const opens = line.command === 'entry.update' || line.command === 'entry.create';
                const isOpen = open === line.id;
                return (
                  <div
                    key={line.id}
                    className={cn(
                      'border-b border-rule transition-colors last:border-0',
                      fresh.has(line.id) && 'bg-success-surface',
                    )}
                  >
                    <div className="group flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-sand">
                      <Avatar name={who.name} />
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          line.undoneBy !== null && 'text-faint line-through',
                        )}
                      >
                        <b className="font-semibold">{who.name}</b> {said(line.command)}{' '}
                        {isEntry ? (
                          <Link
                            to="/entree/$id"
                            params={{ id: line.target }}
                            className="text-bark underline-offset-2 hover:underline"
                          >
                            {titleOf(line) || line.target}
                          </Link>
                        ) : (
                          <span className="text-bark">{titleOf(line)}</span>
                        )}
                        <span className="mt-0.5 block">
                          <Tag tone="plain">{doorOf(line.door)}</Tag>
                        </span>
                      </span>
                      <time className="flex-none font-mono text-[11.5px] text-faint">
                        {new Date(line.at).toLocaleTimeString('fr', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                      {opens && (
                        <Button
                          size="sm"
                          tone="quiet"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : line.id)}
                          title="Ce qui a changé"
                        >
                          <ChevronDown
                            size={14}
                            className={cn('transition-transform', isOpen && 'rotate-180')}
                          />
                        </Button>
                      )}
                      {!undone && line.command.startsWith('entry.') && (
                        <Button
                          size="sm"
                          className="opacity-70 group-hover:opacity-100"
                          onClick={() => undo.mutate(line.id)}
                          title="Annuler ce changement"
                        >
                          <Undo2 size={14} />
                          <span className="hidden sm:inline">Annuler</span>
                        </Button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t border-rule bg-sand/60 px-4 py-3 sm:pl-[58px]">
                        <Changes line={line} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </Panel>
    </>
  );
}
