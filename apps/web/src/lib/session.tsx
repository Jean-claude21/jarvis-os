import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setSpace, type Me, type Space } from './api';

// Who she is and which space she looks at. The space she chose is remembered on this device.

const SPACE_PALETTE = ['#b83a1b', '#2f6f5e', '#4a5fa8', '#8a5a9e', '#a8862a', '#3b8ea5'];
const KEY = 'jarvis.v3.space';

interface Session {
  me: Me;
  space: Space;
  choose: (id: string) => void;
  colorOf: (space: Pick<Space, 'id' | 'color'>) => string;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const client = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me', { space: null }),
  });
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const space = me ? (me.spaces.find((one) => one.id === chosen) ?? me.space) : null;
  useEffect(() => {
    setSpace(space?.id ?? null);
  }, [space?.id]);
  const choose = useCallback(
    (id: string) => {
      setChosen(id);
      setSpace(id);
      try {
        localStorage.setItem(KEY, id);
      } catch {
        /* a private window keeps nothing */
      }
      void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    },
    [client],
  );
  const colorOf = useCallback(
    (one: Pick<Space, 'id' | 'color'>) => {
      if (one.color) return one.color;
      const at = me?.spaces.findIndex((s) => s.id === one.id) ?? 0;
      return SPACE_PALETTE[Math.max(at, 0) % SPACE_PALETTE.length]!;
    },
    [me],
  );
  if (!me || !space) return <>{fallback}</>;
  // Set before the first screen reads: every call of this render goes to her space.
  setSpace(space.id);
  return (
    <SessionContext.Provider value={{ me, space, choose, colorOf }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside SessionProvider');
  return session;
}
