import {
  addFile,
  allowSpace,
  archive,
  asPerson,
  createSharedSpace,
  fileOf,
  find,
  findInputSchema,
  get,
  history,
  invite,
  kinds,
  linkInputSchema,
  membersOf,
  originSchema,
  query,
  save,
  saveInputSchema,
  undo,
  type Actor,
  type Blobs,
  type Space,
  type Tx,
} from '@jarvis-os/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { failure } from './errors';
import { instructionsFor } from './instructions';
import { invitationLink, namesOf, spaceFor } from './spaces';
import { registerViews } from './views/register';

export const MCP_FILE_MAX_BYTES = 5 * 1024 * 1024;

interface Routine {
  name: string;
  when: string;
  text: string;
  /** The space it belongs to; none for Jarvis's base routines. */
  space?: string;
}

/** Jarvis's base routines, read once from `routines/*.md` (front matter: name, when). */
const baseRoutines: Routine[] = (() => {
  const folder = fileURLToPath(new URL('./routines/', import.meta.url));
  return readdirSync(folder)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const source = readFileSync(`${folder}${file}`, 'utf8');
      const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
      const field = (key: string) =>
        new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(head?.[1] ?? '')?.[1]?.trim() ?? '';
      return {
        name: field('name') || file,
        when: field('when'),
        text: (head?.[2] ?? source).trim(),
      };
    });
})();

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

/** The text of an entry kept as instructions (a routine's consigne, a charter's texte). */
const textOf = (data: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (typeof data[key] === 'string' && data[key]) return data[key];
  return JSON.stringify(data);
};

/** Her routines and charters in each space this client reaches. */
async function methodOf(tx: Tx, spaces: Space[]) {
  const routines: Routine[] = [];
  const charters: { space: string; title: string; text: string }[] = [];
  for (const space of spaces) {
    for (const entry of await find(tx, space.id, { kind: 'Routine', limit: 100 })) {
      routines.push({
        name: entry.title,
        when: String(entry.data.quand ?? entry.data.when ?? ''),
        text: textOf(entry.data, 'consigne', 'text'),
        space: space.name,
      });
    }
    for (const entry of await find(tx, space.id, { kind: 'Charte', limit: 10 })) {
      charters.push({
        space: space.name,
        title: entry.title,
        text: textOf(entry.data, 'texte', 'text'),
      });
    }
  }
  return { routines, charters };
}

export interface McpPerson {
  person: string;
  name: string;
  email: string;
  /** The spaces this client may reach for her (spec 004), her own first. */
  spaces: Space[];
  /** The OAuth client the token was given to: its allowances are kept by its id. */
  clientId?: string;
  /** Its name, for the journal. */
  client?: string;
}

const spaceArg = z
  .string()
  .min(1)
  .optional()
  .describe('The space to act in, by name or id (see `spaces`); her own when absent.');

/**
 * The MCP server of one person (spec 003): the core's functions as tools, Jarvis's instructions,
 * the charters and routines of the spaces this client reaches (spec 004), and Jarvis's. Built for
 * each request: stateless, nothing kept between calls.
 */
