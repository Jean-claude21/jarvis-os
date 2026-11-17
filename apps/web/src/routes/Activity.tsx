import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type JournalLine } from '../lib/api';
import { onChange } from '../lib/live';
import { useSession } from '../lib/session';
import { doorOf, said, titleOf, whoOf } from '../lib/words';
import { Avatar, Button, Empty, PageHead, Panel, Skeleton, cn } from '../ui';

// Activité (v3 D9): everything that changed in the space, by day, who did it and why, undoable —
// new lines arrive live. Filters by author and action come in V4.

export function Activity() {
  const { me } = useSession();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['history', 'all'],
    queryFn: () => api<JournalLine[]>('/history?limit=150'),
  });
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
        lead="Tout ce qui a changé, qui l’a fait et pourquoi. Chaque changement peut être annulé."
      />
      <Panel>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : days.length === 0 ? (
          <Empty title="Rien encore" lead="Les changements apparaîtront ici dès qu’il y en aura." />
        ) : (
          days.map(({ day, lines }) => (
            <div key={day}>
              <p className="sticky top-0 bg-sand px-4 py-1.5 text-xs font-semibold text-bark first-letter:uppercase">
                {day}
              </p>
              {lines.map((line) => {
                const who = whoOf(line, me.person.id);
                const undone = line.undoneBy !== null || line.command === 'journal.undo';
                const isEntry = line.target.startsWith('ent_');
                return (
                  <div
                    key={line.id}
                    className={cn(
                      'group flex items-center gap-3 border-b border-rule px-4 py-2.5 transition-colors last:border-0',
                      fresh.has(line.id) && 'bg-success-surface',
                    )}
                  >
                    <Avatar name={who.name} size={28} />
                    <span
                      className={cn(
                        'min-w-0 flex-1 text-sm',
                        line.undoneBy !== null && 'text-faint line-through',
                      )}
                    >
                      <b className="font-medium">{who.name}</b> {said(line.command)}{' '}
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
                      <span className="block text-xs text-faint">{doorOf(line.door)}</span>
                    </span>
                    <time className="flex-none font-mono text-xs text-faint">
                      {new Date(line.at).toLocaleTimeString('fr', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {!undone && line.command.startsWith('entry.') && (
                      <Button
                        size="sm"
                        tone="quiet"
                        className="opacity-60 group-hover:opacity-100"
                        onClick={() => undo.mutate(line.id)}
                        aria-label="Annuler"
                        title="Annuler"
                      >
                        <Undo2 size={15} />
                      </Button>
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
