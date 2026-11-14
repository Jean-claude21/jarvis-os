import { asPerson, closeExecution, openExecution, RAW_KIND, type Actor } from '@jarvis-os/core';
import type pg from 'pg';

// The Atelier (spec 060): Jarvis's own services — finding offers, reading a page, making a PDF… —
// deployed apart and reached by Jarvis itself (ATELIER_URL, ATELIER_KEY). She never connects it
// and never names a service: she says what she wants, her apps declare the capabilities they use,
// and an assistant picks one from what each says it can do. Long work answers Jarvis with a work
// token for its one execution (spec 057); Jarvis keeps everything.

/** The name a rule's `call` reaches the Atelier by, when she has no connection of that name. */
export const ATELIER = 'Atelier';

export interface Capability {
  name: string;
  title: string;
  /** What it can do, in her words. */
  does: string;
  examples: string[];
  /** `reads` · `makes` (something of hers) · `sends` (outside, in her name: only after her yes). */
  effect: 'reads' | 'makes' | 'sends';
  description: string;
  input: Record<string, unknown>;
  writes?: { kind: string; match?: string; title?: string };
  long: boolean;
  minutes: number;
  path: string;
  /** Its secrets are set on the Atelier. */
  ready: boolean;
}

export interface AtelierSettings {
  url: string;
  key: string;
}

/** The Atelier this server reaches, when it is set. */
export function atelierFromEnv(env = process.env): AtelierSettings | null {
  const url = env.ATELIER_URL?.trim();
  const key = env.ATELIER_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

const CATALOG_MS = 10 * 60_000;
const CALL_MS = 20_000;

export function atelier(settings: AtelierSettings, fetcher: typeof fetch = fetch) {
  let kept: { at: number; list: Capability[] } | null = null;

  /** What the Atelier can do, read again every ten minutes. */
  const capabilities = async (): Promise<Capability[]> => {
    if (kept && Date.now() - kept.at < CATALOG_MS) return kept.list;
    const answer = await fetcher(`${settings.url}/catalog`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!answer.ok) throw new Error(`The Atelier answered ${answer.status} for its catalogue.`);
    const { services } = (await answer.json()) as { services: Capability[] };
    kept = { at: Date.now(), list: services };
    return services;
  };

  /** Work asked of the Atelier at one of its addresses (`/jobs/<name>`). */
  const post = async (path: string, body: Record<string, unknown>): Promise<unknown> => {
    if (!/^\/?jobs\/[a-z0-9_]+$/.test(path))
      throw new Error(`Call «${ATELIER}»: its addresses are /jobs/<capability>, not ${path}.`);
    const answer = await fetcher(`${settings.url}/${path.replace(/^\//, '')}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${settings.key}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CALL_MS),
      redirect: 'error',
    });
    const text = await answer.text();
    let read: unknown = null;
    try {
      read = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Call «${ATELIER}»: its answer is not JSON.`);
    }
    if (!answer.ok) {
      const said =
        read && typeof read === 'object' && 'error' in read ? String(read.error) : answer.status;
      throw new Error(`Call «${ATELIER}»: ${said}`);
    }
    return read;
  };

  return { capabilities, post };
}
export type Atelier = ReturnType<typeof atelier>;

/** Which apps use each capability (theirs declared in their role). */
export function usedBy(
  apps: { app: string; role: { capabilities?: string[] } }[],
): Record<string, string[]> {
  const by: Record<string, string[]> = {};
  for (const one of apps)
    for (const name of one.role.capabilities ?? []) (by[name] ??= []).push(one.app);
  return by;
}

/**
 * A capability run for her now, from a conversation: short work answers at once; long work opens
 * an execution (seen in « Activités ») whose token lets the Atelier write what it finds — her `save`
 * kind, else the capability's own — and close it.
 */
export async function runCapability(
  deps: { db: pg.Pool; atelier: Atelier; publicUrl: string },
  actor: Actor,
  spaceId: string,
  request: {
    name: string;
    input: Record<string, unknown>;
    save?: { kind: string; match?: string; title?: string; raw?: string };
    about?: string;
    agreed?: boolean;
  },
): Promise<unknown> {
  const all = await deps.atelier.capabilities();
  const one = all.find((each) => each.name === request.name);
  if (!one)
    throw new Error(
      `No capability « ${request.name} »: there are ${all.map((each) => each.name).join(', ')}.`,
    );
  if (!one.ready) throw new Error(`« ${one.title} » is not ready on the Atelier yet.`);
  if (one.effect === 'sends' && !request.agreed)
    throw new Error(
      `« ${one.title} » acts outside in her name: ask her, then call again with agreed: true.`,
    );
  const path = `/jobs/${one.name}`;
  if (!one.long) return deps.atelier.post(path, request.input);
  const writes = request.save ?? one.writes;
  const opened = await asPerson(deps.db, actor.person, (tx) =>
    openExecution(tx, actor, spaceId, {
      service: ATELIER,
      action: path,
      title: one.title,
      ...(request.about ? { about: request.about } : {}),
      long: true,
      minutes: Math.max(one.minutes, 5),
      ...(writes ? { kinds: [writes.kind, request.save?.raw ?? RAW_KIND] } : {}),
    }),
  );
  try {
    await deps.atelier.post(path, {
      ...request.input,
      jarvis: {
        execution: opened.id,
        token: opened.token,
        until: opened.until,
        url: `${deps.publicUrl.replace(/\/$/, '')}/api`,
        ...(request.save ? { save: request.save } : {}),
      },
    });
  } catch (error) {
    await asPerson(deps.db, actor.person, (tx) =>
      closeExecution(tx, actor, spaceId, opened.id, {
        status: 'failed',
        error: (error as Error).message.slice(0, 1000),
      }),
    );
    throw error;
  }
  return {
    accepted: true,
    execution: opened.id,
    capability: one.title,
    until: opened.until,
    next: `It runs now; what it finds is written as « ${writes?.kind ?? 'nothing'} », linked to the execution. Read the execution (get ${opened.id}) or her « Activités » to see when it is done.`,
  };
}
