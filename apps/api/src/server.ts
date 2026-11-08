import { serve } from '@hono/node-server';
import { makeApp } from './app';
import { settingsFor, type Branch } from './settings';

// `pnpm dev`: the dev branch on port 3700; a deployed server sets JARVIS_BRANCH and its variables.
const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
const port = Number(process.env.PORT ?? 3700);
const { app } = makeApp(
  settingsFor(branch, process.env.JARVIS_PUBLIC_URL ?? `http://localhost:${port}`),
);
serve({ fetch: app.fetch, port }, () => console.info(`Jarvis OS (${branch}) on port ${port}`));
