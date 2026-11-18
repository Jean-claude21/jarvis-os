import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { sendFile } from './send';
import { toast } from '../ui/more';

// A file dropped anywhere (v3 V7, « dépôt partout »): on any screen she drags a file in, and it is
// kept in her space — joined to the entry she is looking at when there is one (« pièce de »).
// Jarvis then reads it, says what it is, and proposes what it makes in « À valider ».

export interface DropTarget {
  id: string;
  title: string;
}

let target: DropTarget | null = null;
const listeners = new Set<() => void>();
const setTarget = (next: DropTarget | null) => {
  target = next;
  for (const one of listeners) one();
};

/** The entry a page shows: what a file dropped on it is joined to. */
export function useDropTarget(next: DropTarget | null) {
  useEffect(() => {
    if (!next) return;
    setTarget(next);
    return () => setTarget(null);
  }, [next?.id, next?.title]);
}

/** Her files, sent one by one (large ones in parts); each joined to `to` when given. */
export async function uploadFiles(
  files: File[],
  to?: string | null,
): Promise<{ sent: number; duplicates: number; failed: string[] }> {
  const out = { sent: 0, duplicates: 0, failed: [] as string[] };
  for (const file of files) {
    try {
      const one = await sendFile(file, { to: to ?? null });
      out.sent += 1;
      if (one.duplicate) out.duplicates += 1;
    } catch (error) {
      out.failed.push(`${file.name} : ${(error as Error).message}`);
    }
  }
  return out;
}

/** Sends and refreshes what shows files, then what its reading proposes. */
export function useUpload() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['entries'] });
    void client.invalidateQueries({ queryKey: ['entry'] });
    void client.invalidateQueries({ queryKey: ['now'] });
    void client.invalidateQueries({ queryKey: ['history'] });
  };
  const send = async (files: File[], to?: string | null) => {
    if (!files.length) return 0;
    setBusy(true);
    try {
      const done = await uploadFiles(files, to);
      if (done.failed.length) toast(done.failed.join(' · '), 'error');
      return done.sent;
    } finally {
      setBusy(false);
      refresh();
      // Its reading takes a few seconds (a PDF, a photo): what it proposes comes after.
      setTimeout(refresh, 4000);
      setTimeout(refresh, 12000);
    }
  };
  return { send, busy };
}

const hasFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files');

/** The layer over every screen: « Dépose pour… » while a file is dragged, then what happened. */
export function DropLayer() {
  const here = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => target,
  );
  const { send } = useUpload();
  const [over, setOver] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setOver(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const overIt = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setOver(false);
      const files = [...(event.dataTransfer?.files ?? [])];
      const to = target;
      void send(files, to?.id).then((n) => {
        setSaid(
          n
            ? `${n} fichier(s) déposé(s)${to ? ` sur « ${to.title} »` : ''}. Jarvis le lit : ce qu’il en tire t’attendra dans « À valider ».`
            : 'Le dépôt n’a pas abouti.',
        );
        setTimeout(() => setSaid(null), 6000);
      });
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overIt);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overIt);
      window.removeEventListener('drop', drop);
    };
  }, []);
  return (
    <>
      {over && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-ink/20 p-6">
          <div className="flex max-w-md items-center gap-3 rounded-[12px] border border-dashed border-primary bg-paper px-5 py-4 shadow-card">
            <Upload size={20} className="flex-none text-primary" />
            <span className="text-[14px]">
              Dépose pour l’ajouter {here ? <b>à « {here.title} »</b> : <b>à tes documents</b>}
            </span>
          </div>
        </div>
      )}
      {said && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 max-w-sm rounded-[12px] border border-rule bg-paper px-4 py-3 text-[13px] shadow-card"
        >
          {said}
        </div>
      )}
    </>
  );
}
