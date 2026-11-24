# 108 — Signing in with Google

_24 Nov 2026, asked by the author: « Jarvis permet l'inscription avec Google ? » — it did not._

## Step back

Not a new module: a door of the accounts (spec 002), beside the e-mail and the password. The rules
stay where they are: on invitation, a stranger is refused by the hook that makes an account, by
Google as by e-mail; each new account gets its space at once.

## What changes

- **Jarvis's Google client** (`JARVIS_GOOGLE_CLIENT_ID`, `JARVIS_GOOGLE_CLIENT_SECRET`, the one that
  already relates Drive, Gmail and Agenda) also signs her in, when whoever runs Jarvis set it. It is
  read once, when the server starts, for the door and the page.
- **The sign-in page** offers « Continuer avec Google » above the form, only then. One gesture
  creates the account or signs in; she comes back where her link led (`suite`).
- **An assistant that asked** (Claude through MCP): its OAuth request goes along with the Google
  sign-in, and the authorization goes on after it — a Google account connects Claude too.
- **The same address**: an account made by e-mail and a Google sign-in with the same address,
  verified by Google, are one account (account linking, Google trusted).

## What whoever runs Jarvis does once

In the Google Cloud console, on the client used above: add an authorized redirect address per
domain — `<public address>/auth/callback/google`.

## Proof

`apps/api/tests/google.test.ts`: the client read from the settings or none; the button on the
sign-in page only with a client; the sign-in sends to `accounts.google.com` with Jarvis's client,
`select_account`, and the redirect `<public address>/auth/callback/google`.
