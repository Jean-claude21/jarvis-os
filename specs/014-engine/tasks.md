# Tasks: The app engine

## Phase A — English keywords (US1)

- [ ] T001 `keywords.ts`: the renames (fields, time, status, model); `save` accepts old names and
      says so
- [ ] T002 Models, time, agenda, attention, upcoming, watcher, ICS, routes, MCP, instructions and
      routines speak the new names
- [ ] T003 Migration 0006: her entries, models and the watcher's function renamed
- [ ] T004 The app shows keywords and system kinds through its catalogs

## Phase B — Relations, formulas, lines, workflows (US2, US3, US5)

- [ ] T005 `formula.ts`: parse and evaluate, no `eval`
- [ ] T006 Relations in `save`: link fields become links; target, cardinality, required
- [ ] T007 `compute.ts`: formulas at read across relations and lines; `find`/`get` doors return
      them
- [ ] T008 Lines and workflows checked in `save`

## Phase C — Queries and pages (US4)

- [ ] T009 `request.ts`: declarative queries over models
- [ ] T010 `pages.ts`: page and block shapes; `renderPage` computes every block
- [ ] T011 MCP `page` tool and view; REST `/api/pages`; the app draws pages, filters, record page

## Phase D — Rules (US6)

- [ ] T012 `rules.ts`: triggers on save (depth ≤ 3), conditions, actions; savepoint dry-run
- [ ] T013 Scheduled and « before » rules in the watcher; MCP `rule_test`

## Phase E — Scripts, migrations, bundles (US7, US8)

- [ ] T014 `ScriptRunner` port; the API's isolated adapter; `runScript` with dry-run
- [ ] T015 `migrate` with dry-run
- [ ] T016 `exportApp` / `installApp`; Finances and Routines bundles
- [ ] T017 Routine « Les apps » and instructions; docs and diagrams; tests at every phase