export async function mcpServerFor(
  deps: {
    db: pg.Pool;
    blobs: Blobs;
    publicUrl: string;
    /** Signs upload links (spec 005). */
    secret: string;
    today?: () => string;
  },
  who: McpPerson,
): Promise<McpServer> {
  const actor: Actor = {
    person: who.person,
    door: 'mcp',
    ...(who.client ? { client: who.client } : {}),
  };
  const act = <T>(work: (tx: Tx) => Promise<T>) => asPerson(deps.db, who.person, work);
  const reach = [...who.spaces];
  const at = (space?: string) => spaceFor(reach, space ?? null).id;
  const method = await act((tx) => methodOf(tx, reach));
  const server = new McpServer(
    { name: 'jarvis-os', version: '0.5.0' },
    {
      instructions: instructionsFor({
        name: who.name,
        today: deps.today?.() ?? new Date().toISOString().slice(0, 10),
        spaces: reach.map((one) => ({ name: one.name, personal: one.personal })),
        charters: method.charters,
        routines: [
          ...baseRoutines.map((one) => ({ name: one.name, when: one.when })),
          ...method.routines.map((one) => ({
            name: one.name,
            when: one.when,
            ...(one.space ? { space: one.space } : {}),
          })),
        ],
      }),
    },
  );

  /** A tool's work, its failures said in words the model can act on. */
  const tool =
    <A>(work: (args: A) => Promise<unknown>) =>
    async (args: A) => {
      try {
        return json(await work(args));
      } catch (error) {
        return { ...json({ error: failure(error).message }), isError: true };
      }
    };

  server.registerTool(
    'spaces',
    {
      description:
        'The spaces this connection reaches: her own (private for good) and the shared ones (a couple, a family), with who belongs to each.',
      annotations: { readOnlyHint: true },
    },
    tool(async () => {
      const spaces = await act(async (tx) => {
        const all = [];
        for (const space of reach) all.push({ ...space, members: await membersOf(tx, space.id) });
        return all;
      });
      const names = await namesOf(
        deps.db,
        spaces.flatMap((space) => space.members.map((one) => one.person)),
      );
      return spaces.map((space) => ({
        name: space.name,
        id: space.id,
        personal: space.personal,
        role: space.role,
        members: space.members.map((one) => names.get(one.person) ?? one.person),
      }));
    }),
  );

  server.registerTool(
    'create_space',
    {
      description:
        'Create a shared space she owns (« Nous » for a couple, « Famille »…), then `invite` someone into it. A space is a circle of people, never a theme: themes stay kinds and links. Only when she asks.',
      inputSchema: { name: z.string().min(1).max(120) },
    },
    tool(async ({ name }: { name: string }) => {
      const made = await act(async (tx) => {
        const space = await createSharedSpace(tx, actor, { name });
        if (who.clientId) await allowSpace(tx, who.clientId, space.id);
        return space;
      });
      reach.push(made);
      return made;
    }),
  );

  server.registerTool(
    'invite',
    {
      description:
        'Invite an e-mail address into a shared space she owns: returns a link valid 14 days, which she sends herself (Jarvis sends no mail). The invited person signs in with that address and accepts.',
      inputSchema: { space: z.string().min(1), email: z.string().min(3).max(320) },
    },
    tool(async ({ space, email }: { space: string; email: string }) => {
      const made = await act((tx) => invite(tx, actor, { spaceId: at(space), email }));
      return {
        link: invitationLink(deps.publicUrl, made.token),
        expiresAt: made.expiresAt,
        email: email.trim().toLowerCase(),
      };
    }),
  );

  server.registerTool(
    'kinds',
    {
      description:
        'The kinds of things she already has in a space, with their counts and field names. Call it before creating a kind, and reuse.',
      inputSchema: { space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ space }: { space?: string | undefined }) => act((tx) => kinds(tx, at(space)))),
  );

  server.registerTool(
    'find',
    {
      description:
        'Her entries in a space by words (in titles, fields and text files, accents and case aside), by kind, by creation day (YYYY-MM-DD); latest first.',
      inputSchema: { ...findInputSchema.shape, space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        space,
        ...args
      }: z.input<typeof findInputSchema> & { space?: string | undefined }) =>
        act((tx) => find(tx, at(space), args)),
    ),
  );

  server.registerTool(
    'get',
    {
      description: 'One entry with its fields, their origins and its links both ways.',
      inputSchema: { id: z.string().min(1), space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ id, space }: { id: string; space?: string | undefined }) => {
      const entry = await act((tx) => get(tx, at(space), id));
      if (!entry) throw new Error(`No entry ${id} in this space.`);
      return entry;
    }),
  );

  server.registerTool(
    'save',
    {
      description: [
        'File what she said, in one space: new entries (a `ref`, a free `kind`, a `title`, `data`',
        'fields, their `origin`) and changes to existing ones (`id`; a field set to null is removed),',
        'the links among them (`from`/`to` an id or a ref, a `role` in her words) and links to take',
        'away (`unlink`). One call for everything she said about that space. Every change is',
        'journaled and can be undone.',
      ].join(' '),
      inputSchema: { ...saveInputSchema.shape, space: spaceArg },
    },
    tool(
      async ({
        space,
        ...args
      }: z.input<typeof saveInputSchema> & { space?: string | undefined }) =>
        act((tx) => save(tx, actor, at(space), args)),
    ),
  );

  server.registerTool(
    'archive',
    {
      description: 'Set an entry aside (never erased; undoable). Ask her first unless she asked.',
      inputSchema: { id: z.string().min(1), space: spaceArg },
      annotations: { destructiveHint: false },
    },
    tool(async ({ id, space }: { id: string; space?: string | undefined }) => {
      await act((tx) => archive(tx, actor, { spaceId: at(space), id }));
      return { archived: id };
    }),
  );

  server.registerTool(
    'query',
    {
      description: [
        'Every figure comes from here: one SQL `select` over the spaces this connection reaches —',
        'my_spaces (id, name, personal), my_entries (id, space_id, space, kind, title, data jsonb,',
        'origin jsonb, created_at, updated_at, archived_at), my_links (id, space_id, from_id, to_id,',
        'role, created_at) and my_files (entry_id, space_id, name, media_type, size, text). Fields:',
        "data->>'montant'. Give `space` to read one space only. Read-only, 3 s, 500 rows. On error,",
        'read the message and correct the query.',
      ].join(' '),
      inputSchema: { sql: z.string().min(1).max(10_000), space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ sql, space }: { sql: string; space?: string | undefined }) =>
      act((tx) => query(tx, { spaceIds: space ? [at(space)] : reach.map((one) => one.id), sql })),
    ),
  );

  server.registerTool(
    'history',
    {
      description:
        'The latest changes in a space, or of one entry (`target`), newest first, with what each was before and after, and who made it. Each has an `id` for `undo`.',
      inputSchema: {
        target: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        target,
        limit,
        space,
      }: {
        target?: string | undefined;
        limit?: number | undefined;
        space?: string | undefined;
      }) =>
        act((tx) => history(tx, at(space), { ...(target ? { target } : {}), limit: limit ?? 20 })),
    ),
  );

  server.registerTool(
    'undo',
    {
      description: 'Take one change back (its `id` from `history`); the undo is journaled too.',
      inputSchema: { journalId: z.number().int().positive(), space: spaceArg },
    },
    tool(async ({ journalId, space }: { journalId: number; space?: string | undefined }) =>
      act((tx) => undo(tx, actor, { spaceId: at(space), journalId })),
    ),
  );

  server.registerTool(
    'add_file',
    {
      description: [
        `Keep a file she gave (up to ${MCP_FILE_MAX_BYTES / 1024 / 1024} MB, base64): an entry of kind`,
        '« Fichier » with its bytes stored, linked to what it is for (`links`: `to` an id, a `role`',
        'such as « pièce de »). Put what you read on it in `data` with `origin` « read». Larger',
        'files go through POST /api/files.',
      ].join(' '),
      inputSchema: {
        name: z.string().min(1).max(200),
        mediaType: z.string().min(3).max(100),
        base64: z.string().min(1),
        title: z.string().max(300).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        origin: originSchema.optional(),
        links: z
          .array(linkInputSchema.omit({ from: true }))
          .max(20)
          .optional(),
        space: spaceArg,
      },
    },
    tool(
      async (args: {
        name: string;
        mediaType: string;
        base64: string;
        title?: string | undefined;
        data?: Record<string, unknown> | undefined;
        origin?: z.infer<typeof originSchema> | undefined;
        links?: { to: string; role: string }[] | undefined;
        space?: string | undefined;
      }) => {
        const bytes = new Uint8Array(Buffer.from(args.base64, 'base64'));
        if (bytes.byteLength > MCP_FILE_MAX_BYTES) {
          throw new Error(
            `The file is larger than ${MCP_FILE_MAX_BYTES / 1024 / 1024} MB: send it through POST /api/files.`,
          );
        }
        return act((tx) =>
          addFile(tx, actor, deps.blobs, {
            spaceId: at(args.space),
            name: args.name,
            mediaType: args.mediaType,
            bytes,
            ...(args.title ? { title: args.title } : {}),
            ...(args.data ? { data: args.data } : {}),
            ...(args.origin ? { origin: args.origin } : {}),
            links: args.links ?? [],
          }),
        );
      },
    ),
  );

  server.registerTool(
    'file_link',
    {
      description:
        'A link that opens one of her files without signing in, for `seconds` (60 to 86 400, default 600): to read it, show it or send it.',
      inputSchema: {
        entryId: z.string().min(1),
        seconds: z.number().int().min(60).max(86_400).optional(),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        entryId,
        seconds,
        space,
      }: {
        entryId: string;
        seconds?: number | undefined;
        space?: string | undefined;
      }) => {
        const stored = await act((tx) => fileOf(tx, at(space), entryId));
        if (!stored) throw new Error(`No stored file for entry ${entryId}.`);
        const lifetime = seconds ?? 600;
        return {
          name: stored.name,
          mediaType: stored.mediaType,
          url: await deps.blobs.link(stored.storageKey, lifetime),
          seconds: lifetime,
        };
      },
    ),
  );

  server.registerTool(
    'routine',
    {
      description:
        'The full text of a routine named in the instructions (Jarvis’s or one of her spaces’), to follow it.',
      inputSchema: { name: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ name }: { name: string }) => {
      const wanted = name.trim().toLowerCase();
      const all = [...method.routines, ...baseRoutines];
      const found = all.find((one) => one.name.toLowerCase() === wanted);
      if (!found) {
        throw new Error(
          `No routine « ${name} ». Routines: ${all.map((one) => one.name).join(', ')}.`,
        );
      }
      return found;
    }),
  );

  registerViews(server, {
    db: deps.db,
    person: who.person,
    publicUrl: deps.publicUrl,
    secret: deps.secret,
    reach,
    spaceOf: (space) => spaceFor(reach, space ?? null),
    act,
  });

  return server;
}
