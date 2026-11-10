# Tasks: Knowing when something went wrong

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: a reminder that did not reach her (P1)

- [x] T001 `enterMessage` revives a failed message; `markFailed` says when final; proof in `packages/core/tests/outbox.test.ts`
- [x] T002 `deliverOutbox` saves the reminder « failed » with its reason; words in `i18n`
- [x] T003 Proof in `apps/api/tests/monitoring.test.ts`

## Phase 2 — US2: the server's health (P1)

- [x] T004 The watcher keeps its whole pass's report with its lease
- [x] T005 `apps/api/src/health.ts`, `/health`; proof in `apps/api/tests/monitoring.test.ts`

## Phase 3 — Documents and trial

- [x] T006 `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`
- [x] T007 Local checks; tried locally through ngrok; merged into `dev`
