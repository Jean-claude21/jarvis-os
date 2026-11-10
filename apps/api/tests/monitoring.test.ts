import { describe, expect, it } from 'vitest';
import type { Delivery, Mailer } from '../src/channels';
import { healthOf } from '../src/health';
import { settingsFor } from '../src/settings';
import { watcherPass } from '../src/watcher';
import { PUBLIC_URL, server, signUp } from './client';

// Spec 023 through her account: a reminder that cannot leave ends « to fix » with its reason, in
// « Maintenant »; « Retry » sends it again. The server's health says when the watcher is late.
const sent: string[] = [];
let refusing = true;
const mailer: Mailer = {
  async send(mail) {
    if (refusing) throw new Error('mailbox unavailable');
    sent.push(mail.to);
  },
};
const delivery: Delivery = {
  mailer,
  publicUrl: PUBLIC_URL,
  secret: settingsFor('test').authSecret,
};
const minutes = (n: number) => new Date(Date.now() + n * 60_000);

describe('a reminder that cannot leave', () => {
  it('ends « to fix » with its reason, then leaves when she retries', async () => {
    const ama = await signUp('Ama');
    const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
      entries: [
        {
          kind: 'Reminder',
          title: 'Appeler le notaire',
          data: { at: '2026-11-09T07:00', timezone: 'UTC' },
        },
      ],
    });
    const id = saved.body.entries[0]!.id;
    // Entered and tried, then tried again after 1, 5 and 30 minutes: four failures.
    for (const at of [0, 2, 8, 40]) await watcherPass(server.db, delivery, minutes(at), 'trial');
    const entry = async () =>
      (await ama.json<{ data: { status?: string; error?: string } }>(`/api/entries/${id}`)).body
        .data;
    expect(await entry()).toMatchObject({
      status: 'failed',
      error: 'Pas envoyé par email : mailbox unavailable',
    });
    const now = await ama.json<{ items: { id: string; group: string; reason: string }[] }>(
      '/api/now',
    );
    expect(now.body.items).toContainEqual(
      expect.objectContaining({ id, group: 'fix', reason: 'error' }),
    );

    // « Retry », as the web app does it: planned again, the error cleared.
    refusing = false;
    await ama.json('/api/save', { entries: [{ id, data: { status: 'planned', error: null } }] });
    await watcherPass(server.db, delivery, minutes(41), 'trial');
    expect(sent).toContain(ama.email);
    expect((await entry()).status).toBe('sent');
  });
});

describe('the health of the server', () => {
  it('is healthy after a clean pass, and says when the watcher is late', async () => {
    refusing = false;
    await watcherPass(server.db, delivery, new Date(), 'trial');
    const now = await healthOf(server.db);
    expect(now.database).toBe(true);
    expect(now.watcher.late).toBe(false);
    const later = await healthOf(server.db, Date.now() + 10 * 60_000);
    expect(later).toMatchObject({ status: 'unhealthy', watcher: { late: true } });
    const answer = await server.app.request('/health');
    expect([200, 503]).toContain(answer.status);
    expect(Object.keys(await answer.json())).toEqual(['status', 'release', 'database', 'watcher']);
  });
});
