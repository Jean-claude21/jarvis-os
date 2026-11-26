import { withWho } from './who';
import { readAndUnderstand } from './reading';
import { logoFor } from './logo';
import { mediaFacts, thumbnailOf } from './media';
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
  amendProposal,
  phrasesOf,
  type Amendment,
  timeOf,
  installedReleases,
  proposeApp,
  updateApp,
  bundleSchema,
  agentsOf,
  agentsOfRules,
  nextRuns,
  PERIODS,
  planOfSchedule,
  runRuleNow,
  skillActions,
  skillOfTask,
  tasksFromText,
  tryRuleData,
  agentSettingsSchema,
  setAgent,
  remember,
  COMPONENTS,
  COMPONENT_CATEGORIES,
  LARGE_FILE_MAX_BYTES,
  addStoredFile,
  eraseFile,
  fileWithPrint,
  replaceFile,
  type FileVersion,
  answersOf,
  blockSchema,
  answersSchema,
  choicesOf,
  composeBlock,
  reshapeBlock,
  SETTABLE,
  fits,
  readerOf,
  facetsOf,
  type KindShape,
  createCollection,
  draftCollection,
  placeCollection,
  changeCollection,
  SIMPLE_TYPES,
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
  updateSpace,
  save,
  modelsOf,
  spacesOf,
  spacesOfPerson,
  undo,
  withdrawInvitation,
  type Actor,
  type Blobs,
  type Embedder,
  type Space,
  type Tx,
  withComputed,
  cardsOf,
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
  keyScope,
  receive,
  receiveSchema,
  activities,
  activitiesQuerySchema,
  closeExecution,
  closeSchema,
  countOnExecution,
  lentBy,
  keysOf,
  revokeKey,
  recentMessages,
  type ViewData,
} from '@jarvis-os/core';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { LiveEvent, LiveHub } from './live';
import { bodyLimit } from 'hono/body-limit';
import type pg from 'pg';
import { z } from 'zod';
import { shippedApp, shippedApps, shippedRoles } from './apps';
import { baseRoutines } from './mcp';
import { markdownHtml } from './views/markdown-html';
import { usedBy } from './atelier';
import { telegramLink } from './telegram';
import { briefText, channelOf, sendTelegram } from './watcher';
import type { Auth } from './auth';
import { codeOf, failure } from './errors';
import { captureAs } from './capture';
import { catalogFor, logoOf } from './catalog';
import { PROVIDERS, providerOf } from './relay';
import { searchByMeaning } from './embeddings';
import { connectorChange, connectorInput, type ConnectorService } from './connector-service';
import { invitationLink, namesOf, spaceFor } from './spaces';
import { langOf, wordsOf } from './i18n';
import { mailOf, sendQuietly, type Mailer } from './mail';
import { mailInvitation, mailJoined } from './space-mails';
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
    /** A program's key (spec 050): the kinds it may write. */
    keyKinds: string[] | undefined;
    /** A work token (spec 057): the one execution it answers for. */
    keyExecution: string | undefined;
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
  /** The whole server, for a batch of reads each answered as if asked alone. */
  self?: (request: Request) => Promise<Response> | Response;
  /** The journal, live (v3 D9). */
  live?: LiveHub;
  /** Who sends the mails of spaces: an invitation, someone who joined (v3 mails). */
  mailer?: Mailer | null;
}) {
  const api = new Hono<Env>();
  const keyUsed = new Map<string, number>();

  api.use('*', async (c, next) => {
    // A personal key (spec 015) acts as her, like her session.
    const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? '';
    const scope = bearer.startsWith(KEY_PREFIX) ? await keyScope(deps.db, bearer) : null;
    const byKey = scope?.person ?? null;
    if (bearer.startsWith(KEY_PREFIX) && !byKey)
      return c.json({ error: 'This key answers nothing.' }, 401);
    // A program's key (spec 050) stays within its space, and never makes keys or connections.
    const limited = Boolean(scope && (scope.spaceId || scope.kinds));
    const asked = c.req.query('space') ?? c.req.header('x-jarvis-space');
    if (scope?.spaceId && asked && asked !== scope.spaceId)
      return c.json({ error: 'This key reaches one space only.' }, 403);
    if (limited && /^\/api\/(me\/keys|connectors|spaces\/)/.test(c.req.path))
      return c.json({ error: 'This key may not manage keys, connections or spaces.' }, 403);
    // A work token (spec 057) answers for its execution only: what it sends, its close, a lent call.
    if (
      scope?.executionId &&
      !(
        c.req.path === '/api/receive' ||
        // A file it made (a PDF, spec 060), within the kinds of its token.
        (c.req.path === '/api/files' && c.req.method === 'POST') ||
        c.req.path.startsWith(`/api/executions/${scope.executionId}`)
      )
    )
      return c.json({ error: 'This work token answers for its execution only.' }, 403);
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
    if (byKey && Date.now() - (keyUsed.get(bearer) ?? 0) > 5 * 60_000) {
      keyUsed.set(bearer, Date.now());
      await asPerson(deps.db, person, (tx) =>
        tx.query('update personal_key set last_used_at = now() where fingerprint = $1', [
          fingerprintOf(bearer),
        ]),
      );
    }
    // Her spaces, read fresh in one trip (another door may have changed them).
    const all = await spacesOfPerson(deps.db, person);
    const spaces = scope?.spaceId ? all.filter((one) => one.id === scope.spaceId) : all;
    if (spaces.length === 0) return c.json({ error: 'This account has no space.' }, 500);
    c.set('person', person);
    c.set('email', session.user.email);
    c.set('name', session.user.name);
    c.set('spaces', spaces);
    // What a key writes is named after it in her journal.
    c.set('client', scope ? `key:${scope.name}` : (c.req.header('x-jarvis-client') ?? undefined));
    c.set('keyKinds', scope?.kinds ?? undefined);
    c.set('keyExecution', scope?.executionId ?? undefined);
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
    const kinds = c.get('keyKinds');
    return {
      person: c.get('person'),
      door: 'api',
      ...(client ? { client } : {}),
      ...(kinds ? { kinds } : {}),
    };
  };
  /** The work of a route, in the space it names (else her own). */
  /** Where she comes back after a sign-in: her connections, in the client she uses. */
  const connectionsPage = () =>
    process.env.JARVIS_HOME === '/v3' ? '/v3/reglages?t=connexions' : '/app#/connexions';
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

  // Its name, and (spec 081) its colour and its line.
  api.patch('/spaces/:id', async (c) => {
    const input = z
      .object({
        name: z.string().min(1).max(120).optional(),
        color: z.string().max(7).nullable().optional(),
        description: z.string().max(280).nullable().optional(),
      })
      .parse(await c.req.json());
    await as(c, (tx, actor) => updateSpace(tx, actor, { spaceId: c.req.param('id'), ...input }));
    return c.json({ renamed: c.req.param('id'), ...input });
  });

  api.post('/spaces/:id/invitations', async (c) => {
    const { email } = z.object({ email: z.string().min(3).max(320) }).parse(await c.req.json());
    const made = await as(c, (tx, actor) =>
      invite(tx, actor, { spaceId: c.req.param('id'), email }),
    );
    const link = invitationLink(deps.publicUrl, made.token);
    // The invitation by e-mail (v3 mails); the link is also given back, to be passed by hand.
    const space = (await as(c, (tx) => spacesOf(tx))).find((one) => one.id === c.req.param('id'));
    const mailed = await mailInvitation(
      { db: deps.db, mailer: deps.mailer ?? null, publicUrl: deps.publicUrl },
      {
        lang: langOf(c.req.header('accept-language')),
        person: c.get('person'),
        space: space?.name ?? '',
        email: email.trim().toLowerCase(),
        link,
        expiresAt: made.expiresAt,
      },
    );
    return c.json(
      {
        invitationId: made.invitationId,
        link,
        expiresAt: made.expiresAt,
        mailed,
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
    const joined = await as(c, (tx, actor) =>
      acceptInvitation(tx, actor, { token, email: c.get('email') }),
    );
    // Its owners learn who joined (v3 mails).
    const owners = (await as(c, (tx) => membersOf(tx, joined.id)))
      .filter((one) => one.role === 'owner')
      .map((one) => one.person);
    await mailJoined(
      { db: deps.db, mailer: deps.mailer ?? null, publicUrl: deps.publicUrl },
      {
        lang: langOf(c.req.header('accept-language')),
        person: c.get('person'),
        email: c.get('email'),
        space: joined.name,
        owners,
      },
    );
    return c.json(joined);
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
  // Every pair she was offered, merged in one gesture: each in turn, journaled as its own merge (so
  // each can be undone); one that cannot be done is left offered, with why.
  api.post('/kinds/merges/all', async (c) =>
    c.json(
      await act(c, async (tx, actor, space) => {
        const proposals = await mergeProposals(
          tx,
          space,
          (await preferencesOf(tx)).mergesDismissed ?? [],
        );
        const merged: string[] = [];
        const failed: { pair: string; why: string }[] = [];
        for (const one of proposals) {
          await tx.query('savepoint jarvis_merge');
          try {
            await mergeKind(tx, actor, space, {
              from: one.from,
              to: one.to,
              steps: (one.steps ?? []) as MergeStep[],
              dryRun: false,
            });
            await tx.query('release savepoint jarvis_merge');
            merged.push(`${one.from}→${one.to}`);
          } catch (error) {
            await tx.query('rollback to savepoint jarvis_merge');
            failed.push({ pair: `${one.from}→${one.to}`, why: (error as Error).message });
          }
        }
        return { merged, failed };
      }),
    ),
  );
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
  // A kind's name as she reads it (v3): its model's label; a kind without a model is renamed.
  api.post('/kinds/label', async (c) => {
    const body = z
      .object({ kind: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(80) })
      .parse(await c.req.json());
    return c.json(
      await act(c, async (tx, actor, space) => {
        const fold = (text: string) =>
          text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
        const model = (await modelsOf(tx, space)).find((one) => fold(one.kind) === fold(body.kind));
        if (!model) return renameKind(tx, actor, space, { from: body.kind, to: body.label });
        await save(tx, actor, space, {
          entries: [{ id: model.id, data: { label: { ...(model.label ?? {}), fr: body.label } } }],
        });
        return { kind: model.kind, label: body.label };
      }),
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
    const body = z
      .object({
        role: z.enum(['owner', 'member', 'viewer']),
        kinds: z.array(z.string().min(1).max(80)).max(100).nullable().optional(),
      })
      .parse(await c.req.json());
    await as(c, (tx, actor) =>
      setRole(tx, actor, {
        spaceId: c.req.param('id'),
        person: c.req.param('person'),
        role: body.role,
        ...(body.kinds !== undefined ? { kinds: body.kinds } : {}),
      }),
    );
    return c.json({ role: body.role, kinds: body.kinds ?? null });
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
  // The catalogue (v3 D14): each app Jarvis ships, what it brings, whether it is installed here
  // and whether a newer release waits.
  api.get('/apps/catalog', async (c) =>
    c.json(
      await act(c, async (tx, _a, space) => {
        const installed = await installedReleases(tx, space);
        return shippedApps.map((one) => {
          const bundle = bundleSchema.parse(one);
          const at = Object.keys(installed).find(
            (name) => name.toLowerCase() === bundle.app.toLowerCase(),
          );
          return {
            app: bundle.app,
            description: bundle.description ?? '',
            release: bundle.release,
            kinds: bundle.models.map((model) => model.title),
            // Each kind in her words, so the catalogue never shows « Goal » (v3 D2).
            labels: Object.fromEntries(
              [
                ...bundle.models,
                ...bundle.pages.map((page) => ({ ...page, title: `page:${page.title}` })),
              ].map((piece) => {
                const label = (piece.data as { label?: { fr?: string; en?: string } }).label;
                return [piece.title, label?.fr ?? label?.en ?? piece.title.replace(/^page:/, '')];
              }),
            ),
            installed: at === undefined ? null : installed[at],
          };
        });
      }),
    ),
  );
  // An app designed for her (by an assistant, an agent): tried, then waiting in « À valider ».
  api.post('/apps/propose', async (c) => {
    const body = (await c.req.json()) as { bundle?: unknown; why?: string };
    const bundle = bundleSchema.parse(body.bundle);
    return c.json(
      await act(c, (tx, actor, space) =>
        proposeApp(tx, actor, space, bundle, typeof body.why === 'string' ? body.why : undefined),
      ),
      201,
    );
  });
  api.post('/apps/update', async (c) => {
    const body = (await c.req.json()) as { name?: string; dryRun?: boolean };
    const bundle = shippedApp(String(body.name ?? ''));
    return c.json(
      await act(c, (tx, actor, space) =>
        updateApp(tx, actor, space, bundle, body.dryRun !== false),
      ),
    );
  });

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

  // « Suivre quelque chose » (v3): her phrase as a first draft of a collection, the apps it can
  // live in and the collections a link can point to; then the collection made, or moved.
  api.post('/collections/draft', async (c) => {
    const { phrase } = z
      .object({ phrase: z.string().trim().min(2).max(200) })
      .parse(await c.req.json());
    const draft = draftCollection(phrase);
    const known = await act(c, async (tx, _a, space) => ({
      apps: (await appsOf(tx, space, shippedRoles)).map((one) => one.app),
      collections: (await readerOf(tx, space))
        .allModels()
        .map((one) => ({ kind: one.kind, label: one.label?.fr ?? one.kind })),
    }));
    return c.json({ draft, types: SIMPLE_TYPES, ...known });
  });
  const draftField = z.object({
    name: z.string().trim().max(60).default(''),
    label: z.string().trim().min(1).max(60),
    type: z.enum(SIMPLE_TYPES),
    options: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    target: z.string().trim().min(1).max(80).optional(),
  });
  api.post('/collections', async (c) => {
    const body = z
      .object({
        kind: z.string().trim().min(1).max(80),
        label: z.string().trim().max(80).default(''),
        app: z.string().trim().min(1).max(60),
        fields: z.array(draftField).min(1).max(60),
      })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) => createCollection(tx, actor, space, body)),
      201,
    );
  });
  api.put('/collections/:kind/app', async (c) => {
    const { app } = z.object({ app: z.string().trim().min(1).max(60) }).parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        placeCollection(tx, actor, space, decodeURIComponent(c.req.param('kind')), app),
      ),
    );
  });

  // A collection's fields changed on screen (v3 D4): what stays keeps its values.
  api.put('/collections/:kind/fields', async (c) => {
    const { fields } = z
      .object({ fields: z.array(draftField).min(1).max(40) })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        changeCollection(tx, actor, space, decodeURIComponent(c.req.param('kind')), {
          fields,
        }),
      ),
    );
  });

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
  // Where a page stands (spec 107): an app's, Aujourd'hui's band (`today=1`), a kind's fiche (`for`).
  api.get('/pages', async (c) => {
    const [app, kind] = [c.req.query('app'), c.req.query('for')];
    const place = {
      ...(app ? { app } : {}),
      ...(c.req.query('today') ? { today: true } : {}),
      ...(kind ? { for: kind } : {}),
    };
    return c.json(await act(c, (tx, _a, space) => pagesOf(tx, space, place)));
  });
  // Her cards (spec 107): what « Ajouter une carte » and the catalogue offer — this app's first,
  // or a fiche's (`kind`).
  api.get('/cards', async (c) => {
    const [app, kind] = [c.req.query('app'), c.req.query('kind')];
    const place = { ...(app ? { app } : {}), ...(kind ? { kind } : {}) };
    return c.json(await act(c, (tx, _a, space) => cardsOf(tx, space, place)));
  });

  // The components (v3 D21): the registry the catalogue, the pages and the assistants read.
  api.get('/components', (c) =>
    c.json({ categories: COMPONENT_CATEGORIES, components: COMPONENTS }),
  );
  // A page tried, not kept: its blocks computed on her data (the catalogue's « Essayer »).
  api.post('/pages/try', async (c) => {
    const data = (await c.req.json()) as Record<string, unknown>;
    // A fiche's page tried for the entry it shows (spec 107).
    const record = c.req.query('record');
    return c.json(
      await act(c, (tx, _a, space) =>
        renderPage(tx, space, { id: 'try', title: 'Essai', data }, record ? { record } : {}),
      ),
    );
  });

  // Composing a page on screen (v3 F4): the blocks she can add here (the registry's, with what each
  // asks), the kinds they fit, the formats to start from; then one block from her answers.
  const shapesOf = async (tx: Tx, space: string, app?: string) => {
    const reader = await readerOf(tx, space);
    const models = reader.allModels();
    const all = new Map(models.map((one) => [one.kind.toLowerCase(), one]));
    return models
      .filter((one) => !app || one.app === app)
      .filter(
        (one) =>
          !['page', 'view', 'app', 'rule', 'script', 'agent'].includes(one.kind.toLowerCase()),
      )
      .map((one): KindShape => {
        const parent = one.extends ? (all.get(one.extends.toLowerCase()) ?? null) : null;
        return {
          kind: one.kind,
          fields: [...(parent?.fields ?? []), ...one.fields].map((field) => ({
            name: field.name,
            type: field.type,
            ...(field.options ? { options: field.options } : {}),
            ...('target' in field && field.target ? { target: field.target } : {}),
          })),
          facets: facetsOf(one, parent),
        };
      });
  };
  api.get('/pages/composable', async (c) => {
    const app = c.req.query('app') || undefined;
    const shapes = await act(c, (tx, _a, space) => shapesOf(tx, space, app));
    return c.json({
      categories: COMPONENT_CATEGORIES,
      components: COMPONENTS.filter((one) => one.block && one.asks).map((one) => ({
        ...one,
        kinds: one.asks!.includes('kind')
          ? shapes.filter((shape) => fits(one.id, shape)).map((shape) => shape.kind)
          : [],
      })),
      kinds: shapes.map((shape) => ({ kind: shape.kind, ...choicesOf(shape) })),
      labels: Object.fromEntries(
        COMPONENTS.filter((one) => one.block).map((one) => [one.id, one.label.fr]),
      ),
    });
  });
  api.post('/pages/compose', async (c) => {
    const answers = answersSchema.parse(await c.req.json());
    const block = await act(c, async (tx, _a, space) => {
      const shapes = answers.kind ? await shapesOf(tx, space) : [];
      const shape = answers.kind
        ? (shapes.find((one) => one.kind.toLowerCase() === answers.kind!.toLowerCase()) ?? null)
        : null;
      if (answers.kind && !shape) throw new Error(`No kind « ${answers.kind} » here.`);
      return composeBlock(answers, shape);
    });
    return c.json({ block });
  });
  // A card set on screen (spec 107): its settings read back as her answers (null: only its name and
  // size change there), then the card set anew from the answers she changed.
  const shapeOfBlock = async (tx: Tx, space: string, kind: unknown) =>
    typeof kind === 'string'
      ? ((await shapesOf(tx, space)).find((one) => one.kind.toLowerCase() === kind.toLowerCase()) ??
        null)
      : null;
  const kindOfBlock = (block: Record<string, unknown>) =>
    block.kind ?? (block.query as { kind?: unknown } | undefined)?.kind;
  api.post('/cards/answers', async (c) => {
    const block = blockSchema.parse(((await c.req.json()) as { block?: unknown }).block);
    const answers = await act(c, async (tx, _a, space) =>
      answersOf(block, await shapeOfBlock(tx, space, kindOfBlock(block))),
    );
    return c.json({ answers, settable: SETTABLE.has(block.block) });
  });
  api.post('/cards/reshape', async (c) => {
    const body = (await c.req.json()) as { block?: unknown; answers?: unknown };
    const block = blockSchema.parse(body.block);
    const answers = answersSchema.parse(body.answers);
    const set = await act(c, async (tx, _a, space) =>
      reshapeBlock(block, answers, await shapeOfBlock(tx, space, answers.kind)),
    );
    return c.json({ block: set });
  });
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

  // What an agent sends (spec 050): a list written as her entries of one kind — her model's other
  // names for its fields understood, the entry already there (same `match`) updated, not doubled.
  api.post('/receive', async (c) => {
    const raw = (await c.req.json()) as Record<string, unknown>;
    const body = receiveSchema.parse(raw);
    // Sent for an execution (spec 057): counted on it, each entry linked to it. A work token
    // sends for its own execution only.
    const own = c.get('keyExecution');
    const given = typeof raw.execution === 'string' ? raw.execution : undefined;
    if (own && given && given !== own)
      return c.json({ error: 'This work token answers for its execution only.' }, 403);
    const execution = given ?? own;
    return c.json(
      await act(c, async (tx, actor, space) => {
        const got = await receive(tx, actor, space, body);
        if (execution) await countOnExecution(tx, actor, space, execution, got);
        return got;
      }),
    );
  });

  // What Jarvis can do for her through its Atelier (spec 060), each with the apps that use it.
  api.get('/capabilities', async (c) => {
    const service = deps.connectors.atelier;
    if (!service) return c.json({ capabilities: [] });
    const by = usedBy(Object.entries(shippedRoles).map(([app, role]) => ({ app, role })));
    const list = await service.capabilities();
    return c.json({
      capabilities: list.map((one) => ({
        name: one.name,
        title: one.title,
        does: one.does,
        examples: one.examples,
        effect: one.effect,
        long: one.long,
        ready: one.ready,
        apps: by[one.name] ?? [],
      })),
    });
  });

  // Her activities (spec 057): everything to do across her spaces, what needs her first.
  api.get('/activities', async (c) => {
    const query = activitiesQuerySchema.parse(c.req.query());
    const named = c.req.query('space') ?? c.req.header('x-jarvis-space');
    const spaces = named ? [spaceFor(c.get('spaces'), named)] : c.get('spaces');
    return c.json(
      await as(c, (tx) =>
        activities(
          tx,
          spaces.map((one) => one.id),
          query,
        ),
      ),
    );
  });

  // An execution closed by the service that did the work (spec 057), with its work token — or by
  // her, from « Tâches ».
  api.post('/executions/:id', async (c) => {
    const id = c.req.param('id');
    const own = c.get('keyExecution');
    if (own && own !== id)
      return c.json({ error: 'This work token answers for its execution only.' }, 403);
    const body = closeSchema.parse(await c.req.json());
    await act(c, (tx, actor, space) => closeExecution(tx, actor, space, id, body));
    return c.json({ ok: true });
  });

  // A connection she lent for the work (spec 057, US6): called by Jarvis, its secret never sent.
  api.post('/executions/:id/call', async (c) => {
    const id = c.req.param('id');
    const own = c.get('keyExecution');
    if (!own || own !== id)
      return c.json(
        { error: 'A lent connection is called with the work token of its execution.' },
        403,
      );
    const input = z
      .object({
        connection: z.string().trim().min(1).max(80),
        tool: z.string().trim().min(1).max(120).optional(),
        path: z.string().trim().max(300).optional(),
        args: z.record(z.string(), z.unknown()).optional(),
      })
      .refine((one) => Boolean(one.tool) !== Boolean(one.path), 'A tool or a path.')
      .parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const lent = await asPerson(deps.db, c.get('person'), (tx) => lentBy(tx, space.id, id));
    if (!lent.some((one) => one.toLowerCase() === input.connection.toLowerCase()))
      return c.json({ error: `« ${input.connection} » is not lent for this work.` }, 403);
    const answer = await deps.connectors.callOut({
      person: c.get('person'),
      spaceId: space.id,
      connection: input.connection,
      ...(input.tool ? { tool: input.tool } : {}),
      ...(input.path !== undefined ? { path: input.path } : {}),
      body: input.args ?? {},
    });
    return c.json({ answer });
  });

  // Reads asked at the same moment, in one request (spec 048, speed): each read goes through the
  // whole server as if asked alone — her session, her spaces, a key's limits — and its answer comes
  // back in order. Reads only.
  api.post('/batch', async (c) => {
    const { paths } = z
      .object({
        paths: z
          .array(
            z
              .string()
              .max(2000)
              .regex(/^\/[a-z]/, 'A path of the API (« /kinds »).')
              .refine((one) => !one.includes('..') && !one.startsWith('/batch'), 'Not this path.'),
          )
          .min(1)
          .max(12),
      })
      .parse(await c.req.json());
    if (!deps.self) return c.json({ error: 'No batch here.' }, 400);
    const headers = new Headers(c.req.raw.headers);
    headers.delete('content-type');
    headers.delete('content-length');
    const answers = await Promise.all(
      paths.map(async (path) => {
        const response = await deps.self!(
          new Request(new URL(`/api${path}`, c.req.url), { method: 'GET', headers }),
        );
        const type = response.headers.get('content-type') ?? '';
        return {
          status: response.status,
          body: type.includes('json') ? await response.json() : null,
        };
      }),
    );
    return c.json(answers);
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

  // The journal, live (v3 D9): Server-Sent Events of the changes in the spaces she reaches (or the
  // one asked). Ids and the command only; the screen reads the rest as usual.
  api.get('/live', (c) => {
    const hub = deps.live;
    if (!hub) return c.json({ error: 'No live journal on this server.' }, 503);
    const asked = c.req.query('space');
    const spaces = c
      .get('spaces')
      .filter((one) => !asked || one.id === asked)
      .map((one) => one.id);
    return streamSSE(c, async (stream) => {
      const queue: LiveEvent[] = [];
      let wake: (() => void) | null = null;
      const stop = hub.subscribe(spaces, (event) => {
        queue.push(event);
        wake?.();
      });
      stream.onAbort(() => {
        stop();
        wake?.();
      });
      await stream.writeSSE({ event: 'ready', data: JSON.stringify({ spaces }) });
      while (!stream.aborted) {
        if (!queue.length)
          await new Promise<void>((resolve) => {
            wake = resolve;
            setTimeout(resolve, 25_000);
          });
        wake = null;
        if (stream.aborted) break;
        if (!queue.length) {
          await stream.writeSSE({ event: 'ping', data: '' });
          continue;
        }
        for (const event of queue.splice(0))
          await stream.writeSSE({
            event: 'change',
            id: String(event.id),
            data: JSON.stringify(event),
          });
      }
      stop();
    });
  });

  api.get('/history', async (c) => {
    const target = c.req.query('target');
    const limit = Number(c.req.query('limit') ?? 50);
    // Only the changes of entries of these kinds (an app's activity, spec 084).
    const kinds = (c.req.query('kinds') ?? '')
      .split(',')
      .map((one) => one.trim())
      .filter(Boolean)
      .slice(0, 40);
    // Who, which actions, since when (v3 D9).
    const author = z
      .enum(['me', 'assistant', 'auto', 'telegram'])
      .optional()
      .parse(c.req.query('author') || undefined);
    const commands = (c.req.query('commands') ?? '')
      .split(',')
      .map((one) => one.trim())
      .filter((one) => /^[a-z.]+$/.test(one))
      .slice(0, 20);
    const since = c.req.query('since');
    const sinceAt =
      since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : null;
    return c.json(
      await act(c, (tx, _a, space) =>
        history(tx, space, {
          ...(target ? { target } : {}),
          ...(kinds.length ? { kinds } : {}),
          ...(author ? { author } : {}),
          ...(commands.length ? { commands } : {}),
          ...(sinceAt ? { since: sinceAt } : {}),
          ...(c.req.query('client') ? { client: c.req.query('client')!.slice(0, 120) } : {}),
          limit,
        }),
      ),
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
      const mediaType = file.type || 'application/octet-stream';
      // A photo says when and where it was taken, and its size (v3 médias).
      const facts = await mediaFacts(bytes, mediaType);
      const stored = await act(c, (tx, actor, space) =>
        addFile(tx, actor, deps.blobs, {
          spaceId: space,
          name: file.name,
          mediaType,
          bytes,
          ...(title ? { title } : {}),
          data: { ...facts, ...(data ?? {}) },
          links,
        }),
      );
      // Read and understood right away (v3 V7), out of the request: its answer does not wait.
      const space = spaceFor(
        c.get('spaces'),
        c.req.query('space') ?? c.req.header('x-jarvis-space'),
      );
      void readAndUnderstand(deps.db, deps.blobs, c.get('person'), space.id, stored.entryId).catch(
        (error) => console.warn('[reading]', (error as Error).message),
      );
      return c.json(stored, 201);
    },
  );

  // Her agents (v3 D12): who works for her, how, within what — and their Pause.
  api.get('/agents', async (c) => c.json(await act(c, (tx, _a, spaceId) => agentsOf(tx, spaceId))));
  api.patch('/agents/:title', async (c) => {
    const patch = agentSettingsSchema
      .pick({
        paused: true,
        autonomy: true,
        budget: true,
        role: true,
        report: true,
        instructions: true,
      })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, spaceId) =>
        setAgent(tx, actor, spaceId, c.req.param('title'), patch),
      ),
    );
  });

  // An agent's memory (v3 F6): a note it keeps, written by her or by the agent.
  api.post('/agents/:title/memory', async (c) => {
    const { text } = z
      .object({ text: z.string().trim().min(1).max(4000) })
      .parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, spaceId) =>
        remember(tx, actor, spaceId, c.req.param('title'), text),
      ),
      201,
    );
  });

  // An agent's tasks (spec 109): each with its agent, its « when », its next times, the skill it
  // follows; tried before it is kept; run now; drawn from her text. A task is kept as a rule.
  api.get('/tasks', async (c) =>
    c.json(
      await act(c, async (tx, _a, spaceId) => {
        const owners = await agentsOfRules(tx, spaceId);
        const zone = await zoneOf(tx);
        const now = new Date();
        return (await find(tx, spaceId, { kind: 'Rule', limit: 200 })).map((rule) => {
          const data = rule.data as Record<string, unknown> & {
            when?: { schedule?: string };
            then?: unknown[];
          };
          const schedule = data.when?.schedule;
          let next: string[] = [];
          try {
            next = schedule && data.active !== false ? nextRuns(schedule, now, zone) : [];
          } catch {
            next = [];
          }
          return {
            id: rule.id,
            title: rule.title,
            agent: owners.get(rule.id)?.title ?? null,
            assigned: owners.get(rule.id)?.assigned ?? false,
            when: data.when ?? null,
            then: data.then ?? [],
            active: data.active !== false,
            app: data.app ?? null,
            error: data.error ?? null,
            skill: skillOfTask((data.then ?? []) as Parameters<typeof skillOfTask>[0]),
            plan: schedule ? planOfSchedule(schedule) : null,
            next,
          };
        });
      }),
    ),
  );
  // What a skill's task does on its time: its bilan prepared over its period, and a reminder.
  api.post('/tasks/skill', async (c) => {
    const { skill, period } = z
      .object({ skill: z.string().trim().min(1).max(120), period: z.enum(PERIODS).default('week') })
      .parse(await c.req.json());
    const then = await act(c, async (tx, _a, spaceId) => {
      const [found] = (await find(tx, spaceId, { kind: 'Routine', limit: 200 })).filter(
        (one) => one.title.toLowerCase() === skill.toLowerCase(),
      );
      const result = (found?.data as { result?: { kind?: string } } | undefined)?.result;
      return skillActions({ name: found?.title ?? skill, result }, period);
    });
    return c.json({ then });
  });
  // « Essai à blanc »: a task, kept or not, tried — what it would change; nothing is written.
  api.post('/tasks/try', async (c) => {
    const { data } = z
      .object({ data: z.record(z.string(), z.unknown()) })
      .parse(await c.req.json());
    const tried = await act(c, async (tx, actor, spaceId) => {
      const zone = await zoneOf(tx);
      const schedule = (data.when as { schedule?: unknown } | undefined)?.schedule;
      return {
        ...(await tryRuleData(tx, actor, spaceId, data)),
        next: typeof schedule === 'string' ? nextRuns(schedule, new Date(), zone) : [],
      };
    });
    return c.json(tried);
  });
  // « Lancer maintenant »: as on its time, under its agent (its Pause and budget apply).
  api.post('/tasks/:id/run', async (c) => {
    const ran = await act(c, (tx, actor, spaceId) =>
      runRuleNow(tx, actor, spaceId, c.req.param('id')),
    );
    return c.json({ ran });
  });
  // Her text read as task lines and instructions (no AI: what it cannot read stays text).
  api.post('/tasks/from-text', async (c) => {
    const { text } = z
      .object({ text: z.string().trim().min(1).max(8000) })
      .parse(await c.req.json());
    const read = await act(c, async (tx, _a, spaceId) =>
      tasksFromText(
        text,
        (await find(tx, spaceId, { kind: 'Routine', limit: 200 })).map((one) => one.title),
      ),
    );
    return c.json(read);
  });
  // A new agent: its name and its role; its tasks come next.
  api.post('/agents', async (c) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(80),
        role: z.string().trim().max(400).optional(),
      })
      .parse(await c.req.json());
    const made = await act(c, async (tx, actor, spaceId) => {
      const taken = (await agentsOf(tx, spaceId)).some(
        (one) => one.title.toLowerCase() === body.title.toLowerCase(),
      );
      if (taken) throw new Error(`An agent « ${body.title} » is already here.`);
      const saved = await save(tx, actor, spaceId, {
        entries: [
          {
            kind: 'Agent',
            title: body.title,
            data: {
              executor: 'rule',
              autonomy: 'act_and_report',
              ...(body.role ? { role: body.role } : {}),
            },
          },
        ],
      });
      return { id: saved.entries[0]!.id, title: body.title };
    });
    return c.json(made, 201);
  });

  // A skill in the Agent Skills format (SKILL.md: a name, a description, the instructions): what
  // is written in Jarvis works in Claude too.
  api.get('/skills/:name/SKILL.md', async (c) => {
    const wanted = c.req.param('name').toLowerCase();
    const slug = (name: string) =>
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64);
    const base = baseRoutines.find((one) => slug(one.name) === slug(wanted));
    if (!base) return c.json({ error: `No skill « ${c.req.param('name')} ».` }, 404);
    const description = (base.when || base.name).replace(/\s+/g, ' ').slice(0, 1000);
    const text = `---
name: ${slug(base.name)}
description: ${JSON.stringify(`À suivre quand ${description}`)}
---

${base.text}
`;
    return c.body(text, 200, {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `${c.req.query('download') ? 'attachment' : 'inline'}; filename="SKILL.md"`,
    });
  });

  // A large file sent in parts (v3 médias): started here, each part straight to storage, then put
  // together and kept like any file. The key is hers: under her space, made here.
  const uploadKey = (space: string, key: string) =>
    key.startsWith(`${deps.blobs.prefix ?? ''}${space}/up-`) && !key.includes('..');
  api.post('/files/uploads', async (c) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(200),
        type: z.string().trim().min(1).max(200),
        size: z.number().int().min(1).max(LARGE_FILE_MAX_BYTES),
        empreinte: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        links: linksSchema.optional(),
      })
      .parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    // The same bytes she already keeps: nothing to send, the file she has is joined.
    if (body.empreinte) {
      const same = await act(c, async (tx, actor, spaceId) => {
        const id = await fileWithPrint(tx, spaceId, body.empreinte!);
        if (id && body.links?.length)
          await save(tx, actor, spaceId, {
            links: body.links.map((link) => ({ ...link, from: id })),
          });
        return id;
      });
      if (same) return c.json({ duplicate: same });
    }
    if (!deps.blobs.startUpload)
      return c.json({ error: 'This storage takes no large files.' }, 400);
    const key = `${deps.blobs.prefix ?? ''}${space.id}/up-${crypto.randomUUID()}`;
    const uploadId = await deps.blobs.startUpload(key, body.type);
    return c.json({ key, uploadId, partSize: 8 * 1024 * 1024 }, 201);
  });
  api.put(
    '/files/uploads/part',
    bodyLimit({
      maxSize: 9 * 1024 * 1024,
      onError: (c) => c.json({ error: 'A part is 8 MB at most.' }, 400),
    }),
    async (c) => {
      const key = c.req.query('key') ?? '';
      const uploadId = c.req.query('uploadId') ?? '';
      const n = Number(c.req.query('n'));
      const space = spaceFor(
        c.get('spaces'),
        c.req.query('space') ?? c.req.header('x-jarvis-space'),
      );
      if (!uploadKey(space.id, key) || !uploadId || !Number.isInteger(n) || n < 1 || n > 10_000)
        return c.json({ error: 'Not an upload of this space.' }, 400);
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      const etag = await deps.blobs.uploadPart!(key, uploadId, n, bytes);
      return c.json({ n, etag });
    },
  );
  api.post('/files/uploads/complete', async (c) => {
    const body = z
      .object({
        key: z.string().min(1).max(300),
        uploadId: z.string().min(1).max(1000),
        parts: z.array(z.object({ n: z.number().int().min(1), etag: z.string().min(1) })).min(1),
        name: z.string().trim().min(1).max(200),
        type: z.string().trim().min(1).max(200),
        size: z.number().int().min(1).max(LARGE_FILE_MAX_BYTES),
        empreinte: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        links: linksSchema.optional(),
        /** The file these bytes replace (a new version), instead of a new file. */
        replace: z.string().min(1).max(64).optional(),
      })
      .parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    if (!uploadKey(space.id, body.key))
      return c.json({ error: 'Not an upload of this space.' }, 400);
    await deps.blobs.finishUpload!(body.key, body.uploadId, body.parts);
    const stored = await act(c, (tx, actor, spaceId) =>
      body.replace
        ? replaceFile(tx, actor, deps.blobs, spaceId, body.replace, {
            name: body.name,
            mediaType: body.type,
            storageKey: body.key,
            size: body.size,
          })
        : addStoredFile(tx, actor, {
            spaceId,
            storageKey: body.key,
            name: body.name,
            mediaType: body.type,
            size: body.size,
            ...(body.empreinte ? { empreinte: body.empreinte } : {}),
            links: body.links ?? [],
          }),
    );
    void readAndUnderstand(deps.db, deps.blobs, c.get('person'), space.id, stored.entryId).catch(
      (error) => console.warn('[reading]', (error as Error).message),
    );
    return c.json(stored, 201);
  });
  api.post('/files/uploads/abort', async (c) => {
    const body = z
      .object({ key: z.string().min(1).max(300), uploadId: z.string().min(1).max(1000) })
      .parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    if (!uploadKey(space.id, body.key))
      return c.json({ error: 'Not an upload of this space.' }, 400);
    await deps.blobs.abortUpload?.(body.key, body.uploadId).catch(() => undefined);
    return c.json({ aborted: true });
  });

  // A file replaced by a new version (v3 médias): the old bytes are kept as a version.
  api.post(
    '/files/:id/replace',
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      const space = spaceFor(
        c.get('spaces'),
        c.req.query('space') ?? c.req.header('x-jarvis-space'),
      );
      const stored = await act(c, (tx, actor, spaceId) =>
        replaceFile(tx, actor, deps.blobs, spaceId, c.req.param('id'), {
          name: file.name,
          mediaType: file.type || 'application/octet-stream',
          bytes,
        }),
      );
      void readAndUnderstand(deps.db, deps.blobs, c.get('person'), space.id, stored.entryId).catch(
        (error) => console.warn('[reading]', (error as Error).message),
      );
      return c.json(stored);
    },
  );
  // An earlier version of a file, opened again.
  api.get('/files/:id/versions/:n', async (c) => {
    const version = await act(c, async (tx, _a, spaceId) => {
      const { rows } = await tx.query<{ data: Record<string, unknown> }>(
        'select data from entry where id = $1 and space_id = $2',
        [c.req.param('id'), spaceId],
      );
      return ((rows[0]?.data.versions as FileVersion[] | undefined) ?? []).find(
        (one) => one.n === Number(c.req.param('n')),
      );
    });
    if (!version) return c.json({ error: 'No such version.' }, 404);
    const bytes = await deps.blobs.get(version.key);
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      'content-type': version.type,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(version.nom)}`,
    });
  });
  // A file erased for good — only on her explicit yes, which the screen asks for.
  api.post('/files/:id/erase', async (c) => {
    const body = z.object({ sure: z.literal(true) }).parse(await c.req.json());
    void body;
    return c.json(
      await act(c, (tx, actor, spaceId) =>
        eraseFile(tx, actor, deps.blobs, spaceId, c.req.param('id')),
      ),
    );
  });

  // Her Google Drive in Documents (v3 médias, D16): with the « drive.file » right, Jarvis sees only
  // the files it put there or that she opened with it — never her whole Drive. She can bring one
  // into Jarvis (kept, read, linked like any file) and send a Jarvis file to her Drive.
  const driveOf = async (c: Context<Env>) => {
    const list = await deps.connectors.list(
      c.get('person'),
      c.get('spaces').map((one) => one.id),
    );
    return list.find((one) => one.provider === 'google-drive') ?? null;
  };
  api.get('/drive/files', async (c) => {
    const drive = await driveOf(c);
    if (!drive) return c.json({ connected: false, files: [] });
    const answer = await deps.connectors.relay.call(
      actorOf(c),
      drive.id,
      {
        path: `files?pageSize=100&orderBy=modifiedTime desc&fields=${encodeURIComponent('files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)')}&q=${encodeURIComponent('trashed = false')}`,
      },
      false,
    );
    if (!answer.ok)
      return c.json({
        connected: true,
        state: drive.state,
        error: `Drive answered ${answer.status}.`,
        files: [],
      });
    const files = ((answer.data as { files?: Record<string, unknown>[] }).files ?? []).map(
      (one) => ({
        id: String(one.id),
        name: String(one.name),
        mediaType: String(one.mimeType),
        size: Number(one.size ?? 0),
        modified: String(one.modifiedTime ?? ''),
        link: typeof one.webViewLink === 'string' ? one.webViewLink : null,
      }),
    );
    return c.json({ connected: true, state: drive.state, name: drive.name, files });
  });
  // A Drive file brought into Jarvis: its bytes kept (Google documents exported as PDF).
  api.post('/drive/files/:fileId/import', async (c) => {
    const drive = await driveOf(c);
    if (!drive) return c.json({ error: 'Google Drive is not connected.' }, 400);
    const fileId = c.req.param('fileId');
    if (!/^[\w-]{10,200}$/.test(fileId)) return c.json({ error: 'Not a Drive file.' }, 400);
    const actor = actorOf(c);
    const meta = await deps.connectors.relay.call(actor, drive.id, {
      path: `files/${fileId}?fields=${encodeURIComponent('id,name,mimeType,size')}`,
    });
    if (!meta.ok) return c.json({ error: `Drive answered ${meta.status}.` }, 400);
    const info = meta.data as { name: string; mimeType: string; size?: string };
    const google = info.mimeType.startsWith('application/vnd.google-apps.');
    if (!google && Number(info.size ?? 0) > FILE_MAX_BYTES)
      return c.json({ error: `The file is larger than ${FILE_MAX_BYTES / 1024 / 1024} MB.` }, 400);
    const got = await deps.connectors.relay.call(actor, drive.id, {
      path: google
        ? `files/${fileId}/export?mimeType=${encodeURIComponent('application/pdf')}`
        : `files/${fileId}?alt=media`,
      binary: true,
    });
    if (!got.ok || !got.bytes) return c.json({ error: `Drive answered ${got.status}.` }, 400);
    const mediaType = google ? 'application/pdf' : info.mimeType;
    const name = google ? `${info.name}.pdf` : info.name;
    const facts = await mediaFacts(got.bytes, mediaType);
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const stored = await act(c, (tx, a, spaceId) =>
      addFile(tx, a, deps.blobs, {
        spaceId,
        name,
        mediaType,
        bytes: got.bytes!,
        data: { ...facts, source: 'Google Drive', drive_id: fileId },
      }),
    );
    void readAndUnderstand(deps.db, deps.blobs, c.get('person'), space.id, stored.entryId).catch(
      (error) => console.warn('[reading]', (error as Error).message),
    );
    return c.json(stored, 201);
  });
  // A Jarvis file sent to her Drive (it becomes one Jarvis can see there).
  api.post('/drive/send/:id', async (c) => {
    const drive = await driveOf(c);
    if (!drive) return c.json({ error: 'Google Drive is not connected.' }, 400);
    const stored = await act(c, (tx, _a, spaceId) => fileOf(tx, spaceId, c.req.param('id')));
    if (!stored) return c.json({ error: 'No stored file here.' }, 404);
    const bytes = await deps.blobs.get(stored.storageKey);
    const boundary = `jarvis${crypto.randomUUID().replace(/-/g, '')}`;
    const head = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: stored.name })}\r\n--${boundary}\r\nContent-Type: ${stored.mediaType}\r\n\r\n`,
    );
    const tail = new TextEncoder().encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0);
    body.set(bytes, head.length);
    body.set(tail, head.length + bytes.length);
    const sent = await deps.connectors.relay.call(actorOf(c), drive.id, {
      method: 'POST',
      path: '../../upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      raw: { bytes: body, type: `multipart/related; boundary=${boundary}` },
    });
    if (!sent.ok) return c.json({ error: `Drive answered ${sent.status}.` }, 400);
    const made = sent.data as { id?: string; webViewLink?: string };
    await act(c, (tx, actor, spaceId) =>
      save(tx, actor, spaceId, {
        entries: [{ id: c.req.param('id'), data: { drive_id: made.id ?? null } }],
      }),
    );
    return c.json({ sent: true, link: made.webViewLink ?? null });
  });

  // The words Jarvis read in a file (a Word document, a scan), for its page (v3 V7).
  api.get('/files/:id/text', async (c) =>
    c.json(
      await act(c, async (tx, _a, spaceId) => {
        const { rows } = await tx.query<{ text: string | null; read_state: string }>(
          'select text, read_state from file where entry_id = $1 and space_id = $2',
          [c.req.param('id'), spaceId],
        );
        return { text: rows[0]?.text ?? null, state: rows[0]?.read_state ?? 'none' };
      }),
    ),
  );

  // A file read again (v3 V7): one dropped before Jarvis understood documents, or read wrongly.
  api.post('/files/:id/understand', async (c) => {
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    await act(c, (tx, actor, spaceId) =>
      save(tx, actor, spaceId, { entries: [{ id: c.req.param('id'), data: { genre: null } }] }),
    );
    await readAndUnderstand(deps.db, deps.blobs, c.get('person'), space.id, c.req.param('id'));
    return c.json({ read: c.req.param('id') });
  });

  // A company's logo (v3 V7), from its own site, fetched by Jarvis: her browser never calls it.
  api.get('/logo/:domain', async (c) => {
    const logo = await logoFor(c.req.param('domain'));
    if (!logo) return c.body(null, 404, { 'cache-control': 'public, max-age=86400' });
    return c.body(logo.bytes as Uint8Array<ArrayBuffer>, 200, {
      'content-type': logo.type,
      'cache-control': 'public, max-age=604800',
    });
  });

  // Her files, listed (spec 013): what each is, when, what it is linked to.
  api.get('/files', async (c) => c.json(await act(c, (tx, _a, space) => filesOf(tx, space))));

  api.get('/files/:id', async (c) => {
    const stored = await act(c, (tx, _a, space) => fileOf(tx, space, c.req.param('id')));
    if (!stored) return c.json({ error: `No stored file for entry ${c.req.param('id')}.` }, 404);
    // Its thumbnail (an image, small): made once, kept beside it (v3 médias).
    if (c.req.query('thumb')) {
      const thumb = await thumbnailOf(deps.blobs, stored.storageKey, stored.mediaType);
      if (!thumb) return c.json({ error: 'No thumbnail for this kind of file.' }, 404);
      return c.body(thumb as Uint8Array<ArrayBuffer>, 200, {
        'content-type': 'image/webp',
        'cache-control': 'private, max-age=604800',
      });
    }
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

  // Providers' APIs through the relay (v3 D16): what Jarvis knows, a new connection, Google's
  // sign-in and its way back, and a call (for a door, an agent, or to try one).
  api.get('/connections/providers', (c) =>
    c.json(
      PROVIDERS.map(({ id, name, family, auth, description, icon, color }) => ({
        id,
        name,
        family,
        auth,
        description,
        logo: logoOf({ name, ...(icon ? { icon } : {}), ...(color ? { color } : {}) }),
        needsAddress: !providerOf(id)?.base,
      })),
    ),
  );
  api.post('/connections', async (c) => {
    const body = z
      .object({
        provider: z.string().min(1).max(60),
        name: z.string().trim().min(1).max(80).optional(),
        url: z.string().trim().max(2000).optional(),
      })
      .parse(await c.req.json());
    const space = spaceFor(c.get('spaces'), c.req.query('space') ?? c.req.header('x-jarvis-space'));
    const made = await deps.connectors.relay.connect(actorOf(c), space.id, body.provider, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.url ? { url: body.url } : {}),
    });
    return c.json(made, 201);
  });
  api.post('/connections/:id/sign-in', async (c) =>
    c.json({ url: await deps.connectors.relay.signInAgain(c.get('person'), c.req.param('id')) }),
  );
  api.get('/connections/oauth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state') ?? '';
    if (!code) return c.redirect(connectionsPage());
    await deps.connectors.relay.finish(c.get('person'), code, state);
    return c.redirect(connectionsPage());
  });
  api.post('/connections/:id/sync', async (c) =>
    c.json(await deps.connectors.relay.syncIcs(c.get('person'), c.req.param('id'))),
  );
  api.post('/connections/:id/request', async (c) => {
    const body = z
      .object({
        method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional(),
        path: z.string().max(2000).default(''),
        body: z.unknown().optional(),
      })
      .parse(await c.req.json());
    return c.json(
      await deps.connectors.relay.call(actorOf(c), c.req.param('id'), {
        path: body.path,
        ...(body.method ? { method: body.method } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
      }),
    );
  });
  // Her sign-in to a server that asks for it (spec 025, US4): its page, then back here.
  api.post('/connectors/:id/sign-in', async (c) =>
    c.json({ url: await deps.connectors.signIn(c.get('person'), c.req.param('id')) }),
  );
  api.get('/connectors/callback', async (c) => {
    const state = c.req.query('state') ?? '';
    const code = c.req.query('code');
    if (!code) return c.redirect(connectionsPage());
    await deps.connectors.finishSignIn(c.get('person'), state, code);
    return c.redirect(connectionsPage());
  });
  api.get('/connectors/:id/resources/read', async (c) =>
    c.json(
      await deps.connectors.read(c.get('person'), c.req.param('id'), c.req.query('uri') ?? ''),
    ),
  );
  // One of her connections' tools, called from her web account (spec 048, Documents): reading
  // tools at once; a tool that changes, deletes or sends something only with her yes (`agreed`).
  api.post('/connectors/:id/call', async (c) => {
    const body = z
      .object({
        tool: z.string().min(1).max(120),
        args: z.record(z.string(), z.unknown()).default({}),
        agreed: z.boolean().default(false),
      })
      .parse(await c.req.json());
    return c.json(
      await deps.connectors.call(actorOf(c), c.req.param('id'), body.tool, body.args, body.agreed),
    );
  });
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
  // What a proposal would make, changed before her yes (v3 F5).
  api.put('/to-sort/:id', async (c) => {
    const body = z.object({ entries: z.array(z.unknown()) }).parse(await c.req.json());
    return c.json(
      await act(c, (tx, actor, space) =>
        amendProposal(tx, actor, space, c.req.param('id'), body.entries as Amendment[]),
      ),
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

  // Her skills (spec 082): the routines of her spaces, Jarvis's own, and what her apps tell the
  // assistant — how the AI works for each thing she asks.
  api.get('/skills', async (c) =>
    c.json(
      await as(c, async (tx) => {
        const mine = [];
        for (const one of c.get('spaces')) {
          for (const entry of await find(tx, one.id, { kind: 'Routine', limit: 100 })) {
            const data = entry.data as Record<string, unknown>;
            // What starts it, in the node's one vocabulary (F6b).
            const triggers = (Array.isArray(data.triggers) ? data.triggers : []) as Record<
              string,
              unknown
            >[];
            const text = [data.instructions, data.instruction, data.text, data.description].find(
              (v) => typeof v === 'string' && v,
            ) as string | undefined;
            mine.push({
              id: entry.id,
              title: entry.title,
              spaceId: one.id,
              space: one.name,
              when: String(data.when ?? data.quand ?? ''),
              triggers,
              phrases: phrasesOf(data),
              repeat: typeof data.repeat === 'string' ? data.repeat : null,
              result: (data.result as { kind?: unknown } | undefined)?.kind ?? null,
              structured: Boolean(data.instructions || data.triggers),
              excerpt: (text ?? '')
                .replace(/[#>*_`]+/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 220),
              updatedAt: entry.updatedAt,
            });
          }
        }
        const apps: { app: string; covers: unknown; instructions: unknown; space: string }[] = [];
        for (const one of c.get('spaces')) {
          for (const app of await appsOf(tx, one.id, shippedRoles)) {
            if (apps.some((x) => x.app === app.app)) continue;
            apps.push({
              app: app.app,
              covers: app.role.covers,
              instructions: app.role.instructions,
              space: one.name,
            });
          }
        }
        return {
          mine,
          jarvis: baseRoutines.map((one) => ({ ...one, html: markdownHtml(one.text) })),
          apps,
        };
      }),
    ),
  );

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
    const text = briefText(brief);
    // Telegram when it is linked, else her e-mail (v3): the brief reaches her either way.
    if (token && channel.telegram && (await sendTelegram(token, channel.telegram, text)))
      return c.json({ sent: true, via: 'telegram' });
    const [title, ...rest] = text.split(/\n\n/);
    const words = wordsOf(langOf(c.req.header('accept-language')));
    const mailed = await sendQuietly(
      deps.mailer ?? null,
      {
        to: c.get('email'),
        ...mailOf({
          subject: title ?? '',
          title: title ?? '',
          lines: rest,
          footer: words.mailFooter,
        }),
      },
      'brief',
    );
    return c.json({ sent: mailed, via: mailed ? 'email' : null });
  });

  // Her personal keys (spec 015): made, listed, revoked from her settings; a key is shown once.
  api.get('/me/keys', async (c) => c.json(await as(c, (tx) => keysOf(tx))));
  api.post('/me/keys', async (c) => {
    const body = z
      .object({
        name: z.string().max(80).default(''),
        space: z.string().max(64).nullish(),
        kinds: z.array(z.string().max(80)).max(30).nullish(),
      })
      .parse(await c.req.json());
    return c.json(
      await as(c, (tx) =>
        createKey(tx, c.get('person'), body.name, {
          spaceId: body.space ?? null,
          kinds: body.kinds ?? null,
        }),
      ),
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
