import { mcp } from '@better-auth/mcp';
import { asPerson, createSpace } from '@jarvis-os/core';
import { betterAuth } from 'better-auth';
import { bearer, jwt } from 'better-auth/plugins';
import type pg from 'pg';

/** The paths of Jarvis's own sign-in and consent pages (spec 003). */
export const SIGN_IN_PAGE = '/connexion';
export const CONSENT_PAGE = '/consentement';

/**
 * Accounts (spec 002): e-mail and password, sessions by cookie or bearer token; each new account
 * gets its life at once, a space it owns. The OAuth server of the MCP resource (spec 003): clients
 * such as Claude register, send her through sign-in and consent, and receive tokens bound to
 * `<publicUrl>/mcp`.
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
    // The JWT plugin signs the access tokens; its own session-to-JWT endpoint is not needed.
    disabledPaths: ['/token'],
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 10 },
    plugins: [
      bearer(),
      jwt(),
      mcp({
        resource: mcpResource(input.publicUrl),
        loginPage: SIGN_IN_PAGE,
        consentPage: CONSENT_PAGE,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Clients that do not say what they are (Claude Code, desktop apps) are inferred from their
        // redirect address: a loopback one is a native application, allowed over http.
        clientRegistrationDefaultApplicationType: 'infer',
      }),
    ],
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

/** The MCP protected resource: tokens are bound to it. */
export const mcpResource = (publicUrl: string) => `${publicUrl.replace(/\/$/, '')}/mcp`;

export type Auth = ReturnType<typeof makeAuth>;
