import { requireMcpAuth } from '@better-auth/mcp';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { asPerson, pool, spacesOf } from '@jarvis-os/core';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { CONSENT_PAGE, makeAuth, mcpResource, SIGN_IN_PAGE } from './auth';
import { langOf, wordsOf } from './i18n';
import { mcpServerFor } from './mcp';
import { consentPage, signInPage } from './pages';
import { apiRoutes } from './routes';
import type { Settings } from './settings';
import { objectStorage } from './storage';

/**
 * The Jarvis OS server: accounts and OAuth (`/auth`), the REST API (`/api`), the MCP server
 * (`/mcp`), the sign-in and consent pages, and the discovery documents MCP clients read.
 */
export function makeApp(settings: Settings) {
  const db = pool(settings.appUrl);
  const blobs = objectStorage(settings.storage);
  const auth = makeAuth({ db, secret: settings.authSecret, publicUrl: settings.publicUrl });
  const resource = mcpResource(settings.publicUrl);
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'healthy' }));
  app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));
  // Discovery at the root, where MCP clients look first. The protected resource's metadata
  // (RFC 9728) is matched by the MCP plugin on the path as it is; the authorization server's
  // (RFC 8414, path-inserted) is answered by the same handler as under /auth.
  app.get('/.well-known/oauth-protected-resource/*', (c) => auth.handler(c.req.raw));
  app.get('/.well-known/oauth-protected-resource', (c) => auth.handler(c.req.raw));
  app.get('/.well-known/*', (c) => {
    const url = new URL(c.req.url);
    const path = url.pathname.replace(/\/auth$/, '');
    url.pathname = `/auth${path}`;
    return auth.handler(new Request(url, c.req.raw));
  });

  app.route('/api', apiRoutes({ auth, db, blobs }));

  /** The name the client gave itself when it registered, for the pages. */
  const clientName = async (clientId: string | null) => {
    if (!clientId) return null;
    const { rows } = await db.query<{ name: string | null }>(
      'select name from "oauthClient" where "clientId" = $1',
      [clientId],
    );
    return rows[0]?.name || null;
  };

  app.get(SIGN_IN_PAGE, async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    return c.html(
      signInPage(lang, wordsOf(lang), await clientName(c.req.query('client_id') ?? null)),
    );
  });

  app.get(CONSENT_PAGE, async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    const words = wordsOf(lang);
    const query = new URL(c.req.url).search.slice(1);
    const valid = query.length > 0 && (await verifyOAuthQueryParams(query, settings.authSecret));
    return c.html(
      consentPage(lang, words, {
        valid,
        client: (await clientName(c.req.query('client_id') ?? null)) ?? words.aClient,
        scopes: c.req.query('scope') ?? '',
      }),
    );
  });

  // MCP (spec 003): stateless Streamable HTTP; a server built for the token's person each time.
  const mcp = requireMcpAuth(
    auth,
    async (request, claims) => {
      const person = String(claims.sub ?? '');
      const { rows } = await db.query<{ name: string }>('select name from "user" where id = $1', [
        person,
      ]);
      const [space] = await asPerson(db, person, (tx) => spacesOf(tx));
      if (!rows[0] || !space) return Response.json({ error: 'No such account.' }, { status: 401 });
      const client = typeof claims.azp === 'string' ? claims.azp : undefined;
      const server = await mcpServerFor(
        { db, blobs },
        {
          person,
          name: rows[0].name,
          spaceId: space.id,
          ...(client ? { client: (await clientName(client)) ?? client } : {}),
        },
      );
      // No session id generator: stateless, every request stands alone.
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      await server.connect(transport);
      return transport.handleRequest(request);
    },
    { resource },
  );
  app.all('/mcp', (c) => mcp(c.req.raw));

  return { app, auth, db, blobs, resource, close: () => db.end() };
}
