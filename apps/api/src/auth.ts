import { asPerson, createSpace } from '@jarvis-os/core';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import type pg from 'pg';

/**
 * Accounts (spec 002): e-mail and password, sessions by cookie or bearer token. Each new account
 * gets its life at once: a space it owns.
 */
export function makeAuth(input: {
  db: pg.Pool;
  secret: string;
  publicUrl: string;
  /** Silent while the migration itself makes the tables it would report missing. */
  quiet?: boolean;
}) {
  return betterAuth({
    database: input.db,
    ...(input.quiet ? { logger: { disabled: true } } : {}),
    secret: input.secret,
    baseURL: input.publicUrl,
    basePath: '/auth',
    trustedOrigins: [input.publicUrl],
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 10 },
    plugins: [bearer()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await asPerson(input.db, user.id, (tx) =>
              createSpace(tx, { person: user.id, name: user.name }),
            );
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof makeAuth>;
