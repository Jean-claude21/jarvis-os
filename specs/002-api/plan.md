# Implementation Plan: Accounts and the REST API

**Branch**: `002-api` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

`apps/api`, a Hono server: Better Auth for accounts (e-mail and password, bearer tokens), `/api`
routes over `@jarvis-os/core`, files in Neon Object Storage behind the core's `Blobs` port.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node 22

**Primary Dependencies**: `hono`, `@hono/node-server`, `better-auth` (bearer plugin), `pg`, `zod`,
`@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (the storage adapter only)

**Storage**: Neon Postgres (`jarvis_app`), Neon Object Storage (bucket `files` per branch)

**Testing**: Vitest; requests through `app.request()` in process; Neon `test` branch and storage

**Target Platform**: Node server on Coolify

**Project Type**: web service in the pnpm monorepo

## Constitution Check

| Principle                    | How this plan keeps it                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| I. Simple                    | one server, one route per core function                                                                               |
| III. One core, several doors | the routes only parse, call the core and answer; the storage vendor lives in `apps/api/src/storage.ts` behind `Blobs` |
| IV. Her life is hers         | every route runs `asPerson`; accounts are global tables reached only by `jarvis_app`, never by `jarvis_reader`        |
| V. Trust                     | every change goes through the core's journal                                                                          |

## Project Structure

```text
apps/api/
├── src/
│   ├── settings.ts      the environment of one branch (dev, test, main)
│   ├── auth.ts          Better Auth: accounts, sessions, bearer tokens; a space per account
│   ├── storage.ts       the Blobs port over Neon Object Storage (S3)
│   ├── routes.ts        /api over the core
│   ├── app.ts           the Hono app: /auth, /api, /health
│   ├── migrate.ts       the accounts' tables, and their grants to jarvis_app
│   └── server.ts        node server
└── tests/               API tests on the Neon test branch
packages/core/src/files.ts   addFile, fileOf (the Blobs port)
packages/core/db/migrations/0002_files.sql   find also searches a file's words
```

## Complexity Tracking

None.
