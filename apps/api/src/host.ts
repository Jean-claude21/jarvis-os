import { serve } from '@hono/node-server';
import { pool } from '@jarvis-os/core';
import { makeApp } from './app';
import { deliveryFor } from './channels';
import { quiet, settingsFor, type Branch } from './settings';
import { connectorService } from './connector-service';
import { secretsKey } from './secrets';
import { watch } from './watcher';

// Jarvis OS on a server of its own (Coolify, Docker): the app and its watcher in one process —
// the same app as `pnpm dev`, and the same pass each minute as Netlify's scheduled function. A
// second host (Netlify while both run) is harmless: the watcher's lease lets one pass at a time.
const branch = (process.env.JARVIS_BRANCH ?? 'main') as Branch;
const port = Number(process.env.PORT ?? 3000);
const settings = settingsFor(branch, process.env.JARVIS_PUBLIC_URL);
const { app } = makeApp(settings);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () =>
  console.info(`Jarvis OS (${branch}) on port ${port} for ${settings.publicUrl}`),
);

const db = pool(settings.appUrl);
const stop = new AbortController();
// A quiet copy (next) never runs the watcher: its reminders, messages and collecting are the real
// ones' copies, and would reach real people twice.
// The daily check of her connections (v3 D16): what stopped answering shows in « À régler ».
const connections = connectorService({
  db,
  key: secretsKey(settings.authSecret),
  publicUrl: settings.publicUrl,
});
const checkConnections = async () => {
  const { rows } = await db.query<{ id: string; person: string }>(
    "select id, person from jarvis_connections_due(interval '1 day')",
  );
  let failed = 0;
  for (const row of rows)
    await connections.check(row.person, row.id).catch(() => {
      failed += 1;
    });
  if (rows.length) console.info('[health]', JSON.stringify({ checked: rows.length, failed }));
  // The calendars she follows, read again (v3 D16).
  const { rows: sources } = await db.query<{ id: string; person: string }>(
    'select id, person from jarvis_ics_sources()',
  );
  for (const row of sources)
    await connections.relay
      .syncIcs(row.person, row.id)
      .catch((error) => console.warn('[sources]', row.id, (error as Error).message));
};
if (!quiet()) {
  // Every six hours, not each hour: each look wakes the database (rest for the database).
  const hourly = setInterval(() => void checkConnections().catch(() => undefined), 6 * 3_600_000);
  setTimeout(() => void checkConnections().catch(() => undefined), 60_000);
  stop.signal.addEventListener('abort', () => clearInterval(hourly));
}
if (quiet()) console.info('[watcher] side effects off: the watcher does not run');
else
  watch(
    db,
    deliveryFor(settings),
    (report) => console.info('[watcher]', JSON.stringify(report)),
    stop.signal,
  );
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    stop.abort();
    void db.end().finally(() => process.exit(0));
  });
