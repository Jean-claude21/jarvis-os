import {
  addFile,
  archive,
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
  invitationsOf,
  invite,
  leaveSpace,
  membersOf,
  query,
  querySchema,
  renameSpace,
  save,
  spacesOf,
  undo,
  withdrawInvitation,
  type Actor,
  type Blobs,
  type Space,
  type Tx,
} from '@jarvis-os/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type pg from 'pg';
import { z } from 'zod';
import type { Auth } from './auth';
import { failure } from './errors';
import { invitationLink, namesOf, spaceFor } from './spaces';

type Env = {
  Variables: {
    person: string;
    email: string;
    name: string;
    spaces: Space[];
    client: string | undefined;
  };
};

const linksSchema = z.array(linkInputSchema.omit({ from: true })).max(20);

/**
 * `/api` (spec 002): every function of the core, for the signed-in person, under row-level
 * security. A route acts in the space named by `?space=` (an id or a name) or the `x-jarvis-space`
 * header, else in her own (spec 004). The routes parse, call the core and answer — nothing else.
 */
export function apiRoutes(deps: { auth: Auth; db: pg.Pool; blobs: Blobs; publicUrl: string }) {
  const api = new Hono<Env>();

  api.use('*', async (c, next) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'Sign in first.' }, 401);
    const person = session.user.id;
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
    return c.json({ error: message }, status);
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
    return c.json(await act(c, (tx, _a, space) => find(tx, space, input)));
  });

  api.get('/entries/:id', async (c) => {
    const entry = await act(c, (tx, _a, space) => get(tx, space, c.req.param('id')));
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

  api.get('/files/:id', async (c) => {
    const stored = await act(c, (tx, _a, space) => fileOf(tx, space, c.req.param('id')));
    if (!stored) return c.json({ error: `No stored file for entry ${c.req.param('id')}.` }, 404);
    const bytes = await deps.blobs.get(stored.storageKey);
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      'content-type': stored.mediaType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(stored.name)}`,
    });
  });

  api.get('/files/:id/link', async (c) => {
    const seconds = Math.min(Math.max(Number(c.req.query('seconds') ?? 600), 60), 86_400);
    const stored = await act(c, (tx, _a, space) => fileOf(tx, space, c.req.param('id')));
    if (!stored) return c.json({ error: `No stored file for entry ${c.req.param('id')}.` }, 404);
    return c.json({ url: await deps.blobs.link(stored.storageKey, seconds), seconds });
  });

  return api;
}
