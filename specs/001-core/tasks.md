# Tasks: The core

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md)

## Phase 1: Setup

- [x] T001 Create `packages/core` (package.json, tsconfig, vitest config, README with diagram)
- [x] T002 Migration runner `packages/core/src/migrate.ts` and `db:migrate` script

## Phase 2: Foundation

- [x] T003 Migration `0001_core.sql`: tables, `jarvis_reader`, grants, RLS policies
- [x] T004 `db.ts`: pool and `asPerson` (transaction, `jarvis.person` set); `ids.ts`
- [x] T005 Test setup: migrate the `test` branch, clean its rows, two people with their spaces

## Phase 3: User Story 1 — Save with links (P1)

- [x] T006 `schemas.ts` and `entries.save` (create, update with merge and `null` removal, links by
      id or reference, origins), journaled
- [x] T007 Tests: two entries and a link in one call; merge; origin `read`

## Phase 4: User Story 2 — Find and kinds (P1)

- [x] T008 `entries.get`, `entries.find` (words, kind, period, archived), `entries.kinds`
- [x] T009 Tests: kinds with counts and fields; find by word, kind, period

## Phase 5: User Story 3 — Undo (P1)

- [x] T010 `journal.undo` and `journal.history`; `entries.archive`
- [x] T011 Tests: undo a correction (value and origin), an archive, a link; undo twice refused

## Phase 6: User Story 4 — Query (P2)

- [x] T012 `query.ts`: read-only transaction, `jarvis_reader`, timeout, 500-row limit
- [x] T013 Tests: a sum; a write, an identity table, two statements and a slow query refused

## Phase 7: User Story 5 — Isolation (P1)

- [x] T014 Tests: Kossi neither finds, queries, saves, links into nor undoes Ama's space

## Phase 8: Polish

- [x] T015 Documentation: package README, `docs/ARCHITECTURE.md` checked, roadmap state
- [x] T016 `pnpm check` green; CI green on the pull request to `dev`
