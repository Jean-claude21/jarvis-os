// The watcher on Netlify (specs 010, 020): one pass each minute — reminders and briefs entered in
// the outbox, the outbox delivered (Telegram, e-mail), Telegram links, scheduled rules — the same
// pass as the local loop (`watcherPass`).
import { pool, setCallOut } from '@jarvis-os/core';
import { deliveryFor } from '../../src/channels';
import { connectorService } from '../../src/connector-service';
import { secretsKey } from '../../src/secrets';
import { settingsFor, type Branch } from '../../src/settings';
import { watcherPass } from '../../src/watcher';

const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
const settings = settingsFor(branch, process.env.JARVIS_PUBLIC_URL);
const db = pool(settings.appUrl);
const delivery = deliveryFor(settings);
// Her scheduled rules may call her connections (spec 050).
setCallOut(
  connectorService({ db, key: secretsKey(settings.authSecret), publicUrl: settings.publicUrl })
    .callOut,
);

export default async () => {
  // The site's own server kept awake: a sleeping one takes seconds to start for her first click.
  const awake = fetch(`${settings.publicUrl.replace(/\/$/, '')}/health`).catch(() => undefined);
  const report = await watcherPass(db, delivery);
  await awake;
  console.info('[watcher] pass', report ? JSON.stringify(report) : 'failed');
};

export const config = { schedule: '* * * * *' };
