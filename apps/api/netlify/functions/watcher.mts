// The watcher on Netlify (specs 010, 020): one pass each minute — reminders and briefs entered in
// the outbox, the outbox delivered (Telegram, e-mail), Telegram links, scheduled rules — the same
// pass as the local loop (`watcherPass`).
import { pool } from '@jarvis-os/core';
import { deliveryFor } from '../../src/channels';
import { settingsFor, type Branch } from '../../src/settings';
import { watcherPass } from '../../src/watcher';

const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
const settings = settingsFor(branch, process.env.JARVIS_PUBLIC_URL);
const db = pool(settings.appUrl);
const delivery = deliveryFor(settings);

export default async () => {
  const report = await watcherPass(db, delivery);
  console.info('[watcher] pass', report ? JSON.stringify(report) : 'failed');
};

export const config = { schedule: '* * * * *' };
