import { requireMcpAuth } from '@better-auth/mcp';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import {
  addFile,
  asPerson,
  clientSpaces,
  FILE_MAX_BYTES,
  pool,
  previewInvitation,
  spacesOf,
} from '@jarvis-os/core';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { CONSENT_PAGE, makeAuth, mcpResource, SIGN_IN_PAGE } from './auth';
import { langOf, wordsOf } from './i18n';
import { mcpServerFor } from './mcp';
import { consentPage, invitationPage, messagePage, signInPage } from './pages';
import { apiRoutes } from './routes';
import type { Settings } from './settings';
import { objectStorage } from './storage';
import { readUploadToken, uploadView } from './views/upload';

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

  app.route('/api', apiRoutes({ auth, db, blobs, publicUrl: settings.publicUrl }));

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
    // Her spaces, to choose which this client reaches (spec 004).
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const spaces = session ? await asPerson(db, session.user.id, (tx) => spacesOf(tx)) : [];
    return c.html(
      consentPage(lang, words, {
        valid,
        client: (await clientName(c.req.query('client_id') ?? null)) ?? words.aClient,
        clientId: c.req.query('client_id') ?? '',
        scopes: c.req.query('scope') ?? '',
        spaces: spaces.map((one) => ({ id: one.id, name: one.name, personal: one.personal })),
      }),
    );
  });

  // An upload link (spec 005): files go straight into her life, never through the model. The
  // token is the credential, so the view, framed by any host, may post here.
  app.get('/upload/:token', async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    try {
      const grant = readUploadToken(c.req.param('token'), settings.authSecret);
      const spaces = await asPerson(db, grant.person, (tx) => spacesOf(tx));
      const space = spaces.find((one) => one.id === grant.spaceId);
      if (!space) throw new Error('This upload link is not valid.');
      return c.html(
        uploadView({
          url: new URL(c.req.url).pathname,
          expiresAt: new Date(grant.until).toISOString(),
          space: space.name,
        }),
      );
    } catch {
      return c.html(messagePage(lang, wordsOf(lang).uploadExpired), 410);
    }
  });
  app.use('/upload/:token', cors({ origin: '*', allowMethods: ['POST'] }));
  app.post(
    '/upload/:token',
    bodyLimit({
      maxSize: FILE_MAX_BYTES + 1024 * 1024,
      onError: (c) =>
        c.json({ error: `The file is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.` }, 400),
    }),
    async (c) => {
      let grant;
      try {
        grant = readUploadToken(c.req.param('token'), settings.authSecret);
      } catch (error) {
        return c.json({ error: (error as Error).message }, 410);
      }
      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File))
        return c.json({ error: 'Send the file in the field « file ».' }, 400);
      const stored = await asPerson(db, grant.person, async (tx) =>
        addFile(tx, { person: grant.person, door: 'upload' }, blobs, {
          spaceId: grant.spaceId,
          name: file.name,
          mediaType: file.type || 'application/octet-stream',
          bytes: new Uint8Array(await file.arrayBuffer()),
          links: grant.links,
        }),
      );
      return c.json(stored, 201);
    },
  );

  // An invitation into a shared space (spec 004): the page reads the secret from its fragment.
  app.get('/invitation', (c) => {
    const lang = langOf(c.req.header('accept-language'));
    return c.html(invitationPage(lang, wordsOf(lang)));
  });
  app.post('/invitation/preview', async (c) => {
    const { token } = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof token !== 'string' || token.length < 10 || token.length > 200) {
      return c.json({ error: 'No invitation.' }, 400);
    }
    const preview = await asPerson(db, '', (tx) => previewInvitation(tx, token));
    return preview ? c.json(preview) : c.json({ error: 'No invitation.' }, 404);
  });

  // MCP (spec 003): stateless Streamable HTTP; a server built for the token's person each time.
  const mcp = requireMcpAuth(
    auth,
    async (request, claims) => {
      const person = String(claims.sub ?? '');
      const { rows } = await db.query<{ name: string; email: string }>(
        'select name, email from "user" where id = $1',
        [person],
      );
      const clientId = typeof claims.azp === 'string' ? claims.azp : undefined;
      // The spaces this client may reach for her; her own only, without a client.
      const spaces = await asPerson(db, person, async (tx) =>
        clientId ? clientSpaces(tx, clientId) : (await spacesOf(tx)).filter((one) => one.personal),
      );
      if (!rows[0] || spaces.length === 0) {
        return Response.json({ error: 'No such account.' }, { status: 401 });
      }
      const server = await mcpServerFor(
        { db, blobs, publicUrl: settings.publicUrl, secret: settings.authSecret },
        {
          person,
          name: rows[0].name,
          email: rows[0].email,
          spaces,
          ...(clientId ? { clientId, client: (await clientName(clientId)) ?? clientId } : {}),
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
