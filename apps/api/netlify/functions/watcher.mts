// The watcher on Netlify (spec 010): one pass each minute — reminders, Telegram links, morning
// briefs, scheduled rules — the same pass as the local loop (`watcherPass`).
import { pool } from '@jarvis-os/core';
import { settingsFor, type Branch } from '../../src/settings';
import { watcherPass } from '../../src/watcher';

const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
const db = pool(settingsFor(branch).appUrl);

export default async () => {
  const report = await watcherPass(db, process.env.JARVIS_TELEGRAM_BOT_TOKEN);
  console.info('[watcher] pass', report ? JSON.stringify(report) : 'failed');
};

export const config = { schedule: '* * * * *' };
