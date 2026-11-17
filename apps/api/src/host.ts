import { serve } from '@hono/node-server';
import { pool } from '@jarvis-os/core';
import { makeApp } from './app';
import { deliveryFor } from './channels';
import { quiet, settingsFor, type Branch } from './settings';
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
