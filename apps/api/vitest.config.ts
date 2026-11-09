import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    // One Neon branch, shared: the files run one after the other.
    fileParallelism: false,
    // Many accounts from one process, without a client address: attempts are counted in their own
    // proof (spec 024), not here.
    env: { JARVIS_RATE_LIMIT: 'off' },
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
