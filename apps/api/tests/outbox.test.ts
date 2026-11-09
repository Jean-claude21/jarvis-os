import { beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_URL, server, signUp, type Account } from './client';
import type { Delivery, Mailer } from '../src/channels';
import { settingsFor } from '../src/settings';
import { giveLease, lastPass, takeLease } from '@jarvis-os/core';
import { watcherPass } from '../src/watcher';

// Spec 020 through her account: a reminder due is e-mailed to her once, with its action links; a
// link shows a page, its button acts once, a forged link is refused.
const mails: { to: string; subject: string; text: string; html: string }[] = [];
const mailer: Mailer = {
  async send(mail) {
    mails.push(mail);
  },
};
const delivery: Delivery = {
  mailer,
  publicUrl: PUBLIC_URL,
  secret: settingsFor('test').authSecret,
};

let ama: Account;
let reminder: string;

beforeAll(async () => {
  ama = await signUp('Ama');
  const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
    entries: [
      {
        kind: 'Reminder',
        title: 'Renouveler le passeport',
        data: { at: '2026-11-01T08:00', timezone: 'UTC', message: 'Il expire en mars.' },
      },
    ],
  });
  reminder = saved.body.entries[0]!.id;
});

const hers = () => mails.filter((mail) => mail.to === ama.email);
const linkOf = (text: string, word: string) =>
  new URL(
    text
      .split('\n')
      .find((line) => line.startsWith(word))!
      .split(' : ')[1]!,
  ).pathname;

describe('a reminder by e-mail', () => {
  it('is sent once, with its four actions, and leaves its trace', async () => {
    await watcherPass(server.db, delivery, new Date(Date.now() + 5_000));
    await watcherPass(server.db, delivery, new Date(Date.now() + 10_000));
    expect(hers()).toHaveLength(1);
    const [mail] = hers();
    expect(mail!.subject).toBe('Renouveler le passeport');
    expect(mail!.text).toContain('Il expire en mars.');
    expect(mail!.text.match(/\/act\//g)).toHaveLength(4);
    const trace =
      await ama.json<{ channel: string; state: string; subject: string }[]>('/api/outbox');
    expect(trace.body).toEqual([
      expect.objectContaining({
        channel: 'email',
        state: 'sent',
        subject: 'Renouveler le passeport',
      }),
    ]);
  });

  it('acts from its link once: a page first, then the button', async () => {
    const path = linkOf(hers()[0]!.text, 'C’est fait');
    const page = await server.app.request(path);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('method="post"');
    const entry = async () =>
      (await ama.json<{ data: { status?: string } }>(`/api/entries/${reminder}`)).body.data.status;
    expect(await entry()).toBe('sent');
    const done = await server.app.request(path, { method: 'POST' });
    expect(done.status).toBe(200);
    expect(await entry()).toBe('done');
    const again = await server.app.request(linkOf(hers()[0]!.text, 'Demain'), { method: 'POST' });
    expect(await again.text()).toContain('déjà');
    expect(await entry()).toBe('done');
  });

  it('refuses a forged link', async () => {
    const path = linkOf(hers()[0]!.text, 'C’est fait');
    const forged = `${path.slice(0, -3)}abc`;
    expect((await server.app.request(forged)).status).toBe(410);
    expect((await server.app.request(forged, { method: 'POST' })).status).toBe(410);
  });
});

// Spec 021: while one watcher holds the database's lease, another one's pass is skipped; then it runs,
// and its trace is kept.
describe('one watcher at a time', () => {
  it('skips a pass while another watcher holds the lease, then runs it', async () => {
    expect(await takeLease(server.db, 'watcher', 'laptop:1')).toBe(true);
    expect(await watcherPass(server.db, delivery, new Date(), 'netlify:2')).toBeNull();
    expect(await lastPass(server.db, 'watcher')).toMatchObject({
      holder: 'laptop:1',
      endedAt: null,
    });
    await giveLease(server.db, 'watcher', 'laptop:1', { report: {} });
    expect(await watcherPass(server.db, delivery, new Date(), 'netlify:2')).not.toBeNull();
    const last = await lastPass(server.db, 'watcher');
    expect(last).toMatchObject({ holder: 'netlify:2', error: null });
    expect(last?.report).toMatchObject({ reminders: { failed: 0 }, rules: expect.any(Object) });
    expect(last?.endedAt).toBeInstanceOf(Date);
  });
});
