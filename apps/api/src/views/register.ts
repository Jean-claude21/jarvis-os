import {
  find,
  get,
  history,
  readDocument,
  save,
  writeDocument,
  type Actor,
  type DocumentEdit,
  type Space,
  type Tx,
} from '@jarvis-os/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type pg from 'pg';
import { z } from 'zod';
import { FONT_DOMAINS, VIEW_MIME } from './base';
import {
  computeDashboard,
  dashboardText,
  dashboardView,
  widgetSchema,
  widgetsOf,
} from './dashboard';
import { DOCUMENT_HOURS, documentShown, documentToken, documentView } from './document';
import { entryView } from './entry';
import { UPLOAD_MINUTES, uploadToken, uploadView } from './upload';

const VIEWS = {
  dashboard: 'ui://jarvis/dashboard',
  entry: 'ui://jarvis/entry',
  upload: 'ui://jarvis/upload',
  document: 'ui://jarvis/document',
} as const;

/** What the views need from the MCP server of one person. */
export interface ViewContext {
  db: pg.Pool;
  person: string;
  publicUrl: string;
  secret: string;
  reach: Space[];
  /** The space named, among those reachable (else her own). */
  spaceOf: (space?: string) => Space;
  act: <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
  /** Who changes something through these tools. */
  actor: Actor;
}

/** A tool's answer: words for the model and hosts without views, data for the view. */
const answer = (text: string, data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text }],
  structuredContent: data,
});

const failed = (error: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: (error as Error).message }) }],
  isError: true,
});

/**
 * Jarvis's views inside the clients (spec 005, decision 0006): each tool below names its view
 * (`_meta.ui.resourceUri`) and still answers in words, so a host without MCP Apps loses nothing.
 */
