import { afterAll, describe, expect, it } from 'vitest';
import { makeApp } from '../src/app';
import { googleOf } from '../src/auth';
import { settingsFor } from '../src/settings';
import { PUBLIC_URL, server } from './client';

// Signing in with Google: offered only when Jarvis has its Google client; one gesture sends her to
// Google and back to Jarvis's own address. The invitation rule stays the database hook's.

const withGoogle = (() => {
  const before = { ...process.env };
  process.env.JARVIS_GOOGLE_CLIENT_ID = 'jarvis-test.apps.googleusercontent.com';
  process.env.JARVIS_GOOGLE_CLIENT_SECRET = 'not-a-real-secret';
  const made = makeApp(settingsFor('test', PUBLIC_URL));
  process.env = before;
  return made;
})();
afterAll(() => withGoogle.close());

describe('Google', () => {
  it('reads its client from the settings, or none', () => {
    expect(googleOf({})).toBeNull();
    expect(googleOf({ JARVIS_GOOGLE_CLIENT_ID: 'a', JARVIS_GOOGLE_CLIENT_SECRET: ' ' })).toBeNull();
    expect(googleOf({ JARVIS_GOOGLE_CLIENT_ID: 'a', JARVIS_GOOGLE_CLIENT_SECRET: 'b' })).toEqual({
      clientId: 'a',
      clientSecret: 'b',
    });
  });

  it('is offered on the sign-in page only when Jarvis has a client', async () => {
    const plain = await (await server.app.request('/connexion')).text();
    expect(plain).not.toContain('Continuer avec Google');
    const page = await (
      await withGoogle.app.request('/connexion', { headers: { 'accept-language': 'fr' } })
    ).text();
    expect(page).toContain('Continuer avec Google');
  });

  it('sends her to Google, to come back to Jarvis', async () => {
    const response = await withGoogle.app.request('/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: PUBLIC_URL },
      body: JSON.stringify({ provider: 'google', callbackURL: '/v3/' }),
    });
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    const google = new URL(url);
    expect(google.host).toBe('accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe('jarvis-test.apps.googleusercontent.com');
    expect(google.searchParams.get('redirect_uri')).toBe(`${PUBLIC_URL}/auth/callback/google`);
    expect(google.searchParams.get('prompt')).toBe('select_account');
  });
});
