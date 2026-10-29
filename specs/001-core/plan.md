# Implementation Plan: The core

**Branch**: `001-core` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

A package `@jarvis-os/core` with the domain over Postgres: spaces, entries of any kind, links, the
journal and its undo, a read-only query, all under row-level security. No HTTP, no MCP: the doors
of specs 002 and 003 call these functions. Proven by integration tests on the Neon `test` branch.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node 22

**Primary Dependencies**: `pg`, `zod`

**Storage**: Neon Postgres 17 (`jarvis-os`, `aws-eu-central-1`), branches `main` / `dev` / `test`

**Testing**: Vitest, against the Neon `test` branch (`JARVIS_TEST_OWNER_URL`, `JARVIS_TEST_APP_URL`)

**Target Platform**: Linux server (Coolify) and the developer's machine

**Project Type**: library inside a pnpm monorepo

**Performance Goals**: a save of five entries and four links under one second

**Constraints**: no Docker on the author's machine; the public repository holds no secret

**Scale/Scope**: thousands of people, each with up to hundreds of thousands of entries

## Constitution Check

| Principle                    | How this plan keeps it                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| I. Simple and working        | Four tables of life (entry, link, journal, file), plus space and member; no table per kind |
| II. The model thinks         | Kinds and fields are data; no migration for a new kind                                     |
| III. One core, several doors | `packages/core` has no HTTP, MCP or vendor name                                            |
| IV. Her life is hers alone   | `space_id` and RLS in the same migration; `jarvis_app` is `NOBYPASSRLS`; isolation tested  |
| V. Trust built in            | origin per field; journal with before/after; undo; read-only query (decision 0004)         |
| VII. Proof                   | every acceptance scenario is a test in CI                                                  |

## Project Structure

### Documentation (this feature)

```text
specs/001-core/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/core/
├── db/migrations/0001_core.sql     tables, roles, grants, policies, views
├── src/
│   ├── db.ts                       pool, asPerson (one transaction, acting person set)
│   ├── migrate.ts                  applies db/migrations in order (owner URL)
│   ├── ids.ts                      prefixed identifiers
│   ├── schemas.ts                  zod inputs shared by the doors
│   ├── spaces.ts                   a person's space
│   ├── entries.ts                  save, get, find, kinds, archive
│   ├── journal.ts                  record, history, undo
│   ├── query.ts                    the read-only query
│   └── index.ts                    the public entry point
└── tests/                          integration tests on the Neon test branch
```

**Structure Decision**: one package, one public entry point (`src/index.ts`); the doors depend on
it as a workspace package.

## Complexity Tracking

None.
