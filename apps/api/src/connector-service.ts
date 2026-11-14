import {
  addConnector,
  asPerson,
  changeConnector,
  connectorsOf,
  connectorWithSecret,
  cutConnector,
  recordCall,
  setOAuth,
  setProbe,
  type Actor,
  type Connector,
  type CallRequest,
  type ConnectorAuth,
} from '@jarvis-os/core';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { callTool, headersOf, needsAgreement, probe, readResource, type Reach } from './connectors';
import { presetClientFor } from './catalog';
import { signInProvider, type SignIn } from './oauth-client';
import { open, seal } from './secrets';
import { ATELIER, atelier as atelierOf, atelierFromEnv, type Atelier } from './atelier';

// Her connectors as every door uses them (spec 025): the web account and the MCP door add, check,
// change, cut and call them here. The server is reached outside any transaction; what it answered
// is written as her.

export const connectorInput = z.object({
  name: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .url()
    .refine((one) => /^https?:\/\//.test(one), 'An http(s) address.'),
  auth: z.enum(['none', 'bearer', 'header', 'oauth']).default('none'),
  headerName: z.string().trim().min(1).max(80).nullish(),
  secret: z.string().min(1).max(4000).nullish(),
  /** MCP (default), or plain HTTP: an agent's own address, reached by a rule's `call` (spec 050). */
  protocol: z.enum(['mcp', 'http']).default('mcp'),
});
export type ConnectorInput = z.infer<typeof connectorInput>;

export const connectorChange = connectorInput.partial();

const CALL_TIMEOUT_MS = 20_000;
const CALL_MAX_BYTES = 2 * 1024 * 1024;

/**
 * An address a call may reach (spec 050): https outside private networks; on a developer's own
 * machine (a local Jarvis), http://localhost too. Hostnames are read as written: no request is
 * sent before this says yes.
 */
export function reachable(url: URL, local: boolean): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (loopback) return local && (url.protocol === 'http:' || url.protocol === 'https:');
  if (url.protocol !== 'https:') return false;
  if (/^(10\.|192\.168\.|169\.254\.|127\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^(fc|fd|fe80)/.test(host) && host.includes(':')) return false;
  if (host.endsWith('.internal') || host.endsWith('.local')) return false;
  return true;
}

/** An HTTP connection checked: it answers (and does not refuse its key). */
async function knock(url: string, headers: Record<string, string>) {
  const base = { reason: null, serverName: null, tools: [], resources: [] };
  try {
    const answer = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (answer.status === 401 || answer.status === 403)
      return {
        ...base,
        state: 'refused' as const,
        reason: `It answered ${answer.status}.`,
      };
    if (answer.status >= 500)
      return { ...base, state: 'unreachable' as const, reason: `It answered ${answer.status}.` };
    return { ...base, state: 'connected' as const };
  } catch (error) {
    return { ...base, state: 'unreachable' as const, reason: (error as Error).message };
  }
}

export function connectorService(deps: {
  db: pg.Pool;
  key: Buffer;
  publicUrl: string;
  /** Jarvis's own Atelier (spec 060); read from ATELIER_URL / ATELIER_KEY when not given. */
  atelier?: Atelier | null;
}) {
  const settings = deps.atelier === undefined ? atelierFromEnv() : null;
  const builtIn: Atelier | null = deps.atelier ?? (settings ? atelierOf(settings) : null);
  /** Where a server sends her back after she signed in (spec 025, US4). */
  const redirectUrl = `${deps.publicUrl.replace(/\/$/, '')}/api/connectors/callback`;
  const as = <T>(person: string, work: Parameters<typeof asPerson<T>>[2]) =>
    asPerson(deps.db, person, work);

  const signInOf = (sealed: string | null): SignIn =>
    sealed ? (JSON.parse(open(deps.key, sealed)) as SignIn) : {};
  const keepSignIn = (person: string, id: string) => async (signIn: SignIn) =>
    as(person, (tx) => setOAuth(tx, id, seal(deps.key, JSON.stringify(signIn))));

  /** The connector as she may reach it: its key opened, or her sign-in, for the call. */
  const reach = async (person: string, id: string, onRedirect?: (url: URL) => void) => {
    const found = await as(person, (tx) => connectorWithSecret(tx, id));
    if (!found) throw new Error(`No connector ${id} in her spaces.`);
    const way: Reach = {
      headers: headersOf(found.connector, found.sealed ? open(deps.key, found.sealed) : null),
    };
    if (found.connector.auth === 'oauth') {
      let preset: ReturnType<typeof presetClientFor> = null;
      try {
        preset = presetClientFor(found.connector.url);
      } catch {
        preset = null;
      }
      way.authProvider = signInProvider({
        redirectUrl,
        signIn: signInOf(found.oauth),
        save: keepSignIn(person, id),
        ...(preset ? { preset: preset.client } : {}),
        ...(onRedirect ? { onRedirect } : {}),
      });
    }
    return { connector: found.connector, headers: way, oauth: found.oauth };
  };

  const check = async (person: string, id: string): Promise<Connector> => {
    const { connector, headers, oauth } = await reach(person, id);
    const read =
      connector.protocol === 'http'
        ? await knock(connector.url, headers.headers)
        : await probe(connector.url, headers);
    // A server may show its tools to anyone (Google's do): without her sign-in, it still waits.
    if (connector.auth === 'oauth' && read.state === 'connected' && !signInOf(oauth).tokens) {
      read.state = 'needs_sign_in';
    }
    return as(person, async (tx) => {
      await setProbe(tx, id, read);
      return (await connectorsOf(tx, [connector.spaceId])).find((one) => one.id === id)!;
    });
  };

  // An agent on her own machine (http://localhost) is reached from a developer's Jarvis, never
  // from production.
  const local = (process.env.JARVIS_BRANCH ?? 'dev') !== 'main';

  /** A rule's `call` (spec 050): her connection by name, its secret opened here only. */
  const callOut = async (request: CallRequest): Promise<unknown> => {
    const { rows } = await as(request.person, (tx) =>
      tx.query<{ id: string }>(
        'select id from connector where space_id = $1 and lower(name) = lower($2) limit 1',
        [request.spaceId, request.connection],
      ),
    );
    // Jarvis's own Atelier (spec 060): reached by Jarvis, never one of her connections.
    if (!rows[0] && builtIn && request.connection.trim().toLowerCase() === ATELIER.toLowerCase()) {
      if (request.tool) throw new Error(`Call «${ATELIER}»: give a path (/jobs/<capability>).`);
      const work = request.body.jarvis;
      if (work && typeof work === 'object' && !Array.isArray(work))
        request.body.jarvis = { ...work, url: `${deps.publicUrl.replace(/\/$/, '')}/api` };
      return builtIn.post(request.path ?? '', request.body);
    }
    if (!rows[0]) throw new Error(`Call «${request.connection}»: no connection of that name here.`);
    const { connector, headers } = await reach(request.person, rows[0].id);
    const actor: Actor = { person: request.person, door: 'rule' };
    // Long work (spec 057): where the service answers, next to its token.
    const work = request.body.jarvis;
    if (work && typeof work === 'object' && !Array.isArray(work))
      request.body.jarvis = { ...work, url: `${deps.publicUrl.replace(/\/$/, '')}/api` };
    let ok = false;
    try {
      if (request.tool) {
        if (connector.protocol === 'http')
          throw new Error(
            `Call «${connector.name}»: an HTTP connection has no tools; give a path.`,
          );
        const answer = await callTool(connector, headers, request.tool, request.body);
        if (answer.isError)
          throw new Error(`Call «${connector.name}»: its tool answered an error.`);
        ok = true;
        return answer.content;
      }
      if (connector.protocol !== 'http')
        throw new Error(`Call «${connector.name}»: an MCP connection is called by a tool.`);
      const url = new URL(
        (request.path ?? '').replace(/^\//, ''),
        connector.url.replace(/\/?$/, '/'),
      );
      if (!reachable(url, local))
        throw new Error(
          `Call «${connector.name}»: ${url.origin} is not an address Jarvis calls (https, outside private networks).`,
        );
      const answer = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers.headers,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        redirect: 'error',
      });
      const text = await answer.text();
      if (text.length > CALL_MAX_BYTES)
        throw new Error(`Call «${connector.name}»: its answer is larger than 2 MB.`);
      if (!answer.ok) throw new Error(`Call «${connector.name}»: it answered ${answer.status}.`);
      ok = true;
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Call «${connector.name}»: its answer is not JSON.`);
      }
    } finally {
      await as(request.person, (tx) =>
        recordCall(tx, actor, connector, {
          tool: request.tool ?? request.path ?? '/',
          ok,
          agreed: true,
        }),
      ).catch(() => undefined);
    }
  };

  return {
    /** Jarvis's own Atelier, when this server reaches one (spec 060). */
    atelier: builtIn,
    callOut,
    list: (person: string, spaceIds: string[]) => as(person, (tx) => connectorsOf(tx, spaceIds)),

    async add(actor: Actor, spaceId: string, input: ConnectorInput): Promise<Connector> {
      const made = await as(actor.person, (tx) =>
        addConnector(tx, actor, {
          spaceId,
          name: input.name,
          url: input.url,
          auth: input.auth as ConnectorAuth,
          headerName: input.headerName ?? null,
          sealed: input.secret ? seal(deps.key, input.secret) : null,
          protocol: input.protocol,
        }),
      );
      return check(actor.person, made.id);
    },

    check,

    async change(actor: Actor, id: string, input: z.infer<typeof connectorChange>) {
      await as(actor.person, (tx) =>
        changeConnector(tx, actor, id, {
          ...(input.name ? { name: input.name } : {}),
          ...(input.url ? { url: input.url } : {}),
          ...(input.auth ? { auth: input.auth as ConnectorAuth } : {}),
          ...(input.headerName !== undefined ? { headerName: input.headerName ?? null } : {}),
          ...(input.secret !== undefined
            ? { sealed: input.secret ? seal(deps.key, input.secret) : null }
            : {}),
        }),
      );
      return check(actor.person, id);
    },

    cut: (actor: Actor, id: string) => as(actor.person, (tx) => cutConnector(tx, actor, id)),

    /**
     * Her sign-in to a server that asks for it: Jarvis registers itself, keeps the proof of the
     * request, and gives the address of the server's sign-in page; null when she is signed in.
     */
    async signIn(person: string, id: string): Promise<string | null> {
      let page: URL | null = null;
      const { connector, headers } = await reach(person, id, (url) => {
        page = url;
      });
      if (connector.auth !== 'oauth' || !headers.authProvider) {
        throw new Error(`« ${connector.name} » is reached with a key, not a sign-in.`);
      }
      // A server that does not register clients itself (Google) uses the one registered once.
      const preset = presetClientFor(connector.url);
      const state = `${id}.${randomBytes(16).toString('base64url')}`;
      await keepSignIn(person, id)({ ...signInOf((await reach(person, id)).oauth), state });
      const { headers: fresh } = await reach(person, id, (url) => {
        // Google gives a renewable sign-in only when asked for it.
        if (preset?.google) {
          url.searchParams.set('access_type', 'offline');
          url.searchParams.set('prompt', 'consent');
        }
        page = url;
      });
      const result = await auth(fresh.authProvider!, {
        serverUrl: connector.url,
        ...(preset?.scope ? { scope: preset.scope } : {}),
      });
      if (result === 'AUTHORIZED') {
        await check(person, id);
        return null;
      }
      if (!page) throw new Error(`« ${connector.name} » gave no sign-in page.`);
      return String(page);
    },

    /** Back from the server's sign-in page: the code turned into tokens, then a check. */
    async finishSignIn(person: string, state: string, code: string): Promise<Connector> {
      const id = state.split('.')[0] ?? '';
      const { connector, headers, oauth } = await reach(person, id);
      if (!headers.authProvider || signInOf(oauth).state !== state) {
        throw new Error('No connector sign-in on its way: start it again.');
      }
      await auth(headers.authProvider, { serverUrl: connector.url, authorizationCode: code });
      const signedIn = signInOf((await reach(person, id)).oauth);
      delete signedIn.state;
      delete signedIn.verifier;
      await keepSignIn(person, id)(signedIn);
      return check(person, id);
    },

    /** One of the server's resources (a file, a page), read with her key or sign-in. */
    async read(person: string, id: string, uri: string) {
      const { connector, headers } = await reach(person, id);
      return readResource(connector, headers, uri);
    },

    /**
     * A tool of a connector, called with her key. A tool that changes or deletes things, or reaches
     * the outside world, needs her yes (`agreed`). Journaled without its arguments nor its answer.
     */
    async call(
      actor: Actor,
      id: string,
      tool: string,
      args: Record<string, unknown>,
      agreed: boolean,
    ) {
      const { connector, headers } = await reach(actor.person, id);
      const known = connector.tools.find((one) => one.name === tool);
      if (!known) {
        throw new Error(
          `« ${connector.name} » has no tool « ${tool} »: its tools are ${connector.tools.map((one) => one.name).join(', ') || 'none (check it again)'}.`,
        );
      }
      if (needsAgreement(known) && !agreed) {
        throw new Error(
          `« ${tool} » of « ${connector.name} » changes, deletes or sends something: ask her first, then call it again with agreed: true.`,
        );
      }
      let ok = false;
      try {
        const answer = await callTool(connector, headers, tool, args);
        ok = !answer.isError;
        return answer;
      } finally {
        await as(actor.person, (tx) => recordCall(tx, actor, connector, { tool, ok, agreed }));
      }
    },
  };
}

export type ConnectorService = ReturnType<typeof connectorService>;
