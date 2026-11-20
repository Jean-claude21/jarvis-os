import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    // One database, shared: the files run one after the other.
    fileParallelism: false,
    // Many accounts from one process, without a client address: attempts are counted in their own
    // proof (spec 024), not here.
    // Each check of health reads the database here: what a test changes shows at once.
    env: { JARVIS_RATE_LIMIT: 'off', JARVIS_HEALTH_CACHE_MS: '0' },
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
