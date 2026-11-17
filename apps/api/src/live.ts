// The journal, live (v3 D9). One connection per server listens to « jarvis_journal » (migration
// 0030) and hands each change to the screens open on its space. A pooled connection cannot listen,
// so this one goes to the database directly. Nothing but ids and the command is passed on: each
// screen then reads what it may see, under row-level security.

import pg from 'pg';

export interface LiveEvent {
  space: string;
  id: number;
  command: string;
  target: string;
  actor: string;
  door: string;
  at: string;
}

interface Listener {
  spaces: Set<string>;
  send: (event: LiveEvent) => void;
}

/** The direct address of a pooled Neon one (« ep-x-pooler.… » → « ep-x.… »). */
export const directUrl = (url: string) => url.replace(/(@[^/:@]*?)-pooler\./, '$1.');

export function liveHub(databaseUrl: string) {
  const listeners = new Set<Listener>();
  let client: pg.Client | null = null;
  let starting: Promise<void> | null = null;

  const start = async () => {
    const one = new pg.Client({ connectionString: directUrl(databaseUrl) });
    one.on('notification', (message) => {
      if (!message.payload) return;
      let event: LiveEvent;
      try {
        event = JSON.parse(message.payload) as LiveEvent;
      } catch {
        return;
      }
      for (const listener of listeners) if (listener.spaces.has(event.space)) listener.send(event);
    });
    one.on('error', (error) => {
      console.warn('[live]', error.message);
      client = null;
      void one.end().catch(() => undefined);
    });
    await one.connect();
    await one.query('listen jarvis_journal');
    client = one;
  };

  return {
    /** Hears the changes of these spaces until the returned function is called. */
    subscribe(spaces: string[], send: (event: LiveEvent) => void): () => void {
      const listener: Listener = { spaces: new Set(spaces), send };
      listeners.add(listener);
      if (!client && !starting)
        starting = start()
          .catch((error) => console.warn('[live] cannot listen:', (error as Error).message))
          .finally(() => {
            starting = null;
          });
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type LiveHub = ReturnType<typeof liveHub>;
