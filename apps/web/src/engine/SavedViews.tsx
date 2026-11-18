import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bookmark, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { Button, cn, inputClass } from '../ui';
import { toast } from '../ui/more';
import type { RenderKey, ViewSearch } from './types';

// Les vues enregistrées (v3 D10, F3): what she arranged on a page — its render, filters, sort,
// groups — kept under a name and found again in one click, on that page. A view is an entry
// « View » (`place`, `state`), like the views of one kind Claude makes: the same thing, kept.

interface SavedView {
  id: string;
  title: string;
  data: { place?: string; state?: Record<string, string | boolean> };
}

/** The page she is on, as the views know it (without the client's base). */
const placeNow = () => location.pathname.replace(/^\/v3/, '') || '/';

/** The state a view keeps: everything the engine reads, never the entry open beside it. */
const kept = (search: ViewSearch) =>
  Object.fromEntries(
    Object.entries(search).filter(
      ([key, value]) => !['fiche', 'sel'].includes(key) && value !== undefined && value !== '',
    ),
  ) as Record<string, string | boolean>;

const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

const TYPE: Partial<Record<RenderKey, string>> = {
  board: 'kanban',
  cards: 'gallery',
  calendar: 'calendar',
  timeline: 'timeline',
};

export function SavedViews({ search, render }: { search: ViewSearch; render: RenderKey }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const place = placeNow();
  const [naming, setNaming] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ['entries', 'views', 'saved'],
    queryFn: () => api<SavedView[]>('/entries?kind=View&limit=200'),
  });
  const mine = data.filter((one) => one.data.place === place);
  const now = kept(search);
  const refresh = () => void client.invalidateQueries({ queryKey: ['entries', 'views'] });
  const keep = useMutation({
    mutationFn: (title: string) =>
      api('/save', {
        method: 'POST',
        body: {
          entries: [
            {
              kind: 'View',
              title,
              data: {
                kind: '*',
                type: TYPE[render] ?? 'table',
                place,
                state: { ...now, v: render },
              },
            },
          ],
        },
      }),
    onSuccess: () => {
      setNaming(null);
      toast('Vue gardée : elle revient ici d’un clic.');
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: refresh,
  });
  const drop = useMutation({
    mutationFn: (id: string) => api(`/entries/${id}/archive`, { method: 'POST' }),
    onSettled: refresh,
  });
  const open = (state: Record<string, string | boolean>) =>
    void navigate({ to: '.', search: state as never, replace: true });
  const chip =
    'inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-[2px] border px-2.5 text-[13px]';
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Vues enregistrées">
      {mine.length > 0 && (
        <button
          onClick={() => open({})}
          className={cn(
            chip,
            'cursor-pointer',
            Object.keys(now).length === 0
              ? 'border-ink bg-paper font-semibold'
              : 'border-rule bg-paper text-bark hover:text-ink',
          )}
        >
          Tout
        </button>
      )}
      {mine.map((one) => {
        const on = same(one.data.state ?? {}, { ...now, v: now.v ?? render });
        return (
          <span
            key={one.id}
            className={cn(
              chip,
              on ? 'border-ink bg-paper font-semibold' : 'border-rule bg-paper text-bark',
            )}
          >
            <button
              onClick={() => open(one.data.state ?? {})}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 hover:text-ink"
            >
              <Bookmark size={13} className="flex-none" />
              <span className="truncate">{one.title}</span>
            </button>
            <button
              onClick={() => drop.mutate(one.id)}
              aria-label={`Retirer la vue « ${one.title} »`}
              className="flex-none cursor-pointer text-faint hover:text-ink"
            >
              <X size={13} />
            </button>
          </span>
        );
      })}
      {naming === null ? (
        <Button size="sm" onClick={() => setNaming('')}>
          <Plus size={14} />
          Vue
        </Button>
      ) : (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (naming.trim()) keep.mutate(naming.trim());
          }}
        >
          <input
            autoFocus
            className={cn(inputClass, 'h-8 w-48')}
            value={naming}
            placeholder="Nom de la vue"
            aria-label="Nom de la vue"
            onChange={(event) => setNaming(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setNaming(null)}
          />
          <Button size="sm" tone="solid" disabled={!naming.trim() || keep.isPending}>
            Garder
          </Button>
          <Button size="sm" type="button" onClick={() => setNaming(null)}>
            Annuler
          </Button>
        </form>
      )}
    </div>
  );
}
