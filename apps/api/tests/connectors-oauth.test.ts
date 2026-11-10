import { serve, type ServerType } from '@hono/node-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { signUp, type Account } from './client';
import { connect, type Connected } from './connect';

// Spec 025, US4: a server that asks her to sign in. Jarvis registers itself, sends her to the
// server's page, takes the code back, keeps the tokens sealed, and then reaches the server.
let base = '';
let tools: ServerType;
const ACCESS = 'access-token-1';

function oauthServer() {
  const app = new Hono();
  const resource = () => ({ resource: `${base}/mcp`, authorization_servers: [base] });
  app.get('/.well-known/oauth-protected-resource', (c) => c.json(resource()));
  app.get('/.well-known/oauth-protected-resource/mcp', (c) => c.json(resource()));
  app.get('/.well-known/oauth-authorization-server', (c) =>
    c.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    }),
  );
  app.post('/register', async (c) =>
    c.json({ ...(await c.req.json()), client_id: 'jarvis-client' }, 201),
  );
  app.post('/token', async (c) => {
    const form = await c.req.parseBody();
    if (form.grant_type !== 'authorization_code' || form.code !== 'good-code') {
      return c.json({ error: 'invalid_grant' }, 400);
    }
    return c.json({ access_token: ACCESS, token_type: 'Bearer', expires_in: 3600 });
  });
  app.all('/mcp', async (c) => {
    if (c.req.header('authorization') !== `Bearer ${ACCESS}`) {
      return c.json({ error: 'invalid_token' }, 401, {
        'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
      });
    }
    const mcp = new McpServer({ name: 'calendar-server', version: '1.0.0' });
    mcp.registerTool(
      'next_events',
      {
        description: 'Her next events.',
        inputSchema: { days: z.number() },
        annotations: { readOnlyHint: true },
      },
      async ({ days }) => ({ content: [{ type: 'text', text: `Dentist in ${days} days.` }] }),
    );
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await mcp.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return app;
}

beforeAll(async () => {
  const app = oauthServer();
  await new Promise<void>((ready) => {
    tools = serve({ port: 0, fetch: app.fetch }, (info) => {
      base = `http://127.0.0.1:${info.port}`;
      ready();
    });
  });
});
afterAll(() => new Promise<void>((done) => tools.close(() => done())));

describe('a server that asks her to sign in', () => {
  let ama: Account;
  let claude: Connected;

  beforeAll(async () => {
    ama = await signUp('Ama');
    claude = await connect(ama);
  });

  it('waits for her sign-in, sends her to the server, and connects when she comes back', async () => {
    const made = await ama.json<{ id: string; state: string }>('/api/connectors', {
      name: 'Agenda',
      url: `${base}/mcp`,
      auth: 'oauth',
    });
    expect(made.body.state).toBe('needs_sign_in');

    const start = await ama.json<{ url: string }>(`/api/connectors/${made.body.id}/sign-in`, {});
    const page = new URL(start.body.url);
    expect(page.origin + page.pathname).toBe(`${base}/authorize`);
    expect(page.searchParams.get('client_id')).toBe('jarvis-client');
    expect(page.searchParams.get('code_challenge_method')).toBe('S256');
    const state = page.searchParams.get('state')!;
    expect(state.startsWith(`${made.body.id}.`)).toBe(true);

    // A code with another state is refused; hers is taken.
    const forged = await ama.call(
      `/api/connectors/callback?code=good-code&state=${made.body.id}.forged`,
    );
    expect(forged.status).not.toBe(302);
    const back = await ama.call(
      `/api/connectors/callback?code=good-code&state=${encodeURIComponent(state)}`,
    );
    expect(back.status).toBe(302);

    const listed =
      await ama.json<{ name: string; state: string; tools: { name: string }[] }[]>(
        '/api/connectors',
      );
    expect(listed.body.find((one) => one.name === 'Agenda')).toMatchObject({
      state: 'connected',
      tools: [{ name: 'next_events' }],
    });
    expect(JSON.stringify(listed.body)).not.toContain(ACCESS);

    const called = await claude.call<{ content: { text: string }[] }>('connector_call', {
      connector: 'Agenda',
      tool: 'next_events',
      arguments: { days: 3 },
    });
    expect(called.isError).toBe(false);
    expect(called.value.content[0]!.text).toBe('Dentist in 3 days.');
  });
});
