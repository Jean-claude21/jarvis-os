import {
  addFile,
  agenda,
  archive,
  attention,
  filesOf,
  asPerson,
  FILE_MAX_BYTES,
  fileOf,
  find,
  findInputSchema,
  get,
  history,
  kinds,
  linkInputSchema,
  acceptInvitation,
  allowSpaces,
  clientSpaces,
  createSharedSpace,
  DEFAULT_ZONE,
  inZone,
  readDocument,
  renewCalendarKey,
  upcoming,
  exportMarkdown,
  importMarkdown,
  invitationsOf,
  invite,
  leaveSpace,
  membersOf,
  query,
  querySchema,
  renameSpace,
  save,
  modelsOf,
  spacesOf,
  undo,
  withdrawInvitation,
  type Actor,
  type Blobs,
  type Space,
  type Tx,
  withComputed,
  pagesOf,
  renderPage,
  installApp,
  runView,
  viewsOf,
  setZone,
  zoneOf,
  createKey,
  fingerprintOf,
  KEY_PREFIX,
  keyOwner,
  keysOf,
  revokeKey,
  type ViewData,
} from '@jarvis-os/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type pg from 'pg';
import { z } from 'zod';
import { shippedApp, shippedApps } from './apps';
import { telegramLink } from './telegram';
import type { Auth } from './auth';
import { codeOf, failure } from './errors';
import { invitationLink, namesOf, spaceFor } from './spaces';
import { computeDashboard, widgetSchema, widgetsOf, type Widget } from './views/dashboard';
import { DOCUMENT_HOURS, documentShown, documentToken } from './views/document';
import { zip } from './zip';

type Env = {
  Variables: {
    person: string;
    email: string;
    name: string;
    spaces: Space[];
    client: string | undefined;
  };
};

/** Monday 00:00 of the week of `at`, on her clock (Paris unless she said otherwise). */
export function weekStart(at: Date, zone = DEFAULT_ZONE): string {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    .format(at)
    .split('-')
    .map(Number) as [number, number, number];
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return inZone({ year, month, day: day - weekday, hour: 0, minute: 0 }, zone).toISOString();
}

const linksSchema = z.array(linkInputSchema.omit({ from: true })).max(20);

/** A Markdown folder sent to be imported (spec 007). */
const importSchema = z.object({
  docs: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .max(500)
          .regex(/\.md$/i)
          .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), {
            message: 'A path stays inside the folder.',
          }),
        text: z.string().max(2_000_000),
      }),
    )
    .min(1)
    .max(5000),
  kinds: z.record(z.string(), z.string().min(1).max(80)).optional(),
  name: z.string().max(200).optional(),
});
const IMPORT_MAX_BYTES = 40 * 1024 * 1024;

/**
 * `/api` (spec 002): every function of the core, for the signed-in person, under row-level
 * security. A route acts in the space named by `?space=` (an id or a name) or the `x-jarvis-space`
 * header, else in her own (spec 004). The routes parse, call the core and answer — nothing else.
 */
