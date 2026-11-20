import { defineConfig } from '@playwright/test';

// Jarvis OS v3 end to end: the real client, served by the real server, on the test database. Each
// test signs up an account of its own. Three widths: a wide screen, a tablet, a phone (R3).
// On a laptop the installed Edge is used (nothing downloaded); on CI, the runner's Chromium.

const PORT = 3711;
export const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    ...(process.env.CI ? {} : { channel: 'msedge' }),
  },
  projects: [
    { name: 'large', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
  webServer: {
    // The client built, then the server on the test branch: no watcher, nothing sent outside.
    // The database migrated first: the server checks the accounts' tables as it starts.
    command:
      'pnpm exec tsx migrate.ts && pnpm --filter @jarvis-os/web build && pnpm --filter @jarvis-os/api exec tsx src/server.ts',
    url: `${BASE}/alive`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      JARVIS_BRANCH: 'test',
      PORT: String(PORT),
      JARVIS_PUBLIC_URL: BASE,
      JARVIS_HOME: '/v3',
      JARVIS_RATE_LIMIT: 'off',
      JARVIS_SIDE_EFFECTS: 'off',
      JARVIS_HEALTH_CACHE_MS: '0',
    },
  },
});
