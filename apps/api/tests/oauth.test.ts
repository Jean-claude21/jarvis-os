import { serve, type ServerType } from '@hono/node-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp } from '../src/app';
import { settingsFor } from '../src/settings';

// Spec 003, story 1: an MCP client connects to her life the way Claude does — 401 challenge,
// discovery, registration, sign-in on Jarvis's page, consent, token — then uses the tools over
// HTTP. A real server, listening; no shortcut.

const PORT = 3791;
const BASE = `http://localhost:${PORT}`;
const REDIRECT = 'http://127.0.0.1:9999/callback';
const jarvis = makeApp(settingsFor('test', BASE));
let listening: ServerType;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    listening = serve({ fetch: jarvis.app.fetch, port: PORT }, () => resolve());
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => listening.close(() => resolve()));
  await jarvis.close();
});

/** A browser's cookies, kept between requests. */
class Browser {
  private cookies = new Map<string, string>();
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      redirect: 'manual',
      ...init,
      headers: {
        // A page the browser navigates to asks for HTML, without an Origin, and is redirected; a
        // script's request carries its Origin and asks for JSON.
        ...(init.method === 'POST'
          ? { origin: BASE, accept: 'application/json' }
          : { accept: 'text/html', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }),
        ...(this.cookies.size
          ? { cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') }
          : {}),
        ...init.headers,
      },
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, ...value] = pair!.split('=');
      this.cookies.set(name!.trim(), value.join('='));
    }
    return response;
  }
  post(url: string, body: unknown) {
    return this.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}

/**
 * Where the server sends the browser next: a 302's location, or the `{ url }` it answers when it
 * cannot tell a navigation (Node's fetch sets its own `sec-fetch-mode`).
 */
async function next(response: Response): Promise<URL> {
  if (response.status === 302) return new URL(response.headers.get('location')!, BASE);
  expect(response.status).toBe(200);
  return new URL(((await response.json()) as { url: string }).url, BASE);
}

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const email = `ama-${randomBytes(4).toString('hex')}@jarvis.test`;
const password = 'correct-horse-battery';

let authServer: Record<string, string>;
let clientId: string;

const authorizeUrl = () => {
  const url = new URL(authServer.authorization_endpoint!);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'openid profile offline_access',
    state: 'state-42',
    resource: `${BASE}/mcp`,
  }).toString();
  return url.toString();
};

describe('connecting a client to her life (story 1)', () => {
  it('answers /mcp without a token with the challenge that leads to discovery', async () => {
    const response = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
    const header = response.headers.get('www-authenticate') ?? '';
    const metadataUrl = /resource_metadata="([^"]+)"/.exec(header)?.[1];
    expect(metadataUrl).toBe(`${BASE}/.well-known/oauth-protected-resource/mcp`);

    const resource = (await (await fetch(metadataUrl!)).json()) as {
      resource: string;
      authorization_servers: string[];
    };
    expect(resource.resource).toBe(`${BASE}/mcp`);
    const issuer = new URL(resource.authorization_servers[0]!);
    authServer = (await (
      await fetch(`${issuer.origin}/.well-known/oauth-authorization-server${issuer.pathname}`)
    ).json()) as Record<string, string>;
    expect(authServer.registration_endpoint).toBe(`${BASE}/auth/oauth2/register`);
  });

  it('registers the client, as Claude does', async () => {
    const response = await fetch(authServer.registration_endpoint!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude (test)',
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
    });
    expect(response.status).toBe(201);
    clientId = ((await response.json()) as { client_id: string }).client_id;
    expect(clientId).toBeTruthy();
  });

  it('sends her through Jarvis’s sign-in and consent, then gives a token that opens the tools', async () => {
    const browser = new Browser();
    // Her account exists; she is not signed in in this browser.
    await new Browser().post(`${BASE}/auth/sign-up/email`, { email, password, name: 'Ama' });

    const signInUrl = await next(await browser.fetch(authorizeUrl()));
    expect(signInUrl.pathname).toBe('/connexion');
    const page = await (
      await browser.fetch(signInUrl.toString(), { headers: { 'accept-language': 'fr' } })
    ).text();
    expect(page).toContain('Claude (test)');

    const signedIn = await browser.post(`${BASE}/auth/sign-in/email`, {
      email,
      password,
      oauth_query: signInUrl.search.slice(1),
    });
    const toConsent = await next(signedIn);
    expect(toConsent.pathname).toBe('/consentement');
    const consent = await (
      await browser.fetch(toConsent.toString(), { headers: { 'accept-language': 'en' } })
    ).text();
    expect(consent).toContain('Allow Claude (test)?');

    const accepted = await browser.post(`${BASE}/auth/oauth2/consent`, {
      accept: true,
      oauth_query: toConsent.search.slice(1),
    });
    const back = await next(accepted);
    expect(`${back.origin}${back.pathname}`).toBe(REDIRECT);
    expect(back.searchParams.get('state')).toBe('state-42');
    const code = back.searchParams.get('code')!;

    const tokenResponse = await fetch(authServer.token_endpoint!, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${BASE}/mcp`,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    const client = new Client({ name: 'claude-test', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${tokens.access_token}` } },
      }),
    );
    expect(client.getInstructions()).toContain('Ama');
    const saved = (await client.callTool({
      name: 'save',
      arguments: { entries: [{ kind: 'Dépense', title: 'Taxi', data: { montant: 2000 } }] },
    })) as { content: { text: string }[]; isError?: boolean };
    expect(saved.isError).toBeFalsy();
    const lines = (await client.callTool({ name: 'history', arguments: { limit: 1 } })) as {
      content: { text: string }[];
    };
    expect(JSON.parse(lines.content[0]!.text)[0]).toMatchObject({
      door: 'mcp',
      client: 'Claude (test)',
    });
    await client.close();

    // Refusing gives the client no code.
    const location = await next(await browser.fetch(authorizeUrl()));
    if (location.pathname === '/consentement') {
      const refused = await browser.post(`${BASE}/auth/oauth2/consent`, {
        accept: false,
        oauth_query: location.search.slice(1),
      });
      const denied = await next(refused);
      expect(denied.searchParams.get('code')).toBeNull();
      expect(denied.searchParams.get('error')).toBe('access_denied');
    } else {
      // Consent already given is remembered: straight back to the client with a code.
      expect(`${location.origin}${location.pathname}`).toBe(REDIRECT);
    }
  });

  it('refuses a forged token', async () => {
    const response = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer not.a.token',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
  });
});
