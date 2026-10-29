import {
  addFile,
  archive,
  asPerson,
  fileOf,
  find,
  findInputSchema,
  get,
  history,
  kinds,
  linkInputSchema,
  originSchema,
  query,
  save,
  saveInputSchema,
  undo,
  type Actor,
  type Blobs,
  type Tx,
} from '@jarvis-os/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { failure } from './errors';
import { instructionsFor } from './instructions';

export const MCP_FILE_MAX_BYTES = 5 * 1024 * 1024;

interface Routine {
  name: string;
  when: string;
  text: string;
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

/** Her own routines: entries of kind « Routine ». */
async function routinesOf(tx: Tx, spaceId: string): Promise<Routine[]> {
  const entries = await find(tx, spaceId, { kind: 'Routine', limit: 100 });
  return entries.map((entry) => ({
    name: entry.title,
    when: String(entry.data.quand ?? entry.data.when ?? ''),
    text: String(entry.data.consigne ?? entry.data.text ?? JSON.stringify(entry.data)),
  }));
}

export interface McpPerson {
  person: string;
  name: string;
  spaceId: string;
  /** The client the token was given to, for the journal. */
  client?: string;
}

/**
 * The MCP server of one person (spec 003): the core's functions as tools, Jarvis's instructions,
 * her routines and Jarvis's. Built for each request: stateless, nothing kept between calls.
 */
export async function mcpServerFor(
  deps: { db: pg.Pool; blobs: Blobs; today?: () => string },
  who: McpPerson,
): Promise<McpServer> {
  const actor: Actor = {
    person: who.person,
    door: 'mcp',
    ...(who.client ? { client: who.client } : {}),
  };
  const act = <T>(work: (tx: Tx) => Promise<T>) => asPerson(deps.db, who.person, work);
  const mine = await act((tx) => routinesOf(tx, who.spaceId));
  const server = new McpServer(
    { name: 'jarvis-os', version: '0.3.0' },
    {
      instructions: instructionsFor({
        name: who.name,
        today: deps.today?.() ?? new Date().toISOString().slice(0, 10),
        routines: [
          ...baseRoutines.map((one) => ({ name: one.name, when: one.when, mine: false })),
          ...mine.map((one) => ({ name: one.name, when: one.when, mine: true })),
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
    'kinds',
    {
      description:
        'The kinds of things she already has, with their counts and field names. Call it before creating a kind, and reuse.',
      annotations: { readOnlyHint: true },
    },
    tool(async () => act((tx) => kinds(tx, who.spaceId))),
  );

  server.registerTool(
    'find',
    {
      description:
        'Her entries by words (in titles, fields and text files, accents and case aside), by kind, by creation day (YYYY-MM-DD); latest first.',
      inputSchema: findInputSchema.shape,
      annotations: { readOnlyHint: true },
    },
    tool(async (args: z.input<typeof findInputSchema>) => act((tx) => find(tx, who.spaceId, args))),
  );

  server.registerTool(
    'get',
    {
      description: 'One entry with its fields, their origins and its links both ways.',
      inputSchema: { id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ id }: { id: string }) => {
      const entry = await act((tx) => get(tx, who.spaceId, id));
      if (!entry) throw new Error(`No entry ${id} in her space.`);
      return entry;
    }),
  );

  server.registerTool(
    'save',
    {
      description: [
        'File what she said: new entries (a `ref`, a free `kind`, a `title`, `data` fields, their',
        '`origin`) and changes to existing ones (`id`; a field set to null is removed), the links among',
        'them (`from`/`to` an id or a ref, a `role` in her words) and links to take away (`unlink`).',
        'One call for everything she said. Every change is journaled and can be undone.',
      ].join(' '),
      inputSchema: saveInputSchema.shape,
    },
    tool(async (args: z.input<typeof saveInputSchema>) =>
      act((tx) => save(tx, actor, who.spaceId, args)),
    ),
  );

  server.registerTool(
    'archive',
    {
      description: 'Set an entry aside (never erased; undoable). Ask her first unless she asked.',
      inputSchema: { id: z.string().min(1) },
      annotations: { destructiveHint: false },
    },
    tool(async ({ id }: { id: string }) => {
      await act((tx) => archive(tx, actor, { spaceId: who.spaceId, id }));
      return { archived: id };
    }),
  );

  server.registerTool(
    'query',
    {
      description: [
        'Every figure comes from here: one SQL `select` over my_entries (id, kind, title, data jsonb,',
        'origin jsonb, created_at, updated_at, archived_at), my_links (id, from_id, to_id, role,',
        "created_at) and my_files (entry_id, name, media_type, size, text). Fields: data->>'montant'.",
        'Read-only, 3 s, 500 rows. On error, read the message and correct the query.',
      ].join(' '),
      inputSchema: { sql: z.string().min(1).max(10_000) },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ sql }: { sql: string }) => act((tx) => query(tx, { spaceId: who.spaceId, sql }))),
  );

  server.registerTool(
    'history',
    {
      description:
        'The latest changes in her life, or of one entry (`target`), newest first, with what each was before and after. Each has an `id` for `undo`.',
      inputSchema: {
        target: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ target, limit }: { target?: string | undefined; limit?: number | undefined }) =>
      act((tx) => history(tx, who.spaceId, { ...(target ? { target } : {}), limit: limit ?? 20 })),
    ),
  );

  server.registerTool(
    'undo',
    {
      description: 'Take one change back (its `id` from `history`); the undo is journaled too.',
      inputSchema: { journalId: z.number().int().positive() },
    },
    tool(async ({ journalId }: { journalId: number }) =>
      act((tx) => undo(tx, actor, { spaceId: who.spaceId, journalId })),
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
      }) => {
        const bytes = new Uint8Array(Buffer.from(args.base64, 'base64'));
        if (bytes.byteLength > MCP_FILE_MAX_BYTES) {
          throw new Error(
            `The file is larger than ${MCP_FILE_MAX_BYTES / 1024 / 1024} MB: send it through POST /api/files.`,
          );
        }
        return act((tx) =>
          addFile(tx, actor, deps.blobs, {
            spaceId: who.spaceId,
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
      },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ entryId, seconds }: { entryId: string; seconds?: number | undefined }) => {
      const stored = await act((tx) => fileOf(tx, who.spaceId, entryId));
      if (!stored) throw new Error(`No stored file for entry ${entryId}.`);
      const lifetime = seconds ?? 600;
      return {
        name: stored.name,
        mediaType: stored.mediaType,
        url: await deps.blobs.link(stored.storageKey, lifetime),
        seconds: lifetime,
      };
    }),
  );

  server.registerTool(
    'routine',
    {
      description:
        'The full text of a routine named in the instructions (Jarvis’s or hers), to follow it.',
      inputSchema: { name: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ name }: { name: string }) => {
      const wanted = name.trim().toLowerCase();
      const all = [...mine, ...baseRoutines];
      const found = all.find((one) => one.name.toLowerCase() === wanted);
      if (!found) {
        throw new Error(
          `No routine « ${name} ». Routines: ${all.map((one) => one.name).join(', ')}.`,
        );
      }
      return found;
    }),
  );

  return server;
}