export function apiRoutes(deps: {
  auth: Auth;
  db: pg.Pool;
  blobs: Blobs;
  publicUrl: string;
  secret: string;
}) {
  const api = new Hono<Env>();

  api.use('*', async (c, next) => {
    // A personal key (spec 015) acts as her, like her session.
    const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? '';
    const byKey = bearer.startsWith(KEY_PREFIX) ? await keyOwner(deps.db, bearer) : null;
    if (bearer.startsWith(KEY_PREFIX) && !byKey)
      return c.json({ error: 'This key answers nothing.' }, 401);
    const session = byKey
      ? await deps.db
          .query<{ id: string; email: string; name: string }>(
            'select id, email, name from "user" where id = $1',
            [byKey],
          )
          .then(({ rows }) => (rows[0] ? { user: rows[0] } : null))
      : await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'Sign in first.' }, 401);
    const person = session.user.id;
    if (byKey) {
      await asPerson(deps.db, person, (tx) =>
        tx.query('update personal_key set last_used_at = now() where fingerprint = $1', [
          fingerprintOf(bearer),
        ]),
      );
    }
    const spaces = await asPerson(deps.db, person, (tx) => spacesOf(tx));
    if (spaces.length === 0) return c.json({ error: 'This account has no space.' }, 500);
    c.set('person', person);
    c.set('email', session.user.email);
    c.set('name', session.user.name);
    c.set('spaces', spaces);
    c.set('client', c.req.header('x-jarvis-client') ?? undefined);
    await next();
  });

  api.onError((error, c) => {
    const { status, message } = failure(error);
    if (status === 500) console.error(error);
    const code = status === 500 ? null : codeOf(message);
    return c.json({ error: message, ...(code ? { code } : {}) }, status);
  });

  const actorOf = (c: Context<Env>): Actor => {
    const client = c.get('client');
    return { person: c.get('person'), door: 'api', ...(client ? { client } : {}) };
  };
  /** The work of a route, in the space it names (else her own). */
  const act = <T>(c: Context<Env>, work: (tx: Tx, actor: Actor, spaceId: string) => Promise<T>) => {
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    return asPerson(deps.db, c.get('person'), (tx) => work(tx, actorOf(c), space.id));
  };
  /** The work of a route about spaces themselves. */
  const as = <T>(c: Context<Env>, work: (tx: Tx, actor: Actor) => Promise<T>) =>
    asPerson(deps.db, c.get('person'), (tx) => work(tx, actorOf(c)));

  api.get('/me', async (c) =>
    c.json({
      person: { id: c.get('person'), name: c.get('name'), email: c.get('email') },
      space: spaceFor(c.get('spaces')),
      spaces: c.get('spaces'),
    }),
  );

  // Spaces (spec 004): hers, who belongs, invitations, leaving.
  api.get('/spaces', async (c) => {
    const spaces = await as(c, async (tx) => {
      const all = [];
      for (const space of await spacesOf(tx)) {
        all.push({ ...space, members: await membersOf(tx, space.id) });
      }
      return all;
    });
    const names = await namesOf(
      deps.db,
      spaces.flatMap((space) => space.members.map((one) => one.person)),
    );
    return c.json(
      spaces.map((space) => ({
        ...space,
        members: space.members.map((one) => ({ ...one, name: names.get(one.person) ?? null })),
      })),
    );
  });

  api.post('/spaces', async (c) => {
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(await c.req.json());
    return c.json(await as(c, (tx, actor) => createSharedSpace(tx, actor, { name })), 201);
  });

  api.patch('/spaces/:id', async (c) => {
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(await c.req.json());
    await as(c, (tx, actor) => renameSpace(tx, actor, { spaceId: c.req.param('id'), name }));
    return c.json({ renamed: c.req.param('id'), name });
  });

  api.post('/spaces/:id/invitations', async (c) => {
    const { email } = z.object({ email: z.string().min(3).max(320) }).parse(await c.req.json());
    const made = await as(c, (tx, actor) =>
      invite(tx, actor, { spaceId: c.req.param('id'), email }),
    );
    return c.json(
      {
        invitationId: made.invitationId,
        link: invitationLink(deps.publicUrl, made.token),
        expiresAt: made.expiresAt,
      },
      201,
    );
  });

  api.get('/spaces/:id/invitations', async (c) =>
    c.json(await as(c, (tx) => invitationsOf(tx, c.req.param('id')))),
  );

  api.delete('/spaces/:id/invitations/:invitation', async (c) => {
    await as(c, (tx, actor) =>
      withdrawInvitation(tx, actor, {
        spaceId: c.req.param('id'),
        invitationId: c.req.param('invitation'),
      }),
    );
    return c.json({ withdrawn: c.req.param('invitation') });
  });

  // `me` to leave; another member's id, for an owner, to remove them.
  api.delete('/spaces/:id/members/:person', async (c) => {
    const who = c.req.param('person');
    await as(c, (tx, actor) =>
      leaveSpace(tx, actor, {
        spaceId: c.req.param('id'),
        ...(who === 'me' ? {} : { person: who }),
      }),
    );
    return c.json({ left: c.req.param('id') });
  });

  api.post('/invitations/accept', async (c) => {
    const { token } = z.object({ token: z.string().min(10).max(200) }).parse(await c.req.json());
    return c.json(
      await as(c, (tx, actor) => acceptInvitation(tx, actor, { token, email: c.get('email') })),
    );
  });

  // The spaces a client (Claude, ChatGPT…) may reach for her: set at consent, or from her account.
  api.get('/clients/:client/spaces', async (c) =>
    c.json(await as(c, (tx) => clientSpaces(tx, c.req.param('client')))),
  );

  api.put('/clients/:client/spaces', async (c) => {
    const { spaces } = z
      .object({ spaces: z.array(z.string().min(1)).max(50) })
      .parse(await c.req.json());
    return c.json(await as(c, (tx) => allowSpaces(tx, c.req.param('client'), spaces)));
  });

  api.get('/kinds', async (c) => c.json(await act(c, (tx, _a, space) => kinds(tx, space))));

  api.get('/entries', async (c) => {
    const q = c.req.query();
    const input = findInputSchema.parse({
      ...(q.text ? { text: q.text } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      archived: q.archived === 'true',
      ...(q.limit ? { limit: Number(q.limit) } : {}),
    });
    return c.json(
      await act(c, async (tx, _a, space) => withComputed(tx, space, await find(tx, space, input))),
    );
  });

  // Filing an app in an area (spec 015): every model of the app says it.
  api.post('/apps/area', async (c) => {
    const body = (await c.req.json()) as { app?: string; area?: string };
    const app = String(body.app ?? '').trim();
    const area = String(body.area ?? '')
      .trim()
      .slice(0, 60);
    return c.json(
      await act(c, async (tx, actor, space) => {
        const models = (await modelsOf(tx, space)).filter((one) => one.app === app);
        if (!models.length) throw new Error(`No app « ${app} » in this space.`);
        await save(tx, actor, space, {
          entries: models.map((one) => ({ id: one.id, data: { area: area || null } })),
        });
        return { app, area: area || null, models: models.length };
      }),
    );
  });

  // Her views (spec 015): those she kept, and one run — kept (`id`, with what she changed) or not.
  api.get('/views', async (c) =>
    c.json(
      await act(c, (tx, _a, space) =>
        viewsOf(tx, space, {
          kind: c.req.query('kind') || undefined,
          app: c.req.query('app') || undefined,
        }),
      ),
    ),
  );

  api.post('/views/run', async (c) => {
    const body = (await c.req.json()) as { id?: string; view?: Record<string, unknown> };
    return c.json(
      await act(c, async (tx, _a, space) => {
        let view = body.view ?? {};
        if (body.id) {
          const kept = await get(tx, space, body.id);
          if (!kept || kept.kind.toLowerCase() !== 'view')
            throw new Error(`No view ${body.id} in this space.`);
          view = { ...kept.data, ...view };
        }
        return runView(tx, space, view as ViewData);
      }),
    );
  });

  // The apps Jarvis ships (spec 014), and installing one: tried first unless `dryRun` is false.
  api.get('/apps', (c) =>
    c.json(shippedApps.map((one) => ({ app: one.app, description: one.description ?? '' }))),
  );

  api.post('/apps/install', async (c) => {
    const body = (await c.req.json()) as { name?: string; dryRun?: boolean };
    const bundle = shippedApp(String(body.name ?? ''));
    return c.json(
      await act(c, (tx, actor, space) =>
        installApp(tx, actor, space, bundle, body.dryRun !== false),
      ),
    );
  });

  // The pages of her apps (spec 014): the list, and one computed for her filters.
  api.get('/pages', async (c) =>
    c.json(await act(c, (tx, _a, space) => pagesOf(tx, space, c.req.query('app') || undefined))),
  );

  api.get('/pages/:id', async (c) => {
    const params = { ...c.req.query() };
    delete params.space;
    const drawn = await act(c, async (tx, _a, space) => {
      const entry = await get(tx, space, c.req.param('id'));
      if (!entry || entry.kind.toLowerCase() !== 'page') return null;
      return renderPage(tx, space, entry, params);
    });
    return drawn ? c.json(drawn) : c.json({ error: `No page ${c.req.param('id')}.` }, 404);
  });

  api.get('/entries/:id', async (c) => {
    const entry = await act(c, async (tx, _a, space) => {
      const one = await get(tx, space, c.req.param('id'));
      return one ? (await withComputed(tx, space, [one]))[0] : null;
    });
    return entry ? c.json(entry) : c.json({ error: `No entry ${c.req.param('id')}.` }, 404);
  });

  api.post('/save', async (c) => {
    const body = await c.req.json();
    return c.json(await act(c, (tx, actor, space) => save(tx, actor, space, body)));
  });

  api.post('/entries/:id/archive', async (c) => {
    await act(c, (tx, actor, space) =>
      archive(tx, actor, { spaceId: space, id: c.req.param('id') }),
    );
    return c.json({ archived: c.req.param('id') });
  });

  // A query reads every space of hers, unless one is named.
  api.post('/query', async (c) => {
    const { sql } = querySchema.parse(await c.req.json());
    const named = c.req.query('space') ?? c.req.header('x-jarvis-space');
    const spaceIds = named
      ? [spaceFor(c.get('spaces'), named).id]
      : c.get('spaces').map((one) => one.id);
    return c.json(await as(c, (tx) => query(tx, { spaceIds, sql })));
  });

  api.get('/history', async (c) => {
    const target = c.req.query('target');
    const limit = Number(c.req.query('limit') ?? 50);
    return c.json(
      await act(c, (tx, _a, space) => history(tx, space, { ...(target ? { target } : {}), limit })),
    );
  });

  api.post('/undo', async (c) => {
    const { journalId } = z
      .object({ journalId: z.number().int().positive() })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) => undo(tx, actor, { spaceId: space, journalId })),
    );
  });

  // A file: multipart `file`, with optional `title`, `data` (JSON) and `links` (JSON).
  api.post(
    '/files',
    bodyLimit({
      maxSize: FILE_MAX_BYTES + 1024 * 1024,
      onError: (c) =>
        c.json({ error: `The file is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.` }, 400),
    }),
    async (c) => {
      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File))
        return c.json({ error: 'Send the file in the field « file ».' }, 400);
      const title = typeof form.title === 'string' ? form.title : undefined;
      const data =
        typeof form.data === 'string'
          ? z.record(z.string(), z.unknown()).parse(JSON.parse(form.data))
          : undefined;
      const links = typeof form.links === 'string' ? linksSchema.parse(JSON.parse(form.links)) : [];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stored = await act(c, (tx, actor, space) =>
        addFile(tx, actor, deps.blobs, {
          spaceId: space,
          name: file.name,
          mediaType: file.type || 'application/octet-stream',
          bytes,
          ...(title ? { title } : {}),
          ...(data ? { data } : {}),
          links,
        }),
      );
      return c.json(stored, 201);
    },
  );

  // Her files, listed (spec 013): what each is, when, what it is linked to.
  api.get('/files', async (c) => c.json(await act(c, (tx, _a, space) => filesOf(tx, space))));

  api.get('/files/:id', async (c) => {
    const stored = await act(c, (tx, _a, space) => fileOf(tx, space, c.req.param('id')));
    if (!stored) return c.json({ error: `No stored file for entry ${c.req.param('id')}.` }, 404);
    const bytes = await deps.blobs.get(stored.storageKey);
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      'content-type': stored.mediaType,
      'content-disposition': `${c.req.query('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(stored.name)}`,
    });
  });

  api.get('/files/:id/link', async (c) => {
    const seconds = Math.min(Math.max(Number(c.req.query('seconds') ?? 600), 60), 86_400);
    const stored = await act(c, (tx, _a, space) => fileOf(tx, space, c.req.param('id')));
    if (!stored) return c.json({ error: `No stored file for entry ${c.req.param('id')}.` }, 404);
    return c.json({ url: await deps.blobs.link(stored.storageKey, seconds), seconds });
  });

  // Her data, hers (spec 007, decision 0007): a space as a Markdown folder, out and in.
  api.get('/export', async (c) => {
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const files = await asPerson(deps.db, c.get('person'), (tx) =>
      exportMarkdown(tx, space.id, deps.blobs),
    );
    const day = new Date().toISOString().slice(0, 10);
    return c.body(zip(files) as Uint8Array<ArrayBuffer>, 200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${space.name} ${day}.zip`)}`,
    });
  });

  api.post(
    '/import',
    bodyLimit({
      maxSize: IMPORT_MAX_BYTES,
      onError: (c) =>
        c.json({ error: `The folder is larger than ${IMPORT_MAX_BYTES / 1024 / 1024} MB.` }, 400),
    }),
    async (c) => {
      const input = importSchema.parse(await c.req.json());
      return c.json(
        await act(c, (tx, actor, space) =>
          importMarkdown(tx, actor, space, {
            docs: input.docs,
            ...(input.kinds ? { kinds: input.kinds } : {}),
            ...(input.name ? { name: input.name } : {}),
          }),
        ),
        201,
      );
    },
  );

  // The platform (spec 009): what her web account shows without a model.
  api.get('/overview', async (c) => {
    const spaces = c.get('spaces');
    const ids = spaces.map((one) => one.id);
    return c.json(
      await as(c, async (tx) => {
        const { rows: counts } = await tx.query<{
          space_id: string;
          entries: number;
          documents: number;
          reminders: number;
        }>(
          `select space_id, count(*)::int as entries,
                  count(*) filter (where data ? 'text' and length(data->>'text') > 400)::int as documents,
                  count(*) filter (where jarvis_fold(kind) = 'reminder'
                    and coalesce(data->>'status', '') not in ('done', 'sent', 'cancelled'))::int as reminders
             from entry where space_id = any($1) and archived_at is null group by space_id`,
          [ids],
        );
        const { rows: changes } = await tx.query<{ day: string; n: number }>(
          `select to_char(at at time zone 'UTC', 'YYYY-MM-DD') as day, count(*)::int as n
             from journal where space_id = any($1) and at > now() - interval '14 days'
            group by 1 order by 1`,
          [ids],
        );
        const recent = [];
        for (const space of spaces) {
          for (const line of await history(tx, space.id, { limit: 8 })) {
            recent.push({ ...line, space: space.name, spaceId: space.id });
          }
        }
        recent.sort((a, b) => (a.at < b.at ? 1 : -1));
        return {
          spaces: spaces.map((space) => ({
            ...space,
            ...(counts.find((one) => one.space_id === space.id) ?? {
              entries: 0,
              documents: 0,
              reminders: 0,
            }),
          })),
          upcoming: await upcoming(tx, ids, 7),
          changes,
          recent: recent.slice(0, 12),
        };
      }),
    );
  });

  // What needs her now (spec 013), across her spaces: to fix, late, proposed, today, this week.
  api.get('/now', async (c) =>
    c.json(
      await as(c, (tx) =>
        attention(
          tx,
          c.get('spaces').map((one) => one.id),
        ),
      ),
    ),
  );

  // Her calendar (spec 011): everything dated in her spaces, for a window (this week by default).
  // Her Telegram (spec 015): a link to the bot with a code made for her; the watcher does the rest.
  api.post('/me/telegram', async (c) =>
    c.json(await telegramLink(deps.db, actorOf(c), process.env.JARVIS_TELEGRAM_BOT_TOKEN)),
  );

  // Her personal keys (spec 015): made, listed, revoked from her settings; a key is shown once.
  api.get('/me/keys', async (c) => c.json(await as(c, (tx) => keysOf(tx))));
  api.post('/me/keys', async (c) => {
    const body = (await c.req.json()) as { name?: string };
    return c.json(
      await as(c, (tx) => createKey(tx, c.get('person'), String(body.name ?? ''))),
      201,
    );
  });
  api.delete('/me/keys/:id', async (c) => {
    await as(c, (tx) => revokeKey(tx, c.req.param('id')));
    return c.json({ revoked: c.req.param('id') });
  });

  // Her time zone (spec 015): read and changed from her profile.
  api.get('/me/zone', async (c) => c.json({ zone: await as(c, (tx) => zoneOf(tx)) }));
  api.post('/me/zone', async (c) => {
    const body = (await c.req.json()) as { zone?: string };
    return c.json({
      zone: await as(c, (tx, actor) => setZone(tx, actor, String(body.zone ?? ''))),
    });
  });

  api.get('/agenda', async (c) => {
    const zone = await as(c, (tx) => zoneOf(tx));
    const from = new Date(c.req.query('from') ?? weekStart(new Date(), zone));
    const to = c.req.query('to')
      ? new Date(c.req.query('to')!)
      : new Date(from.getTime() + 7 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return c.json({ error: 'from and to are ISO times (« 2026-10-26T00:00:00+01:00 »).' }, 400);
    }
    const spaces = c.get('spaces');
    const occurrences = await as(c, (tx) =>
      agenda(
        tx,
        spaces.map((one) => one.id),
        { from, to },
      ),
    );
    const own = spaces.find((one) => one.personal);
    const linked = own
      ? await as(c, async (tx) =>
          (await find(tx, own.id, { kind: 'Channel', limit: 1 })).some(
            (one) => typeof one.data.agenda === 'string',
          ),
        )
      : false;
    return c.json({ from: from.toISOString(), to: to.toISOString(), occurrences, linked });
  });

  // A new private address for her phone's calendar; the previous one stops at once.
  api.post('/agenda/address', async (c) => {
    const own = c.get('spaces').find((one) => one.personal);
    if (!own) return c.json({ error: 'Her own space is not reachable here.' }, 403);
    const key = await as(c, (tx, actor) => renewCalendarKey(tx, actor, own.id));
    const base = deps.publicUrl.replace(/\/$/, '');
    return c.json({
      url: `${base}/agenda/${key}.ics`,
      webcal: `${base.replace(/^https?:/, 'webcal:')}/agenda/${key}.ics`,
    });
  });

  api.get('/documents/:id', async (c) => {
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const id = c.req.param('id');
    const read = await asPerson(deps.db, c.get('person'), (tx) =>
      readDocument(tx, space.id, { id, whole: true }),
    );
    const link = `${deps.publicUrl.replace(/\/$/, '')}/document/${documentToken(
      {
        person: c.get('person'),
        spaceId: space.id,
        id,
        until: Date.now() + DOCUMENT_HOURS * 3_600_000,
      },
      deps.secret,
    )}`;
    return c.json(documentShown(read, { space: space.name, spaceId: space.id, link }));
  });

  api.post('/dashboard', async (c) => {
    const input = z
      .object({
        id: z.string().min(1).optional(),
        widgets: z.array(widgetSchema).max(12).optional(),
      })
      .parse(await c.req.json());
    const spaces = c.get('spaces');
    let title = 'Dashboard';
    let widgets: Widget[] = input.widgets ?? [];
    if (input.id) {
      const saved = await act(c, (tx, _a, space) => get(tx, space, input.id!));
      if (!saved) return c.json({ error: `No entry ${input.id} in this space.` }, 404);
      title = saved.title;
      widgets = widgetsOf(saved.data);
    }
    return c.json(await computeDashboard(deps.db, c.get('person'), { title, widgets, spaces }));
  });

  // Her connections: the clients she allowed (Claude, ChatGPT…), the spaces each reaches; revoking.
  api.get('/connections', async (c) => {
    const { rows } = await deps.db.query<{
      clientId: string;
      name: string | null;
      since: string;
      used: string | null;
    }>(
      `select c."clientId", o.name, c."createdAt" as since,
              (select max(t."createdAt") from "oauthAccessToken" t
                where t."clientId" = c."clientId" and t."userId" = c."userId") as used
         from "oauthConsent" c left join "oauthClient" o on o."clientId" = c."clientId"
        where c."userId" = $1 order by c."createdAt" desc`,
      [c.get('person')],
    );
    const reach = await as(c, async (tx) => {
      const all: Record<string, string[]> = {};
      for (const row of rows)
        all[row.clientId] = (await clientSpaces(tx, row.clientId)).map((one) => one.id);
      return all;
    });
    return c.json(rows.map((row) => ({ ...row, spaces: reach[row.clientId] ?? [] })));
  });

  api.delete('/connections/:client', async (c) => {
    const client = c.req.param('client');
    const person = c.get('person');
    const { rowCount } = await deps.db.query(
      'delete from "oauthConsent" where "userId" = $1 and "clientId" = $2',
      [person, client],
    );
    if (!rowCount) return c.json({ error: `No connection ${client}.` }, 404);
    await deps.db.query(
      'update "oauthAccessToken" set revoked = now() where "userId" = $1 and "clientId" = $2 and revoked is null',
      [person, client],
    );
    await deps.db.query(
      'update "oauthRefreshToken" set revoked = now() where "userId" = $1 and "clientId" = $2 and revoked is null',
      [person, client],
    );
    await as(c, (tx) => allowSpaces(tx, client, []));
    return c.json({ revoked: client });
  });

  return api;
}
