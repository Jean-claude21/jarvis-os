import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Archive, Copy, Maximize2, PanelRight } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { toast } from '../ui/more';

// Le clic droit (gr8r's context menu, v3 F3): on any entry of any view, the same few gestures —
// open beside, open in full, copy its link, set it aside (archived, never deleted, undone from the
// Activity). One menu for every render, mounted once in the shell.

type Opened = { id: string; title: string; x: number; y: number } | null;
let opened: Opened = null;
const listeners = new Set<() => void>();
const setOpened = (next: Opened) => {
  opened = next;
  for (const one of listeners) one();
};

/** The props a row (a line, a card, a table row) takes to answer the right click. */
export const rowMenu = (id: string, title: string) => ({
  onContextMenu: (event: React.MouseEvent) => {
    event.preventDefault();
    setOpened({ id, title, x: event.clientX, y: event.clientY });
  },
});

export function RowMenuLayer() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const here = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => opened,
  );
  useEffect(() => {
    if (!here) return;
    const close = () => setOpened(null);
    const key = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', key);
    };
  }, [here]);
  if (!here) return null;
  const item =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-[2px] p-2 text-left text-[13.5px] hover:bg-sand';
  const left = Math.min(here.x, window.innerWidth - 240);
  const top = Math.min(here.y, window.innerHeight - 200);
  return (
    <div
      role="menu"
      aria-label={`Gestes sur « ${here.title} »`}
      className="fixed z-50 w-[230px] rounded-[2px] border border-rule bg-paper p-1 shadow-card"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="truncate px-2 pt-1 pb-1.5 font-mono text-[11px] text-faint">{here.title}</p>
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          setOpened(null);
          void navigate({
            to: '.',
            search: ((was: Record<string, unknown>) => ({ ...was, fiche: here.id })) as never,
          });
        }}
      >
        <PanelRight size={15} /> Ouvrir à côté
      </button>
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          setOpened(null);
          void navigate({ to: '/entree/$id', params: { id: here.id } });
        }}
      >
        <Maximize2 size={15} /> Ouvrir en pleine page
      </button>
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          setOpened(null);
          void navigator.clipboard?.writeText(`${location.origin}/v3/entree/${here.id}`);
          toast('Lien copié.');
        }}
      >
        <Copy size={15} /> Copier le lien
      </button>
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          setOpened(null);
          void api(`/entries/${here.id}/archive`, { method: 'POST' })
            .then(() => {
              toast(`« ${here.title} » mise de côté. Annulable depuis l’Activité.`);
              void client.invalidateQueries({ queryKey: ['entries'] });
              void client.invalidateQueries({ queryKey: ['now'] });
            })
            .catch((error: Error) => toast(error.message, 'error'));
        }}
      >
        <Archive size={15} /> Mettre de côté
      </button>
    </div>
  );
}
