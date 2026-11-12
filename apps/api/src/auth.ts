import { mcp } from '@better-auth/mcp';
import { asPerson, createSpace } from '@jarvis-os/core';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { bearer, jwt } from 'better-auth/plugins';
import type pg from 'pg';

/** The paths of Jarvis's own sign-in and consent pages (spec 003). */
export const SIGN_IN_PAGE = '/connexion';
export const CONSENT_PAGE = '/consentement';

/**
 * Who may make an account (spec 024): « open », anyone; « invite », an address invited to a space
 * and not answered yet, or one `allow` names (an address, or « @domain »).
 */
export interface SignUpRule {
  mode: 'open' | 'invite';
  allow: string[];
}

/** The rule from `JARVIS_SIGNUP` (open by default) and `JARVIS_SIGNUP_ALLOW` (comma-separated). */
export function signUpRuleOf(env: NodeJS.ProcessEnv = process.env): SignUpRule {
  return {
    mode: env.JARVIS_SIGNUP === 'invite' ? 'invite' : 'open',
    allow: (env.JARVIS_SIGNUP_ALLOW ?? '')
      .split(',')
      .map((one) => one.trim().toLowerCase())
      .filter(Boolean),
  };
}

/** Whether an address may make an account under the rule. */
export async function mayJoin(db: pg.Pool, rule: SignUpRule, email: string): Promise<boolean> {
  if (rule.mode === 'open') return true;
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf('@'));
  if (rule.allow.includes(address) || rule.allow.includes(domain)) return true;
  const { rows } = await db.query<{ invited: boolean }>('select jarvis_invited($1) as invited', [
    address,
  ]);
  return rows[0]?.invited === true;
}

/**
 * Attempts counted per address (spec 024), kept in the database so that every server instance
 * counts the same: five sign-ins a minute, five sign-ups an hour; the rest of `/auth`, a hundred a
 * minute. Behind Netlify the address is its client header; behind a tunnel, the forwarded one.
 */
const RATE_LIMIT = {
  storage: 'database' as const,
  window: 60,
  max: 100,
  customRules: {
    '/sign-in/email': { window: 60, max: 5 },
    '/sign-up/email': { window: 3600, max: 5 },
  },
};

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
  signUp?: SignUpRule;
  /** Attempts counted (spec 024): on, unless a caller or `JARVIS_RATE_LIMIT=off` turns it off. */
  rateLimit?: boolean;
}) {
  const rule = input.signUp ?? signUpRuleOf();
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
    // Her session read from its signed cookie for five minutes, not from the database on each
    // request (the database is often far away); signing out ends it at once on this device.
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    rateLimit: {
      ...RATE_LIMIT,
      enabled: input.rateLimit ?? process.env.JARVIS_RATE_LIMIT !== 'off',
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['x-nf-client-connection-ip', 'x-forwarded-for'] },
    },
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
          before: async (user) => {
            if (!(await mayJoin(input.db, rule, user.email))) {
              throw new APIError('FORBIDDEN', {
                code: 'SIGN_UP_BY_INVITATION',
                message: 'Jarvis opens on invitation: ask a person already here to invite you.',
              });
            }
            return { data: user };
          },
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
