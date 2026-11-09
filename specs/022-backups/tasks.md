# Tasks: Her life kept each night, and given back

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: each space, each night (P1)

- [x] T001 Migration `0017_space_backup.sql`
- [x] T002 `packages/core/src/backups.ts`; proof in `packages/core/tests/backups.test.ts`
- [x] T003 `apps/api/src/backups.ts`, the watcher's pass, `Blobs.remove`, routes; proof in `apps/api/tests/backups.test.ts`

## Phase 2 — US2: the database and its restore (P1)

- [x] T004 `tooling/backup.ts`: backup, keep three, restore (dry run, `--apply`)
- [x] T005 Restore tried for real on the `test` branch
- [x] T006 `.github/workflows/backup.yml`, waiting for the secret `NEON_API_KEY`

## Phase 3 — Documents and trial

- [x] T007 `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`
- [x] T008 Local checks; tried locally through ngrok; merged into `dev`
