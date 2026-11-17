// The API, read from the same origin with her session (cookie). One space at a time: the one she
// chose is sent with every call; with none, the server takes her own.

export interface Space {
  id: string;
  name: string;
  personal: boolean;
  role?: string;
  color?: string | null;
  description?: string | null;
}

export interface Me {
  person: { id: string; name: string; email: string };
  space: Space;
  spaces: Space[];
}

export interface JournalLine {
  id: number;
  at: string;
  command: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor: string;
  door: string;
  client: string | null;
  undoneBy: number | null;
}

export interface Entry {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let currentSpace: string | null = null;
export const setSpace = (id: string | null) => {
  currentSpace = id;
};
export const spaceNow = () => currentSpace;

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; space?: string | null } = {},
): Promise<T> {
  const url = new URL(`/api${path}`, location.origin);
  const space = init.space === undefined ? currentSpace : init.space;
  if (space && !url.searchParams.has('space')) url.searchParams.set('space', space);
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (response.status === 401) {
    location.href = '/connexion';
    throw new ApiError(401, 'Signed out');
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const said =
      data && typeof data === 'object' && 'error' in data ? String(data.error) : response.status;
    throw new ApiError(response.status, String(said));
  }
  return data as T;
}
