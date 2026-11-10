# Feature Specification: Her life kept each night, and given back

**Feature Branch**: `022-backups`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S9 (backups: the database backed up, a restore possible, a Markdown export
each night), in the plan's order.

## What is missing

Nothing is backed up. Neon goes back six hours on its free plan: a mistake noticed the next day is
lost. Her export exists, but only when she asks for it.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Each space, each night, as Markdown (Priority: P1)

1. Each night, each space is exported as a Markdown folder (what she downloads herself) into the
   storage; thirty days are kept.
2. She lists her space's backups and opens one by a short link; it imports back like any folder.

**Proof**: a space without its backup of the day is due, then is not; a backup past thirty days is
forgotten; another person sees none of them; through her account, the backup is listed and opens
with her entries inside.

### User Story 2 — The database, each night, and its restore (Priority: P1)

1. Each night, the production database is kept as it is (a Neon branch), the last three kept.
2. One command shows what a backup and a branch hold; with `--apply`, restores the branch from the
   backup, keeping its state before.

**Proof**: the `test` branch backed up, emptied by the tests, restored from its backup: it holds
again what the backup holds; the application still connects.

## Requirements

- **FR-001** A space's backup is made as one of its members; members alone read it.
- **FR-002** A pass backs up a few spaces; the next passes do the rest.
- **FR-003** The database backup and its restore print no secret; the restore is a dry run unless
  `--apply`, and keeps the state before.
