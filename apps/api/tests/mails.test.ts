import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { makeApp } from '../src/app';
import type { Mailer } from '../src/mail';
import { settingsFor } from '../src/settings';
const PUBLIC_URL = 'http://localhost:3700';

// v3 mails: a forgotten password by e-mail, end to end; an invitation into a space mailed to the
// invited address; the owners told who joined. The mailer here keeps what would leave.
const sent: Parameters<Mailer['send']>[0][] = [];
const mailer: Mailer = {
  async send(mail) {
    sent.push(mail);
  },
};
const server = makeApp(settingsFor('test', PUBLIC_URL), { mailer });
afterAll(() => server.close());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  server.app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: PUBLIC_URL, ...headers },
    body: JSON.stringify(body),
  });

async function account(
  name: string,
  email = `${name.toLowerCase()}-${randomBytes(4).toString('hex')}@jarvis.test`,
) {
  const response = await post('/auth/sign-up/email', {
    email,
    name,
    password: 'correct-horse-battery',
  });
  expect(response.status).toBe(200);
  const token = response.headers.get('set-auth-token')!;
  const as = (path: string, body?: unknown) =>
    server.app.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        origin: PUBLIC_URL,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { email, as };
}

const mailTo = (email: string) => sent.filter((one) => one.to === email);

describe('mails', () => {
  it('sends a link for a forgotten password; the link changes it once', async () => {
    const ama = await account('Ama');
    const asked = await post('/auth/request-password-reset', {
      email: ama.email,
      redirectTo: `${PUBLIC_URL}/mot-de-passe`,
    });
    expect(asked.status).toBe(200);
    // better-auth may send in the background: the mail is there shortly.
    for (let tries = 0; tries < 20 && !mailTo(ama.email).length; tries += 1)
      await new Promise((done) => setTimeout(done, 50));
    const [mail] = mailTo(ama.email);
    expect(mail?.subject).toBe('Ton nouveau mot de passe Jarvis');
    expect(mail?.html).toContain('Choisir un nouveau mot de passe');
    const link = /(http[^\s]+\/auth\/reset-password\/[^\s]+)/.exec(mail!.text)?.[1];
    expect(link).toBeTruthy();

    // The link lands on Jarvis's page with its token.
    const landing = await server.app.request(link!.replace(PUBLIC_URL, ''));
    expect(landing.status).toBe(302);
    const to = new URL(landing.headers.get('location')!, PUBLIC_URL);
    expect(to.pathname).toBe('/mot-de-passe');
    const token = to.searchParams.get('token')!;
    expect((await server.app.request('/mot-de-passe')).status).toBe(200);

    expect(
      (await post('/auth/reset-password', { newPassword: 'a-new-long-password', token })).status,
    ).toBe(200);
    expect(
      (await post('/auth/sign-in/email', { email: ama.email, password: 'correct-horse-battery' }))
        .status,
    ).toBe(401);
    expect(
      (await post('/auth/sign-in/email', { email: ama.email, password: 'a-new-long-password' }))
        .status,
    ).toBe(200);
    // Once only.
    expect(
      (await post('/auth/reset-password', { newPassword: 'another-long-one', token })).status,
    ).not.toBe(200);
  });

  it('never says whether an address has an account', async () => {
    const before = sent.length;
    const asked = await post('/auth/request-password-reset', {
      email: 'nobody-here@jarvis.test',
      redirectTo: `${PUBLIC_URL}/mot-de-passe`,
    });
    expect(asked.status).toBe(200);
    expect(sent.length).toBe(before);
    expect((await server.app.request('/mot-de-passe-oublie')).status).toBe(200);
  });

  it('mails the invitation, then tells the owner who joined', async () => {
    const ama = await account('Ama');
    const kossiMail = `kossi-${randomBytes(4).toString('hex')}@jarvis.test`;
    const made = (await (await ama.as('/api/spaces', { name: 'Maison' })).json()) as {
      id: string;
    };
    const invited = (await (
      await ama.as(`/api/spaces/${made.id}/invitations`, { email: kossiMail })
    ).json()) as { link: string; mailed: boolean };
    expect(invited.mailed).toBe(true);
    const [invitation] = mailTo(kossiMail);
    expect(invitation?.subject).toBe('Ama t’invite dans « Maison » sur Jarvis');
    expect(invitation?.text).toContain(invited.link);

    const kossi = await account('Kossi', kossiMail);
    const joined = await kossi.as('/api/invitations/accept', {
      token: invited.link.slice(invited.link.indexOf('#') + 1),
    });
    expect(joined.status).toBe(200);
    const [told] = mailTo(ama.email);
    expect(told?.subject).toBe('Kossi a rejoint « Maison »');
    expect(told?.text).toContain(kossiMail);
  });
});
