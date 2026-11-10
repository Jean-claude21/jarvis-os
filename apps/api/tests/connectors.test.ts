import { serve, type ServerType } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { required } from '@jarvis-os/core';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 025 through her account and Claude: another MCP server, started here and asking for a key,
// connected to her space; its tools listed and called through Jarvis; a tool that deletes needs her
// yes; every call journaled; the key never shown, and forgotten when the connector is cut.
const KEY = 'test-key-for-the-notes-server';
let notes: ServerType;
let url: string;
const deleted: string[] = [];

function notesServer() {
  const mcp = new McpServer({ name: 'notes-server', version: '1.0.0' });
  mcp.registerTool(
    'read_note',
    {
      description: 'Read a note by its title.',
      inputSchema: { title: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ title }) => ({ content: [{ type: 'text', text: `Note « ${title} »: buy rice.` }] }),
  );
  mcp.registerTool(
    'delete_note',
    {
      description: 'Delete a note.',
      inputSchema: { title: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ title }) => {
      deleted.push(title);
      return { content: [{ type: 'text', text: `Deleted « ${title} ».` }] };
    },
  );
  return mcp;
}

beforeAll(async () => {
  await new Promise<void>((ready) => {
    notes = serve(
      {
        port: 0,
        fetch: async (request) => {
          if (request.headers.get('authorization') !== `Bearer ${KEY}`) {
            return Response.json({ error: 'invalid_token' }, { status: 401 });
          }
          const transport = new WebStandardStreamableHTTPServerTransport({
            enableJsonResponse: true,
          });
          await notesServer().connect(transport);
          return transport.handleRequest(request);
        },
      },
      (info) => {
        url = `http://127.0.0.1:${info.port}/mcp`;
        ready();
      },
    );
  });
});
afterAll(() => new Promise<void>((done) => notes.close(() => done())));

let ama: Account;
let claude: Connected;
let id: string;

describe('her connectors', () => {
  beforeAll(async () => {
    ama = await signUp('Ama');
    claude = await connect(ama);
  });

  it('says « refused » with a wrong key, « connected » with hers, and never shows it', async () => {
    const wrong = await ama.json<{ state: string; reason: string }>('/api/connectors', {
      name: 'Bad notes',
      url,
      auth: 'bearer',
      secret: 'not-the-key',
    });
    expect(wrong.status).toBe(201);
    expect(wrong.body.state).toBe('refused');

    const made = await ama.json<{
      id: string;
      state: string;
      serverName: string;
      tools: { name: string }[];
    }>('/api/connectors', { name: 'Notes', url, auth: 'bearer', secret: KEY });
    expect(made.body).toMatchObject({ state: 'connected', serverName: 'notes-server' });
    expect(made.body.tools.map((one) => one.name).sort()).toEqual(['delete_note', 'read_note']);
    id = made.body.id;
    const listed = await ama.call('/api/connectors');
    expect(await listed.text()).not.toContain(KEY);
  });

  it('gives Claude her connectors, and calls a tool through Jarvis', async () => {
    const found =
      await claude.call<{ name: string; tools: { name: string; needsHerYes: boolean }[] }[]>(
        'connectors',
      );
    const mine = found.value.find((one) => one.name === 'Notes')!;
    expect(mine.tools).toContainEqual({
      name: 'delete_note',
      needsHerYes: true,
      description: 'Delete a note.',
      parameters: expect.any(Object),
    });
    const read = await claude.call<{ from: string; content: { text: string }[] }>(
      'connector_call',
      {
        connector: 'Notes',
        tool: 'read_note',
        arguments: { title: 'Courses' },
      },
    );
    expect(read.isError).toBe(false);
    expect(read.value.from).toBe('Notes');
    expect(read.value.content[0]!.text).toContain('buy rice');
  });

  it('asks for her yes before a tool that deletes, and journals each call without its content', async () => {
    const refused = await claude.call<{ error: string }>('connector_call', {
      connector: 'Notes',
      tool: 'delete_note',
      arguments: { title: 'Courses' },
    });
    expect(refused.isError).toBe(true);
    expect(refused.value.error).toContain('ask her first');
    expect(deleted).toEqual([]);
    const done = await claude.call('connector_call', {
      connector: 'Notes',
      tool: 'delete_note',
      arguments: { title: 'Courses' },
      agreed: true,
    });
    expect(done.isError).toBe(false);
    expect(deleted).toEqual(['Courses']);
    const journal = await ama.json<{ command: string; after: Record<string, unknown> }[]>(
      `/api/history?target=${id}`,
    );
    const calls = journal.body.filter((line) => line.command === 'connector.call');
    expect(calls.map((line) => line.after)).toEqual(
      expect.arrayContaining([
        { connector: 'Notes', tool: 'read_note', ok: true, agreed: false },
        { connector: 'Notes', tool: 'delete_note', ok: true, agreed: true },
      ]),
    );
    expect(JSON.stringify(journal.body)).not.toContain('Courses');
    expect(JSON.stringify(journal.body)).not.toContain(KEY);
  });

  it('forgets the key when she cuts the connector', async () => {
    expect((await ama.json(`/api/connectors/${id}`, undefined, 'DELETE')).status).toBe(200);
    const owner = new pg.Client({ connectionString: required('JARVIS_TEST_OWNER_URL') });
    await owner.connect();
    const { rows } = await owner.query('select count(*)::int as n from connector where id = $1', [
      id,
    ]);
    await owner.end();
    expect(rows[0].n).toBe(0);
    const left = await ama.json<{ name: string }[]>('/api/connectors');
    expect(left.body.map((one) => one.name)).toEqual(['Bad notes']);
  });
});
