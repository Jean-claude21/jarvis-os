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
  upcoming,
  agenda,
  timeOf,
  type Actor,
  type Blobs,
  type Space,
  type Tx,
  withComputed,
  bundleSchema,
  exportApp,
  installApp,
  migrateKind,
  migrationSchema,
  runScript,
  testRule,
  OPERATORS,
  runView,
  collectionsOf,
  collectionStats,
  groupKind,
  listStats,
  renameKind,
  createShare,
  press,
  setRole,
  type ViewData,
} from '@jarvis-os/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { failure } from './errors';
import { instructionsFor } from './instructions';
import { shippedApp, shippedApps } from './apps';
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

/** The text of an entry kept as instructions (a routine's instruction, a charter's text). */
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
        // A routine she said (when, instruction) or one read from her files (description, text).
        when: String(
          entry.data.when ?? entry.data.at ?? entry.data.quand ?? entry.data.description ?? '',
        ),
        text: textOf(entry.data, 'instruction', 'text', 'description'),
        space: space.name,
      });
    }
    for (const entry of await find(tx, space.id, { kind: 'Charter', limit: 10 })) {
      charters.push({
        space: space.name,
        title: entry.title,
        text: textOf(entry.data, 'text'),
      });
    }
  }
  return {
    routines,
    charters,
    upcoming: await upcoming(
      tx,
      spaces.map((one) => one.id),
    ),
  };
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
        upcoming: method.upcoming,
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
        'The kinds of things she already has in a space, with their counts and field names — and the `model` of a kind that has one: every save of it must follow its fields. Call it before creating a kind, and reuse.',
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
        act(async (tx) => withComputed(tx, at(space), await find(tx, at(space), args))),
    ),
  );

  server.registerTool(
    'get',
    {
      description:
        'One entry with its fields, their origins, its links both ways and its formulas computed (`computed`).',
      inputSchema: { id: z.string().min(1), space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ id, space }: { id: string; space?: string | undefined }) => {
      const entry = await act(async (tx) => {
        const one = await get(tx, at(space), id);
        return one ? (await withComputed(tx, at(space), [one]))[0] : null;
      });
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
    'agenda',
    {
      description: [
        'Her calendar for a window: every entry of any kind that has a time — `start`/`end`/`duration`',
        '(a span), `at` (a moment), `due` (a deadline), `date` (a day, from today on),',
        '`repeat` (again and again, minus the days in `except`) — at its place, sorted. Answer « what do',
        'I have Thursday? » from this, never from memory. `from`/`to`: ISO times or days',
        '(« 2026-10-29 »); at most 366 days. Every space this client reaches unless `space` is given.',
      ].join(' '),
      inputSchema: {
        from: z.string().min(10),
        to: z.string().min(10),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ from, to, space }: { from: string; to: string; space?: string | undefined }) => {
      const start = timeOf(from.length === 10 ? `${from}T00:00` : from);
      const end = timeOf(to.length === 10 ? `${to}T00:00` : to);
      if (!start || !end) throw new Error('from and to are ISO days or times (« 2026-10-29 »).');
      // A day given as the end is included: « to 2026-10-29 » means through that day.
      const until = to.length === 10 ? new Date(end.getTime() + 86_400_000) : end;
      const ids = space ? [at(space)] : reach.map((one) => one.id);
      return act((tx) => agenda(tx, ids, { from: start, to: until }));
    }),
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
      // « matin », « Matin » or « /matin »: the name she uses.
      const bare = wanted.replace(/^\//, '');
      const all = [...method.routines, ...baseRoutines];
      const found = all.find((one) => [wanted, bare].includes(one.name.toLowerCase()));
      if (!found) {
        throw new Error(
          `No routine « ${name} ». Routines: ${all.map((one) => one.name).join(', ')}.`,
        );
      }
      return found;
    }),
  );

  // The app engine (spec 014): try a rule, run a script, migrate a kind, export or install an app.
  server.registerTool(
    'view',
    {
      description: [
        'The entries of a kind as she explores them (spec 015): `view` = { kind, type: table|kanban|calendar,',
        'filters: [{ field, op, value? }] (a field of the kind or one link away, « fund.title »; op among',
        `${OPERATORS.join(', ')}), sort: [{ field, desc? }], columns?, groupBy?, by?, date? }, or \`id\` of a`,
        'view she kept (an entry « View »; save one with `save` to keep it, `label` { fr, en }, `default`).',
        'Returns the rows, totals, the fields she can filter, and what the kind can be shown as.',
      ].join(' '),
      inputSchema: {
        id: z.string().min(1).optional(),
        view: z.record(z.string(), z.unknown()).optional(),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        id,
        view,
        space,
      }: {
        id?: string | undefined;
        view?: Record<string, unknown> | undefined;
        space?: string | undefined;
      }) =>
        act(async (tx) => {
          let data = view ?? {};
          if (id) {
            const kept = await get(tx, at(space), id);
            if (!kept || kept.kind.toLowerCase() !== 'view')
              throw new Error(`No view ${id} in this space.`);
            data = { ...kept.data, ...data };
          }
          const result = await runView(tx, at(space), data as ViewData);
          return { ...result, fields: result.fields.map((field) => field.path) };
        }),
    ),
  );

  // Collections, buttons, public links, viewers (spec 016).
  server.registerTool(
    'collection_stats',
    {
      description:
        'The statistics of one of her collections (a kind with a model), read from its model: how many, how they split on each choice, how they come week after week, the sums and averages of their numbers. Without `kind`: her collections.',
      inputSchema: { kind: z.string().min(1).optional(), space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ kind, space }: { kind?: string | undefined; space?: string | undefined }) =>
      act<unknown>((tx) =>
        kind ? collectionStats(tx, at(space), kind) : collectionsOf(tx, at(space)),
      ),
    ),
  );

  // Any list, its kinds and their groups (spec 017).
  server.registerTool(
    'stats',
    {
      description:
        'The statistics of any of her lists, a kind with or without a model, by words, period or folder: how many, this month, day by day over twelve weeks, the current and best streak of days, the active days of the last thirty, the hours, the repeated values, the averages. Each entry counts on its own day (its date, else the day in its source or title). Use it for « how many prayers this week », « my streak ».',
      inputSchema: {
        kind: z.string().min(1).optional(),
        text: z.string().optional(),
        from: z.string().optional().describe('YYYY-MM-DD'),
        to: z.string().optional().describe('YYYY-MM-DD'),
        folder: z.string().optional(),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        space,
        ...input
      }: {
        kind?: string | undefined;
        text?: string | undefined;
        from?: string | undefined;
        to?: string | undefined;
        folder?: string | undefined;
        space?: string | undefined;
      }) =>
        act((tx) =>
          listStats(
            tx,
            at(space),
            Object.fromEntries(Object.entries(input).filter(([, value]) => value)),
          ),
        ),
    ),
  );

  server.registerTool(
    'rename_kind',
    {
      description:
        'Rename one of her kinds (« document » → « Document »), or merge it into another: every entry follows, with its model, views and groups; one change, undone at once. Only when she asks.',
      inputSchema: { from: z.string().min(1), to: z.string().min(1), space: spaceArg },
    },
    tool(async ({ from, to, space }: { from: string; to: string; space?: string | undefined }) =>
      act((tx) => renameKind(tx, actor, at(space), { from, to })),
    ),
  );

  server.registerTool(
    'group_kind',
    {
      description:
        'File one of her kinds in one of her groups (an « Area » entry, created if new), as she names it — « Spirituel », « Pilotage » — or in none (group null). The Entries page shows her kinds by these groups.',
      inputSchema: {
        kind: z.string().min(1),
        group: z.string().min(1).nullable(),
        space: spaceArg,
      },
    },
    tool(
      async ({
        kind,
        group,
        space,
      }: {
        kind: string;
        group: string | null;
        space?: string | undefined;
      }) => act((tx) => groupKind(tx, actor, at(space), { kind, group })),
    ),
  );

  server.registerTool(
    'press',
    {
      description:
        'Press a `button` field of an entry: its action (fields set, a rule or a script run on it), journaled and undoable. Press only when she asks.',
      inputSchema: { entry: z.string().min(1), field: z.string().min(1), space: spaceArg },
    },
    tool(
      async ({
        entry,
        field,
        space,
      }: {
        entry: string;
        field: string;
        space?: string | undefined;
      }) => act((tx) => press(tx, actor, at(space), { entryId: entry, field })),
    ),
  );

  server.registerTool(
    'share',
    {
      description: [
        'Open a PUBLIC link — anyone with it can use it, so only after her explicit yes: `mode: "form"`',
        '(`kind`, `fields`: what others may fill; what they send arrives as « proposed », origin « read »)',
        'or `mode: "view"` (`view`: { kind, filters, columns… }, read-only). Give her the link; she',
        'closes it by setting `active: false` on the entry « Share ».',
      ].join(' '),
      inputSchema: {
        name: z.string().min(1).max(120),
        mode: z.enum(['form', 'view']),
        kind: z.string().min(1).optional(),
        fields: z.array(z.string().min(1)).max(30).optional(),
        view: z.record(z.string(), z.unknown()).optional(),
        intro: z.string().max(2000).optional(),
        space: spaceArg,
      },
    },
    tool(
      async (args: {
        name: string;
        mode: 'form' | 'view';
        kind?: string | undefined;
        fields?: string[] | undefined;
        view?: Record<string, unknown> | undefined;
        intro?: string | undefined;
        space?: string | undefined;
      }) => {
        const data = {
          mode: args.mode,
          ...(args.kind ? { kind: args.kind } : {}),
          ...(args.fields ? { fields: args.fields } : {}),
          ...(args.view ? { view: args.view } : {}),
          ...(args.intro ? { intro: args.intro } : {}),
        };
        const made = await act((tx) =>
          createShare(tx, actor, at(args.space), { name: args.name, data: data as never }),
        );
        return { id: made.id, link: `${deps.publicUrl.replace(/\/$/, '')}/p/${made.key}` };
      },
    ),
  );

  server.registerTool(
    'set_role',
    {
      description:
        'What a member may do in a shared space she owns: `owner`, `member` (reads and writes) or `viewer` (reads only). Only after she asks.',
      inputSchema: {
        space: z.string().min(1),
        person: z.string().min(1),
        role: z.enum(['owner', 'member', 'viewer']),
      },
    },
    tool(
      async ({
        space,
        person,
        role,
      }: {
        space: string;
        person: string;
        role: 'owner' | 'member' | 'viewer';
      }) =>
        act(async (tx) => {
          await setRole(tx, actor, { spaceId: at(space), person, role });
          return { role };
        }),
    ),
  );

  server.registerTool(
    'rule_test',
    {
      description:
        'Try one of her rules (an entry « Rule », by title or id) on an entry — or on nothing, for a schedule — and say what it would change; nothing is changed.',
      inputSchema: {
        rule: z.string().min(1),
        entry: z.string().min(1).optional(),
        space: spaceArg,
      },
      annotations: { readOnlyHint: true },
    },
    tool(
      async ({
        rule,
        entry,
        space,
      }: {
        rule: string;
        entry?: string | undefined;
        space?: string | undefined;
      }) => act((tx) => testRule(tx, actor, at(space), { rule, entryId: entry })),
    ),
  );

  server.registerTool(
    'run_script',
    {
      description: [
        'Run one of her scripts (an entry « Script »: `run(input)` returns changes): `file` the entry of',
        'a file it reads (a bank statement), `entry` an entry it works on, `params` her choices.',
        '`dryRun` (default true) only tries and lists what would change: show her, then run with',
        '`dryRun: false` after her yes. Its changes are checked against what it declared it writes,',
        'journaled and undoable.',
      ].join(' '),
      inputSchema: {
        script: z.string().min(1),
        file: z.string().min(1).optional(),
        entry: z.string().min(1).optional(),
        params: z.record(z.string(), z.string()).optional(),
        dryRun: z.boolean().default(true),
        space: spaceArg,
      },
    },
    tool(
      async (args: {
        script: string;
        file?: string | undefined;
        entry?: string | undefined;
        params?: Record<string, string> | undefined;
        dryRun: boolean;
        space?: string | undefined;
      }) =>
        act((tx) =>
          runScript(tx, actor, at(args.space), {
            script: args.script,
            fileId: args.file,
            entryId: args.entry,
            params: args.params ?? {},
            dryRun: args.dryRun,
          }),
        ),
    ),
  );

  server.registerTool(
    'migrate',
    {
      description: [
        'Change every entry of a kind when its model changes: `steps` among { rename: { from, to } },',
        '{ set: { field, formula } } (a formula of the entry), { remove: field }; `where` a formula to',
        'choose some. `dryRun` (default true) counts, shows a sample and the entries that would not follow',
        'the model; then run with `dryRun: false` after her yes — undone at once with `undo`.',
      ].join(' '),
      inputSchema: {
        kind: z.string().min(1),
        steps: migrationSchema.shape.steps,
        where: z.string().min(1).optional(),
        dryRun: z.boolean().default(true),
        space: spaceArg,
      },
    },
    tool(
      async ({
        space,
        ...input
      }: z.input<typeof migrationSchema> & { space?: string | undefined }) =>
        act((tx) => migrateKind(tx, actor, at(space), input)),
    ),
  );

  server.registerTool(
    'app_export',
    {
      description:
        'One of her apps as a bundle: the models, pages, rules and scripts that name it — to keep, share or install in another space.',
      inputSchema: { app: z.string().min(1), space: spaceArg },
      annotations: { readOnlyHint: true },
    },
    tool(async ({ app, space }: { app: string; space?: string | undefined }) =>
      act((tx) => exportApp(tx, at(space), app)),
    ),
  );

  server.registerTool(
    'app_install',
    {
      description: [
        `Install an app in a space: one that ships with Jarvis by \`name\` (${shippedApps.map((one) => `« ${one.app} »: ${typeof one.description === 'object' ? (one.description.en ?? '') : (one.description ?? '')}`).join(' ')})`,
        'or a `bundle` (from `app_export`). `dryRun` (default true) lists what would be created; what',
        'is already there (same kind and title) is kept. Show her, then install with `dryRun: false`.',
      ].join(' '),
      inputSchema: {
        name: z.string().min(1).optional(),
        bundle: z.record(z.string(), z.unknown()).optional(),
        dryRun: z.boolean().default(true),
        space: spaceArg,
      },
    },
    tool(
      async (args: {
        name?: string | undefined;
        bundle?: Record<string, unknown> | undefined;
        dryRun: boolean;
        space?: string | undefined;
      }) => {
        const bundle = args.bundle
          ? bundleSchema.parse(args.bundle)
          : args.name
            ? shippedApp(args.name)
            : null;
        if (!bundle) throw new Error('Give `name` (an app Jarvis ships) or `bundle`.');
        return act((tx) => installApp(tx, actor, at(args.space), bundle, args.dryRun));
      },
    ),
  );

  registerViews(server, {
    db: deps.db,
    person: who.person,
    publicUrl: deps.publicUrl,
    secret: deps.secret,
    reach,
    spaceOf: (space) => spaceFor(reach, space ?? null),
    act,
    actor,
  });

  return server;
}
