import { withWho } from './who';
import { answerOf, appLines, appsOf, bridgesOf, proposeStructure } from '@jarvis-os/core';
import {
  comment,
  commentsOf,
  goalsOf,
  impactOf,
  keepReview,
  replan,
  mirrorOf,
  patternsOf,
  personCard,
  decide,
  OCCURRENCE_STATES,
  setOccurrence,
  toSortOf,
  timeOf,
} from '@jarvis-os/core';
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
  backupsOf,
  fileCapture,
  fileSure,
  inboxOf,
  type EntryInput,
  COMMON_KINDS,
  removeApp,
  mergeKind,
  mergeProposals,
  type MergeStep,
  contextReadings,
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
  type Embedder,
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
  habitBoard,
  collectionsOf,
  collectionStats,
  preferencesOf,
  morningBrief,
  setPreferences,
  changeEntries,
  groupKind,
  listEntries,
  listStats,
  renameKind,
  createShare,
  press,
  setRole,
  createKey,
  fingerprintOf,
  KEY_PREFIX,
  keyOwner,
  keysOf,
  revokeKey,
  recentMessages,
  type ViewData,
} from '@jarvis-os/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type pg from 'pg';
import { z } from 'zod';
import { shippedApp, shippedApps, shippedRoles } from './apps';
import { telegramLink } from './telegram';
import { briefText, channelOf, sendTelegram } from './watcher';
import type { Auth } from './auth';
import { codeOf, failure } from './errors';
import { captureAs } from './capture';
import { catalogFor } from './catalog';
import { searchByMeaning } from './embeddings';
import { connectorChange, connectorInput, type ConnectorService } from './connector-service';
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
  connectors: ConnectorService;
  embedder?: Embedder | null;
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

  // Her collections (spec 016): every kind with a model, and its statistics from its model.
  api.get('/collections', async (c) =>
    c.json(await act(c, (tx, _a, space) => collectionsOf(tx, space))),
  );
  api.get('/collections/:kind/stats', async (c) =>
    c.json(await act(c, (tx, _a, space) => collectionStats(tx, space, c.req.param('kind')))),
  );

  // Any list (spec 017): entries with their own day and folder, filtered and sorted; its statistics.
  const listOf = (c: Context) => {
    const q = c.req.query();
    return {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.text ? { text: q.text } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
      ...(q.folder ? { folder: q.folder } : {}),
      ...(q.sort ? { sort: q.sort as 'day' } : {}),
      ...(q.desc ? { desc: q.desc !== 'false' } : {}),
      ...(q.limit ? { limit: Number(q.limit) } : {}),
    };
  };
  api.get('/list', async (c) =>
    c.json(await act(c, (tx, _a, space) => listEntries(tx, space, listOf(c)))),
  );
  api.get('/list/stats', async (c) =>
    c.json(await act(c, (tx, _a, space) => listStats(tx, space, listOf(c)))),
  );
  // Many entries filed, retyped or set aside at once; a kind renamed; a kind in one of her groups.
  api.post('/entries/bulk', async (c) => {
    const body = await c.req.json();
    return c.json(await act(c, (tx, actor, space) => changeEntries(tx, actor, space, body)));
  });
  // The common types and the duplicates of her life (spec 032): proposed, tried, merged on her yes.
  const mergeInput = z.object({
    from: z.string().min(1).max(80),
    to: z.string().min(1).max(80),
    steps: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
    dryRun: z.boolean().default(true),
  });
  api.get('/kinds/merges', async (c) =>
    c.json(
      await act(c, async (tx, _a, space) =>
        mergeProposals(tx, space, (await preferencesOf(tx)).mergesDismissed ?? []),
      ),
    ),
  );
  api.post('/kinds/merge', async (c) => {
    const input = mergeInput.parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        mergeKind(tx, actor, space, {
          from: input.from,
          to: input.to,
          steps: (input.steps ?? []) as MergeStep[],
          dryRun: input.dryRun,
        }),
      ),
    );
  });
  api.post('/kinds/merges/dismiss', async (c) => {
    const { from, to } = mergeInput.pick({ from: true, to: true }).parse(await c.req.json());
    return c.json(
      await as(c, async (tx, actor) => {
        const now = (await preferencesOf(tx)).mergesDismissed ?? [];
        return setPreferences(tx, actor, {
          mergesDismissed: [...new Set([...now, `${from}→${to}`])],
        });
      }),
    );
  });
  api.post('/kinds/rename', async (c) => {
    const body = (await c.req.json()) as { from?: string; to?: string };
    return c.json(
      await act(c, (tx, actor, space) =>
        renameKind(tx, actor, space, { from: String(body.from ?? ''), to: String(body.to ?? '') }),
      ),
    );
  });
  api.post('/kinds/group', async (c) => {
    const body = (await c.req.json()) as { kind?: string; group?: string | null };
    return c.json(
      await act(c, (tx, actor, space) =>
        groupKind(tx, actor, space, {
          kind: String(body.kind ?? ''),
          group: typeof body.group === 'string' ? body.group : null,
        }),
      ),
    );
  });

  // A button pressed (spec 016): its action on its entry.
  api.post('/entries/:id/press', async (c) => {
    const body = (await c.req.json()) as { field?: string };
    return c.json(
      await act(c, (tx, actor, space) =>
        press(tx, actor, space, { entryId: c.req.param('id'), field: String(body.field ?? '') }),
      ),
    );
  });

  // Public links (spec 016): a form or a view she shares; the key is in the link, shown once.
  api.get('/shares', async (c) =>
    c.json(
      await act(c, async (tx, _a, space) =>
        (await find(tx, space, { kind: 'Share', limit: 200 }))
          .filter((one) => one.data.active !== false)
          .map((one) => ({
            id: one.id,
            title: one.title,
            mode: one.data.mode,
            kind: one.data.kind ?? null,
            view: one.data.view ?? null,
          })),
      ),
    ),
  );
  api.post('/shares', async (c) => {
    const body = (await c.req.json()) as { name?: string; data?: Record<string, unknown> };
    const made = await act(c, (tx, actor, space) =>
      createShare(tx, actor, space, {
        name: String(body.name ?? ''),
        data: (body.data ?? {}) as never,
      }),
    );
    return c.json({ id: made.id, link: `${deps.publicUrl.replace(/\/$/, '')}/p/${made.key}` }, 201);
  });

  // What a member may do in a shared space (spec 016): owner, member, or viewer (reads only).
  api.post('/spaces/:id/members/:person/role', async (c) => {
    const body = (await c.req.json()) as { role?: string };
    const role = z.enum(['owner', 'member', 'viewer']).parse(body.role);
    await as(c, (tx, actor) =>
      setRole(tx, actor, { spaceId: c.req.param('id'), person: c.req.param('person'), role }),
    );
    return c.json({ role });
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

  // Her apps in this space (I6, I7): each with its role, the line her assistants read, and the
  // bridges among them.
  api.get('/apps/mine', async (c) =>
    c.json(
      await act(c, async (tx, _a, space) => {
        const apps = await appsOf(tx, space, shippedRoles);
        const lines = appLines(apps, 'fr');
        return {
          apps: apps.map((one, at) => ({ ...one, line: lines[at] })),
          bridges: await bridgesOf(tx, space),
        };
      }),
    ),
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

  // Her inbox (spec 035): kept at once from the app, listed, filed one by one or all that is sure.
  api.post('/inbox', async (c) => {
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) => captureAs(tx, actor, space, { text, source: 'app' })),
      201,
    );
  });
  api.get('/inbox', async (c) => c.json(await act(c, (tx, _a, space) => inboxOf(tx, space))));
  api.post('/inbox/sure', async (c) =>
    c.json(await act(c, (tx, actor, space) => fileSure(tx, actor, space))),
  );
  api.post('/inbox/:id/file', async (c) => {
    const { entries } = z
      .object({ entries: z.array(z.record(z.string(), z.unknown())).min(1).max(20) })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        fileCapture(tx, actor, space, c.req.param('id'), entries as EntryInput[]),
      ),
    );
  });

  // Removing an app (spec 034): her data stays; and « not for me », remembered.
  api.post('/apps/remove', async (c) => {
    const body = (await c.req.json()) as { name?: string; dryRun?: boolean };
    return c.json(
      await act(c, (tx, actor, space) =>
        removeApp(tx, actor, space, String(body.name ?? ''), body.dryRun !== false, (kind) =>
          COMMON_KINDS.some((one) => one.kind === kind),
        ),
      ),
    );
  });
  api.post('/apps/decline', async (c) => {
    const body = (await c.req.json()) as { name?: string };
    const name = String(body.name ?? '').trim();
    if (!name) return c.json({ error: 'Give the app.' }, 400);
    return c.json(
      await as(c, async (tx, actor) => {
        const now = (await preferencesOf(tx)).appsDeclined ?? [];
        return setPreferences(tx, actor, { appsDeclined: [...new Set([...now, name])] });
      }),
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
    return c.json(
      await act(c, async (tx, actor, space) =>
        save(tx, actor, space, {
          ...body,
          ...(Array.isArray(body?.entries)
            ? { entries: await withWho(deps.db, tx, space, actor.person, body.entries) }
            : {}),
        }),
      ),
    );
  });

  // One occurrence of a repetition (spec 036): done, missed, postponed to a time, cancelled, or back.
  api.post('/entries/:id/occurrences/:day', async (c) => {
    const body = z
      .object({
        status: z.enum(OCCURRENCE_STATES).nullable().optional(),
        at: z.string().min(10).max(40).nullable().optional(),
      })
      .parse(await c.req.json());
    const change =
      body.status === null && !body.at
        ? null
        : { ...(body.status ? { status: body.status } : {}), ...(body.at ? { at: body.at } : {}) };
    return c.json(
      await act(c, (tx, actor, space) =>
        setOccurrence(tx, actor, space, c.req.param('id'), c.req.param('day'), change),
      ),
    );
  });

  // Notes on an entry (spec 039): hers, as she wrote them, the oldest first.
  api.get('/entries/:id/comments', async (c) =>
    c.json(await act(c, (tx, _a, space) => commentsOf(tx, space, c.req.param('id')))),
  );
  api.post('/entries/:id/comments', async (c) => {
    const body = z.object({ text: z.string().min(1).max(4000) }).parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) => comment(tx, actor, space, c.req.param('id'), body.text)),
    );
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

  // What Jarvis sent her (spec 020): the last days, on which channel, delivered or not.
  api.get('/outbox', async (c) => {
    const days = Math.min(30, Math.max(1, Number(c.req.query('days') ?? 7)));
    return c.json(await as(c, (tx) => recentMessages(tx, days)));
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

  // Her connectors (spec 025): the tools of other servers, reached through Jarvis. Never a secret
  // in an answer.
  api.get('/connectors', async (c) =>
    c.json(
      await deps.connectors.list(
        c.get('person'),
        c.get('spaces').map((one) => one.id),
      ),
    ),
  );
  api.post('/connectors', async (c) => {
    const input = connectorInput.parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    return c.json(await deps.connectors.add(actorOf(c), space.id, input), 201);
  });
  // « Discover »: the servers their makers host, ready to connect.
  api.get('/connectors/catalog', (c) => c.json(catalogFor()));
  // Her sign-in to a server that asks for it (spec 025, US4): its page, then back here.
  api.post('/connectors/:id/sign-in', async (c) =>
    c.json({ url: await deps.connectors.signIn(c.get('person'), c.req.param('id')) }),
  );
  api.get('/connectors/callback', async (c) => {
    const state = c.req.query('state') ?? '';
    const code = c.req.query('code');
    if (!code) return c.redirect('/app#/connexions');
    await deps.connectors.finishSignIn(c.get('person'), state, code);
    return c.redirect('/app#/connexions');
  });
  api.get('/connectors/:id/resources/read', async (c) =>
    c.json(
      await deps.connectors.read(c.get('person'), c.req.param('id'), c.req.query('uri') ?? ''),
    ),
  );
  api.post('/connectors/:id/check', async (c) =>
    c.json(await deps.connectors.check(c.get('person'), c.req.param('id'))),
  );
  api.patch('/connectors/:id', async (c) => {
    const input = connectorChange.parse(await c.req.json());
    return c.json(await deps.connectors.change(actorOf(c), c.req.param('id'), input));
  });
  api.delete('/connectors/:id', async (c) => {
    await deps.connectors.cut(actorOf(c), c.req.param('id'));
    return c.json({ cut: c.req.param('id') });
  });

  // Search by meaning (spec 028): her space's entries nearest to a question; none without a model.
  api.get('/search/meaning', async (c) => {
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const text = c.req.query('text') ?? '';
    const kind = c.req.query('kind');
    return c.json(
      await searchByMeaning(deps.db, deps.embedder ?? null, c.get('person'), space.id, text, {
        limit: Math.min(Math.max(Number(c.req.query('limit') ?? 10), 1), 50),
        ...(kind ? { kind } : {}),
      }),
    );
  });

  // Her space's nightly backups (spec 022): the list, and a link that opens one for ten minutes.
  api.get('/backups', async (c) => c.json(await act(c, (tx, _a, space) => backupsOf(tx, space))));
  api.get('/backups/:day/link', async (c) => {
    const day = c.req.param('day');
    const backup = (await act(c, (tx, _a, space) => backupsOf(tx, space))).find(
      (one) => one.day === day,
    );
    if (!backup) return c.json({ error: `No backup of ${day}.` }, 404);
    return c.json({ url: await deps.blobs.link(backup.storageKey, 600), seconds: 600 });
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

  // Her goals (spec 041), across her spaces, with their progress.
  api.get('/goals', async (c) =>
    c.json(
      await as(c, async (tx) =>
        (await Promise.all(c.get('spaces').map((one) => goalsOf(tx, one.id)))).flat(),
      ),
    ),
  );

  // What waits for her yes, in one place (spec 046).
  api.get('/to-sort', async (c) =>
    c.json(
      await as(c, (tx) =>
        toSortOf(
          tx,
          c.get('spaces').map((one) => one.id),
        ),
      ),
    ),
  );
  api.post('/to-sort/:id', async (c) => {
    const body = z.object({ yes: z.boolean() }).parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) => decide(tx, actor, space, c.req.param('id'), body.yes)),
    );
  });

  // A person's card across her apps (spec 045).
  api.get('/people/:id', async (c) =>
    c.json(await act(c, (tx, _a, space) => personCard(tx, space, c.req.param('id')))),
  );

  // What a period changes, and an absence replanned (spec 044).
  api.get('/impact', async (c) => {
    const from = timeOf(c.req.query('from') ?? '');
    const to = timeOf(c.req.query('to') ?? '');
    if (!from || !to || to <= from)
      return c.json({ error: 'from and to are ISO times, to after from.' }, 400);
    return c.json(
      await as(c, (tx) =>
        impactOf(
          tx,
          c.get('spaces').map((one) => one.id),
          { from, to },
        ),
      ),
    );
  });
  api.post('/replan', async (c) => {
    const body = z
      .object({
        from: z.string().min(10),
        to: z.string().min(10),
        dryRun: z.boolean().default(true),
      })
      .parse(await c.req.json());
    const from = timeOf(body.from.length === 10 ? `${body.from}T00:00` : body.from);
    const to = timeOf(body.to.length === 10 ? `${body.to}T00:00` : body.to);
    if (!from || !to || to <= from)
      return c.json({ error: 'from and to are ISO days, to after from.' }, 400);
    return c.json(
      await act(c, (tx, actor, space) => replan(tx, actor, space, { from, to }, body.dryRun)),
    );
  });

  // Her review (spec 043): the mirror of a period (the last seven days by default), and keeping it.
  api.get('/review', async (c) => {
    const to = c.req.query('to') ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const from =
      c.req.query('from') ?? new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const start = timeOf(`${from.slice(0, 10)}T00:00`);
    const end = timeOf(`${to.slice(0, 10)}T00:00`);
    if (!start || !end) return c.json({ error: 'from and to are ISO days (« 2026-11-03 »).' }, 400);
    return c.json(
      await as(c, (tx) =>
        mirrorOf(
          tx,
          c.get('spaces').map((one) => one.id),
          start,
          end,
        ),
      ),
    );
  });
  // The Routines page: her habits today, their streaks, the last days (her own day, in her zone).
  api.get('/habits/board', async (c) => {
    const span = Math.min(60, Math.max(7, Number(c.req.query('days') ?? 28) || 28));
    return c.json(
      await as(c, async (tx) => {
        const zone = await zoneOf(tx);
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        return habitBoard(
          tx,
          c.get('spaces').map((one) => one.id),
          today,
          span,
        );
      }),
    );
  });
  api.post('/review', async (c) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        from: z.string().min(10).max(10),
        to: z.string().min(10).max(10),
        answers: z
          .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
          .max(20),
        decisions: z
          .array(z.object({ text: z.string().min(1).max(300), due: z.string().max(30).optional() }))
          .max(20),
      })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        keepReview(tx, actor, space, {
          ...body,
          decisions: body.decisions.map((one) => ({
            text: one.text,
            ...(one.due ? { due: one.due } : {}),
          })),
        }),
      ),
    );
  });

  // A routine kept as text, proposed in its five parts (spec 047): for her yes, in « À ranger ».
  api.post('/routines/:id/structure', async (c) =>
    c.json(
      await act(c, (tx, actor, space) => proposeStructure(tx, actor, space, c.req.param('id'))),
    ),
  );

  // A search that answers (spec 049): a figure computed from her entries, with what justifies it.
  api.get('/answer', async (c) => {
    const q = (c.req.query('q') ?? '').slice(0, 300);
    if (!q.trim())
      return c.json({ error: 'Ask a question (« combien en transport en octobre ? »).' }, 400);
    return c.json(
      await as(c, (tx) =>
        answerOf(
          tx,
          c.get('spaces').map((one) => one.id),
          q,
        ),
      ),
    );
  });

  // What comes back (spec 042), across her spaces.
  api.get('/patterns', async (c) =>
    c.json(
      await as(c, (tx) =>
        patternsOf(
          tx,
          c.get('spaces').map((one) => one.id),
        ),
      ),
    ),
  );

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

  // Her morning brief (spec 018): read now, or sent now on her Telegram to try it.
  api.get('/me/brief', async (c) => {
    const brief = await as(c, (tx) => morningBrief(tx));
    return c.json({ brief, text: briefText(brief) });
  });
  api.post('/me/brief', async (c) => {
    const brief = await as(c, (tx) => morningBrief(tx));
    const token = process.env.JARVIS_TELEGRAM_BOT_TOKEN;
    const channel = await channelOf(deps.db, c.get('person'));
    const sent = Boolean(
      token && channel.telegram && (await sendTelegram(token, channel.telegram, briefText(brief))),
    );
    return c.json({ sent });
  });

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
  // Her preferences of display (spec 017), kept in her account.
  api.get('/me/prefs', async (c) => c.json(await as(c, (tx) => preferencesOf(tx))));
  api.post('/me/prefs', async (c) => {
    const body = await c.req.json();
    return c.json(await as(c, (tx, actor) => setPreferences(tx, actor, body)));
  });

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
    // When each assistant last read her context (spec 029).
    const readings = await as(c, (tx) => contextReadings(tx));
    return c.json(
      rows.map((row) => ({
        ...row,
        spaces: reach[row.clientId] ?? [],
        contextReadAt: readings[row.clientId] ?? null,
      })),
    );
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