export function registerViews(server: McpServer, ctx: ViewContext): void {
  const resource = (name: string, uri: string, html: () => string, connect: string[] = []) =>
    server.registerResource(name, uri, { mimeType: VIEW_MIME }, async () => ({
      contents: [
        {
          uri,
          mimeType: VIEW_MIME,
          text: html(),
          _meta: {
            ui: {
              csp: { connectDomains: connect, resourceDomains: FONT_DOMAINS },
              prefersBorder: true,
            },
          },
        },
      ],
    }));
  resource('Tableau de bord', VIEWS.dashboard, () => dashboardView());
  resource('Entrée', VIEWS.entry, () => entryView());
  resource('Envoyer un fichier', VIEWS.upload, () => uploadView(), [new URL(ctx.publicUrl).origin]);
  resource('Document', VIEWS.document, () => documentView());
  registerDocuments(server, ctx);

  server.registerTool(
    'dashboard',
    {
      description: [
        'Draw figures as a dashboard, recomputed now: a saved one by `name` (an entry of kind',
        '« Tableau de bord » whose `data.widgets` lists { titre, requete, graphe }), or `widgets` given',
        'here to show once. `graphe`: « nombre » (one figure), « barres » (compare), « courbe »',
        '(over time, x sorted), « tableau ». Each `requete` is a `query` select. Hosts that show views',
        'draw it; the rows come back in words too.',
      ].join(' '),
      inputSchema: {
        name: z.string().min(1).optional(),
        title: z.string().max(120).optional(),
        widgets: z.array(widgetSchema).max(12).optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEWS.dashboard } },
    },
    async (args: {
      name?: string | undefined;
      title?: string | undefined;
      widgets?: z.input<typeof widgetSchema>[] | undefined;
    }) => {
      try {
        let title = args.title ?? 'Tableau de bord';
        let widgets = args.widgets ?? [];
        if (args.name) {
          const wanted = args.name;
          const saved = await ctx.act(async (tx) => {
            for (const space of ctx.reach) {
              const found = (
                await find(tx, space.id, { kind: 'Tableau de bord', text: wanted, limit: 5 })
              )[0];
              if (found) return found;
            }
            return null;
          });
          if (!saved)
            throw new Error(
              `No dashboard « ${wanted} »: save one first (kind « Tableau de bord »).`,
            );
          title = saved.title;
          widgets = widgetsOf(saved.data);
        }
        if (widgets.length === 0) throw new Error('Give `name` or `widgets`.');
        const drawn = await computeDashboard(ctx.db, ctx.person, {
          title,
          widgets,
          spaces: ctx.reach,
        });
        return answer(dashboardText(drawn), drawn as unknown as Record<string, unknown>);
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'show_entry',
    {
      description:
        'Show her one entry as a card: each field with where it comes from, its links both ways, its history — each change undoable from the card.',
      inputSchema: { id: z.string().min(1), space: z.string().min(1).optional() },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEWS.entry } },
    },
    async ({ id, space }: { id: string; space?: string | undefined }) => {
      try {
        const where = ctx.spaceOf(space);
        const shown = await ctx.act(async (tx) => ({
          entry: await get(tx, where.id, id),
          history: await history(tx, where.id, { target: id, limit: 20 }),
        }));
        if (!shown.entry) throw new Error(`No entry ${id} in this space.`);
        return answer(JSON.stringify(shown.entry, null, 2), {
          ...shown,
          space: where.name,
          spaceId: where.id,
        });
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'upload_link',
    {
      description: [
        `A link, valid ${UPLOAD_MINUTES} minutes, where files go straight into her life without passing`,
        'through the conversation: hosts that show views give her a drop zone; otherwise give her the',
        'link to open, or send a file yourself with `curl -F file=@<path> <link>`. Prefer it to',
        '`add_file` for any photo or document. `links`: what each new file is for (`to` an id, a `role`).',
      ].join(' '),
      inputSchema: {
        space: z.string().min(1).optional(),
        links: z
          .array(z.object({ to: z.string().min(1), role: z.string().min(1).max(80) }))
          .max(20)
          .optional(),
      },
      _meta: { ui: { resourceUri: VIEWS.upload } },
    },
    async ({
      space,
      links,
    }: {
      space?: string | undefined;
      links?: { to: string; role: string }[] | undefined;
    }) => {
      try {
        const where = ctx.spaceOf(space);
        const until = Date.now() + UPLOAD_MINUTES * 60_000;
        const token = uploadToken(
          { person: ctx.person, spaceId: where.id, links: links ?? [], until },
          ctx.secret,
        );
        const url = `${ctx.publicUrl.replace(/\/$/, '')}/upload/${token}`;
        const expiresAt = new Date(until).toISOString();
        return answer(
          JSON.stringify({
            url,
            expiresAt,
            space: where.name,
            send: `curl -F file=@<path> ${url}`,
          }),
          { url, expiresAt, space: where.name },
        );
      } catch (error) {
        return failed(error);
      }
    },
  );
}

/** Documents (spec 008): written and changed section by section, read in a view, downloaded. */
function registerDocuments(server: McpServer, ctx: ViewContext): void {
  const linkOf = (spaceId: string, id: string) =>
    `${ctx.publicUrl.replace(/\/$/, '')}/document/${documentToken(
      { person: ctx.person, spaceId, id, until: Date.now() + DOCUMENT_HOURS * 3_600_000 },
      ctx.secret,
    )}`;
  const written = (space: Space, result: { id: string; size: number; outline: unknown }) =>
    answer(JSON.stringify({ ...result, space: space.name, link: linkOf(space.id, result.id) }), {
      ...result,
      space: space.name,
    });

  server.registerTool(
    'write_document',
    {
      description: [
        'Write a new document in her life: a theory, a reflection, a review, a letter — Markdown in',
        '`text`, its kind in her words (« Théorie », « Réflexion », « Bilan »; « Document » by default).',
        'Write a long one in parts: its opening here, then `edit_document` (append), a section at a time.',
        'Returns its id, outline and a reading link (a page to read, print as PDF, or download as .md).',
      ].join(' '),
      inputSchema: {
        title: z.string().min(1).max(300),
        text: z.string().min(1).max(200_000),
        kind: z.string().min(1).max(80).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        links: z
          .array(z.object({ to: z.string().min(1), role: z.string().min(1).max(80) }))
          .max(20)
          .optional(),
        space: z.string().min(1).optional(),
      },
    },
    async (args: {
      title: string;
      text: string;
      kind?: string | undefined;
      data?: Record<string, unknown> | undefined;
      links?: { to: string; role: string }[] | undefined;
      space?: string | undefined;
    }) => {
      try {
        const where = ctx.spaceOf(args.space);
        const result = await ctx.act(async (tx) => {
          const made = await writeDocument(tx, ctx.actor, where.id, {
            title: args.title,
            text: args.text,
            ...(args.kind ? { kind: args.kind } : {}),
            ...(args.data ? { data: args.data } : {}),
          });
          if (args.links?.length) {
            await save(tx, ctx.actor, where.id, {
              links: args.links.map((link) => ({ from: made.id, ...link })),
            });
          }
          return made;
        });
        return written(where, result);
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'edit_document',
    {
      description: [
        'Change one document without sending it again: `append` (at the end, or of `section`),',
        '`replace_section` (the section named by its heading, heading included: give it again),',
        '`insert_after` (after `section`), `replace_text` (`find`, an exact passage, once), `replace_all`.',
        'Each change is a version she can go back from. Read its outline with `read_document` first.',
      ].join(' '),
      inputSchema: {
        id: z.string().min(1),
        action: z.enum([
          'append',
          'replace_section',
          'insert_after',
          'replace_text',
          'replace_all',
        ]),
        text: z.string().max(200_000),
        section: z.string().min(1).max(300).optional(),
        find: z.string().min(1).max(20_000).optional(),
        title: z.string().min(1).max(300).optional(),
        space: z.string().min(1).optional(),
      },
    },
    async (args: {
      id: string;
      action: DocumentEdit['action'];
      text: string;
      section?: string | undefined;
      find?: string | undefined;
      title?: string | undefined;
      space?: string | undefined;
    }) => {
      try {
        const where = ctx.spaceOf(args.space);
        const needs = (field: 'section' | 'find') => {
          const value = args[field];
          if (!value) throw new Error(`« ${args.action} » needs « ${field} ».`);
          return value;
        };
        const change: DocumentEdit =
          args.action === 'append'
            ? {
                action: 'append',
                text: args.text,
                ...(args.section ? { section: args.section } : {}),
              }
            : args.action === 'replace_text'
              ? { action: 'replace_text', find: needs('find'), text: args.text }
              : args.action === 'replace_all'
                ? { action: 'replace_all', text: args.text }
                : { action: args.action, section: needs('section'), text: args.text };
        const result = await ctx.act((tx) =>
          writeDocument(tx, ctx.actor, where.id, {
            id: args.id,
            edit: change,
            ...(args.title ? { title: args.title } : {}),
          }),
        );
        return written(where, result);
      } catch (error) {
        return failed(error);
      }
    },
  );

  server.registerTool(
    'read_document',
    {
      description: [
        'Read a document (any entry whose text is in `texte`): its outline always; its whole text when',
        'short or `whole`, else its opening — then ask the `sections` you need by their headings. Hosts',
        'that show views open it to read, with its versions and a reading link to print or download.',
      ].join(' '),
      inputSchema: {
        id: z.string().min(1),
        sections: z.array(z.string().min(1)).max(20).optional(),
        whole: z.boolean().optional(),
        space: z.string().min(1).optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEWS.document } },
    },
    async (args: {
      id: string;
      sections?: string[] | undefined;
      whole?: boolean | undefined;
      space?: string | undefined;
    }) => {
      try {
        const where = ctx.spaceOf(args.space);
        const read = await ctx.act((tx) =>
          readDocument(tx, where.id, {
            id: args.id,
            ...(args.sections?.length ? { sections: args.sections } : {}),
            ...(args.whole ? { whole: true } : {}),
          }),
        );
        const link = linkOf(where.id, args.id);
        const shown = documentShown(read, { space: where.name, spaceId: where.id, link });
        const { versions, ...said } = read;
        return answer(
          JSON.stringify({ ...said, versions: versions.length, link }),
          shown as unknown as Record<string, unknown>,
        );
      } catch (error) {
        return failed(error);
      }
    },
  );
}
