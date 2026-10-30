import { requireMcpAuth } from '@better-auth/mcp';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import {
  addFile,
  agenda,
  asPerson,
  calendarOwner,
  DEFAULT_ZONE,
  clientSpaces,
  FILE_MAX_BYTES,
  get,
  minutesOf,
  pool,
  previewInvitation,
  readDocument,
  slugOf,
  spacesOf,
} from '@jarvis-os/core';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { CONSENT_PAGE, makeAuth, mcpResource, SIGN_IN_PAGE } from './auth';
import { FEED_DAYS_AFTER, FEED_DAYS_BEFORE, icsOf, type Series } from './ics';
import { fill, langOf, wordsOf } from './i18n';
import { mcpServerFor } from './mcp';
import { consentPage, invitationPage, messagePage, signInPage } from './pages';
import { apiRoutes } from './routes';
import type { Settings } from './settings';
import { objectStorage } from './storage';
import { appPage } from './platform/page';
import { spaceFor } from './spaces';
import { computeDashboard, dashboardView, widgetsOf } from './views/dashboard';
import {
  DOCUMENT_HOURS,
  documentShown,
  documentToken,
  documentView,
  readDocumentToken,
} from './views/document';
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

  app.route(
    '/api',
    apiRoutes({ auth, db, blobs, publicUrl: settings.publicUrl, secret: settings.authSecret }),
  );

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

  // Her web account (spec 009): the app with her session, else the sign-in page; its frames
  // reuse the clients' views for a dashboard and a document.
  const sessionOf = (request: Request) => auth.api.getSession({ headers: request.headers });
  app.get('/', (c) => c.redirect('/app'));
  app.get('/app', async (c) => {
    if (!(await sessionOf(c.req.raw))) return c.redirect(SIGN_IN_PAGE);
    return c.html(appPage(langOf(c.req.header('accept-language'))));
  });
  app.get('/app/frame/:view/:id', async (c) => {
    const session = await sessionOf(c.req.raw);
    if (!session) return c.redirect(SIGN_IN_PAGE);
    const person = session.user.id;
    const id = c.req.param('id');
    const spaces = await asPerson(db, person, (tx) => spacesOf(tx));
    const space = spaceFor(spaces, c.req.query('space'));
    try {
      if (c.req.param('view') === 'dashboard') {
        const saved = await asPerson(db, person, (tx) => get(tx, space.id, id));
        if (!saved) return c.notFound();
        return c.html(
          dashboardView(
            await computeDashboard(db, person, {
              title: saved.title,
              widgets: widgetsOf(saved.data),
              spaces,
            }),
          ),
        );
      }
      if (c.req.param('view') === 'document') {
        const read = await asPerson(db, person, (tx) =>
          readDocument(tx, space.id, { id, whole: true }),
        );
        const link = `${settings.publicUrl.replace(/\/$/, '')}/document/${documentToken(
          { person, spaceId: space.id, id, until: Date.now() + DOCUMENT_HOURS * 3_600_000 },
          settings.authSecret,
        )}`;
        return c.html(
          documentView(
            documentShown(
              { ...read, versions: [] },
              { space: space.name, spaceId: space.id, link },
            ),
          ),
        );
      }
    } catch (error) {
      const lang = langOf(c.req.header('accept-language'));
      return c.html(messagePage(lang, (error as Error).message), 400);
    }
    return c.notFound();
  });

  // A reading link (spec 008): the document as a page to read and print, or its Markdown file.
  app.get('/document/:token', async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    let grant;
    try {
      grant = readDocumentToken(c.req.param('token'), settings.authSecret);
    } catch {
      return c.html(messagePage(lang, wordsOf(lang).documentExpired), 410);
    }
    const { id, spaceId } = grant;
    const found = await asPerson(db, grant.person, async (tx) => {
      const space = (await spacesOf(tx)).find((one) => one.id === spaceId);
      return space ? { space, read: await readDocument(tx, spaceId, { id, whole: true }) } : null;
    }).catch(() => null);
    if (!found) return c.html(messagePage(lang, wordsOf(lang).documentExpired), 410);
    const { read, space } = found;
    if (c.req.query('format') === 'md') {
      const text = /^#\s/.test(read.text.trimStart())
        ? read.text
        : `# ${read.title}\n\n${read.text}`;
      return c.body(text, 200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${slugOf(read.title)}.md`)}`,
      });
    }
    return c.html(
      documentView(
        documentShown(
          { ...read, versions: [] },
          { space: space.name, spaceId: space.id, link: '' },
        ),
      ),
    );
  });

  // Her calendar for the calendar of her phone (spec 011): the private address is the only key.
  app.get('/agenda/:file', async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    const key = c.req.param('file').replace(/\.ics$/, '');
    const owner = await calendarOwner(db, key);
    if (!owner) return c.text(wordsOf(lang).calendarGone, 404);
    const now = new Date();
    const { occurrences, name, series } = await asPerson(db, owner, async (tx) => {
      const spaces = await spacesOf(tx);
      const occurrences = await agenda(
        tx,
        spaces.map((one) => one.id),
        {
          from: new Date(now.getTime() - FEED_DAYS_BEFORE * 86_400_000),
          to: new Date(now.getTime() + FEED_DAYS_AFTER * 86_400_000),
        },
      );
      // A repeated entry goes to her phone once, with its rule, not a year of copies.
      const series = new Map<string, Series>();
      for (const one of occurrences) {
        if (!one.repeated || series.has(one.id)) continue;
        const data = (await get(tx, one.spaceId, one.id))?.data ?? {};
        if (typeof data.repete !== 'string') continue;
        const skipped: unknown[] = Array.isArray(data.sauf) ? data.sauf : [data.sauf];
        series.set(one.id, {
          repete: data.repete,
          duree: minutesOf(data.duree),
          sauf: skipped
            .filter(
              (day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day),
            )
            .map((day) => day.slice(0, 10)),
          fuseau: typeof data.fuseau === 'string' && data.fuseau ? data.fuseau : DEFAULT_ZONE,
          jusqu: typeof data.jusqu === 'string' ? data.jusqu : null,
        });
      }
      return { name: spaces.find((one) => one.personal)?.name ?? '', occurrences, series };
    });
    const words = wordsOf(lang);
    return c.body(
      icsOf(occurrences, {
        name: fill(words.calendarName, { name }),
        now,
        zone: DEFAULT_ZONE,
        proposed: words.calendarProposed,
        series,
      }),
      200,
      {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'private, max-age=300',
      },
    );
  });

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
      // A connection she revoked (spec 009) stops at once, before its token expires.
      if (clientId) {
        const consent = await db.query(
          'select 1 from "oauthConsent" where "userId" = $1 and "clientId" = $2',
          [person, clientId],
        );
        if (consent.rowCount === 0) {
          return Response.json({ error: 'This connection was revoked.' }, { status: 401 });
        }
      }
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
