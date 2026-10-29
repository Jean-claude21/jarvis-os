import { required } from '@jarvis-os/core';

/** One Neon branch's environment: its database, its storage, its accounts' secret. */
export interface Settings {
  /** `jarvis_app`: cannot bypass row-level security. */
  appUrl: string;
  /** Where the server is reached from outside: links, OAuth, cookies. */
  publicUrl: string;
  authSecret: string;
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export type Branch = 'main' | 'dev' | 'test';

/** The settings of a branch, from `JARVIS_<BRANCH>_*` (written by `pnpm provision`). */
export function settingsFor(branch: Branch, publicUrl?: string): Settings {
  const key = (name: string) => required(`JARVIS_${branch.toUpperCase()}_${name}`);
  return {
    appUrl: key('APP_URL'),
    publicUrl: publicUrl ?? process.env.JARVIS_PUBLIC_URL ?? 'http://localhost:3700',
    authSecret: key('AUTH_SECRET'),
    storage: {
      endpoint: key('STORAGE_ENDPOINT'),
      region: key('STORAGE_REGION'),
      bucket: key('STORAGE_BUCKET'),
      accessKeyId: key('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: key('STORAGE_SECRET_ACCESS_KEY'),
    },
  };
}
