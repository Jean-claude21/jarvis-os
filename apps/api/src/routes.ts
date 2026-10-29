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
  query,
  querySchema,
  save,
  spacesOf,
  undo,
  type Actor,
  type Blobs,
  type Tx,
} from '@jarvis-os/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type pg from 'pg';
import { z } from 'zod';
import type { Auth } from './auth';
import { failure } from './errors';

type Env = { Variables: { person: string; spaceId: string; client: string | undefined } };

const linksSchema = z.array(linkInputSchema.omit({ from: true })).max(20);

/**
 * `/api` (spec 002): every function of the core, for the signed-in person, in her space, under
 * row-level security. The routes parse, call the core and answer — nothing else.
 */
export function apiRoutes(deps: { auth: Auth; db: pg.Pool; blobs: Blobs }) {
  const api = new Hono<Env>();

  api.use('*', async (c, next) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'Sign in first.' }, 401);
    const person = session.user.id;
    const [space] = await asPerson(deps.db, person, (tx) => spacesOf(tx));
    if (!space) return c.json({ error: 'This account has no space.' }, 500);
    c.set('person', person);
    c.set('spaceId', space.id);
    c.set('client', c.req.header('x-jarvis-client') ?? undefined);
    await next();
  });

  api.onError((error, c) => {
    const { status, message } = failure(error);
    if (status === 500) console.error(error);
    return c.json({ error: message }, status);
  });

  const act = <T>(c: Context<Env>, work: (tx: Tx, actor: Actor, spaceId: string) => Promise<T>) => {
    const client = c.get('client');
    const actor: Actor = { person: c.get('person'), door: 'api', ...(client ? { client } : {}) };
    return asPerson(deps.db, c.get('person'), (tx) => work(tx, actor, c.get('spaceId')));
  };

  api.get('/me', async (c) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    const spaces = await act(c, (tx) => spacesOf(tx));
    return c.json({
      person: { id: session!.user.id, name: session!.user.name, email: session!.user.email },
      space: spaces.find((one) => one.id === c.get('spaceId')),
    });
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

  api.post('/query', async (c) => {
    const { sql } = querySchema.parse(await c.req.json());
    return c.json(await act(c, (tx, _a, space) => query(tx, { spaceId: space, sql })));
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
