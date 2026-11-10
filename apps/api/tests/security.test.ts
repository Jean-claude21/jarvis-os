import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeAuth, signUpRuleOf } from '../src/auth';
import { settingsFor } from '../src/settings';
import { PUBLIC_URL, server, signUp } from './client';

// Spec 024: on invitation, an address no one invited cannot make an account; one allowed or invited
// can. Attempts are counted per client address: the sixth sign-in in a minute is refused.
const auth = makeAuth({
  db: server.db,
  secret: settingsFor('test').authSecret,
  publicUrl: PUBLIC_URL,
  signUp: { mode: 'invite', allow: ['@allowed.test'] },
  rateLimit: true,
});
const address = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
const tag = () => randomBytes(4).toString('hex');
const post = (path: string, body: unknown, ip = address()) =>
  auth.handler(
    new Request(`${PUBLIC_URL}/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: PUBLIC_URL, 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );
const join = (email: string) =>
  post('/sign-up/email', { email, name: 'Essai', password: 'correct-horse-battery' });

describe('sign-up on invitation', () => {
  it('refuses an address no one invited, and says why', async () => {
    const refused = await join(`stranger-${tag()}@elsewhere.test`);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'SIGN_UP_BY_INVITATION' });
  });

  it('lets in an address or a domain it allows', async () => {
    expect((await join(`friend-${tag()}@allowed.test`)).status).toBe(200);
  });

  it('lets in an address invited to a space', async () => {
    const ama = await signUp('Ama');
    const space = await ama.json<{ id: string }>('/api/spaces', { name: `Famille ${tag()}` });
    const invited = `kossi-${tag()}@elsewhere.test`;
    const made = await ama.json(`/api/spaces/${space.body.id}/invitations`, { email: invited });
    expect(made.status).toBe(201);
    expect((await join(invited.toUpperCase())).status).toBe(200);
  });

  it('is open unless JARVIS_SIGNUP says « invite »', () => {
    expect(signUpRuleOf({}).mode).toBe('open');
    expect(
      signUpRuleOf({ JARVIS_SIGNUP: 'invite', JARVIS_SIGNUP_ALLOW: 'A@x.test, @y.test' }),
    ).toEqual({
      mode: 'invite',
      allow: ['a@x.test', '@y.test'],
    });
  });
});

describe('attempts', () => {
  it('refuses the sixth sign-in in a minute from one address, not from another', async () => {
    const ip = address();
    const email = `friend-${tag()}@allowed.test`;
    const statuses: number[] = [];
    for (let n = 0; n < 6; n += 1) {
      statuses.push(
        (await post('/sign-in/email', { email, password: 'wrong-password-1' }, ip)).status,
      );
    }
    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect((await post('/sign-in/email', { email, password: 'wrong-password-1' })).status).not.toBe(
      429,
    );
  });
});
