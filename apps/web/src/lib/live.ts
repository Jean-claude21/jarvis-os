import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// The journal, live (v3 D9): one stream for the screen; each change makes what may show it fresh
// again. Only ids travel; the screens read the rest as usual.

export type LiveState = 'connecting' | 'live' | 'offline';

export interface LiveChange {
  space: string;
  id: number;
  command: string;
  target: string;
  actor: string;
  door: string;
  at: string;
}

const listeners = new Set<(change: LiveChange) => void>();
/** Hears every change while mounted. */
export const onChange = (listener: (change: LiveChange) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLive(): LiveState {
  const client = useQueryClient();
  const [state, setState] = useState<LiveState>('connecting');
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const open = () => {
      source = new EventSource('/api/live', { withCredentials: true });
      source.addEventListener('ready', () => setState('live'));
      source.addEventListener('change', (event) => {
        const change = JSON.parse((event as MessageEvent<string>).data) as LiveChange;
        for (const listener of listeners) listener(change);
        // What may show it: the lists, the day, the journal, the entry itself.
        void client.invalidateQueries({ queryKey: ['now'] });
        void client.invalidateQueries({ queryKey: ['history'] });
        void client.invalidateQueries({ queryKey: ['entries'] });
        void client.invalidateQueries({ queryKey: ['entry', change.target] });
      });
      source.onerror = () => {
        setState('offline');
        source?.close();
        if (!stopped) retry = setTimeout(open, 5000);
      };
    };
    open();
    return () => {
      stopped = true;
      source?.close();
      if (retry) clearTimeout(retry);
    };
  }, [client]);
  return state;
}
