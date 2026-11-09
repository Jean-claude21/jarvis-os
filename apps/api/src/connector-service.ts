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
  type ConnectorAuth,
} from '@jarvis-os/core';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { callTool, headersOf, needsAgreement, probe, readResource, type Reach } from './connectors';
import { signInProvider, type SignIn } from './oauth-client';
import { open, seal } from './secrets';

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
});
export type ConnectorInput = z.infer<typeof connectorInput>;

export const connectorChange = connectorInput.partial();

export function connectorService(deps: { db: pg.Pool; key: Buffer; publicUrl: string }) {
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
      way.authProvider = signInProvider({
        redirectUrl,
        signIn: signInOf(found.oauth),
        save: keepSignIn(person, id),
        ...(onRedirect ? { onRedirect } : {}),
      });
    }
    return { connector: found.connector, headers: way, oauth: found.oauth };
  };

  const check = async (person: string, id: string): Promise<Connector> => {
    const { connector, headers } = await reach(person, id);
    const read = await probe(connector.url, headers);
    return as(person, async (tx) => {
      await setProbe(tx, id, read);
      return (await connectorsOf(tx, [connector.spaceId])).find((one) => one.id === id)!;
    });
  };

  return {
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
      const state = `${id}.${randomBytes(16).toString('base64url')}`;
      await keepSignIn(person, id)({ ...signInOf((await reach(person, id)).oauth), state });
      const { headers: fresh } = await reach(person, id, (url) => {
        page = url;
      });
      const result = await auth(fresh.authProvider!, { serverUrl: connector.url });
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
