# 0002 — Neon for the data, the files and the accounts

- Status: accepted
- Date: 2026-10-29

## Context

The author uses Neon on every project. Neon now offers Postgres, S3-compatible Object Storage
that branches with the database, and Better Auth (managed, with an OAuth provider for MCP servers,
in beta).

## Decision

- One Neon project, `jarvis-os`, in `aws-eu-central-1` (Frankfurt: object storage is available
  there, and personal data stays in the EU), on the free plan first.
- Branches `main`, `dev`, `test`; each with its `files` bucket and a scoped storage credential.
- Accounts with Better Auth, the library the author already runs in Kete, on the same database.
  Neon's managed Better Auth and its OAuth provider are evaluated in spec 003.
- Files behind a storage port, so another provider can replace Neon's without touching the core.

## Consequences

- `pnpm provision` makes the project and writes `.env`; nothing is clicked by hand.
- Object Storage and the OAuth provider being young, each is proven by its own test first.
