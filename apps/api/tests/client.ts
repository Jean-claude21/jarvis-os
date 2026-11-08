import { randomBytes } from 'node:crypto';
import { afterAll } from 'vitest';
import { makeApp } from '../src/app';
import { settingsFor } from '../src/settings';

export const PUBLIC_URL = 'http://localhost:3700';

/** The server, in process, on the Neon `test` branch and its storage. */
export const server = makeApp(settingsFor('test', PUBLIC_URL));
afterAll(() => server.close());

export interface Account {
  email: string;
  token: string;
  /** A request as her, with her bearer token. */
  call: (path: string, init?: RequestInit) => Promise<Response>;
  json: <T = unknown>(
    path: string,
    body?: unknown,
    method?: string,
  ) => Promise<{ status: number; body: T }>;
}

/** A person of this run: signed up, signed in, her token in hand. */
export async function signUp(name: string): Promise<Account> {
  const email = `${name.toLowerCase()}-${randomBytes(4).toString('hex')}@jarvis.test`;
  const response = await server.app.request('/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: PUBLIC_URL },
    body: JSON.stringify({ email, name, password: 'correct-horse-battery' }),
  });
  if (response.status !== 200) throw new Error(`Sign-up failed: ${await response.text()}`);
  const token = response.headers.get('set-auth-token');
  if (!token) throw new Error('No bearer token after sign-up.');
  const call = async (path: string, init: RequestInit = {}) =>
    server.app.request(path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, origin: PUBLIC_URL, ...init.headers },
    });
  const json = async <T>(
    path: string,
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
  ) => {
    const response = await call(path, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
    });
    return { status: response.status, body: (await response.json()) as T };
  };
  return { email, token, call, json };
}
