# Tasks: One watcher at a time, and its trace

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: the lease (P1)

- [x] T001 Migration `0015_watcher_lease.sql`: table, functions, grants
- [x] T002 `packages/core/src/lease.ts`: `takeLease`, `giveLease`, `lastPass`
- [x] T003 Proof in `packages/core/tests/lease.test.ts`
- [x] T004 `apps/api/src/watcher.ts`: `watcherPass` takes the lease, skips without it, gives it back with its report

## Phase 2 — Documents and trial

- [x] T005 `docs/ARCHITECTURE.md`
- [x] T006 Local checks; tried locally through ngrok; merged into `dev`
