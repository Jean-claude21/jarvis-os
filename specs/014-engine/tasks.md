# Tasks: The app engine

## Phase A — English keywords (US1)

- [x] T001 `keywords.ts`: the renames (fields, time, status, model); `save` accepts old names and
      says so
- [x] T002 Models, time, agenda, attention, upcoming, watcher, ICS, routes, MCP, instructions and
      routines speak the new names
- [x] T003 Migration 0006: her entries, models and the watcher's function renamed
- [x] T004 The app shows keywords and system kinds through its catalogs

## Phase B — Relations, formulas, lines, workflows (US2, US3, US5)

- [x] T005 `formula.ts`: parse and evaluate, no `eval`
- [x] T006 Relations in `save`: link fields become links; target, cardinality, required
- [x] T007 `compute.ts`: formulas at read across relations and lines; `find`/`get` doors return
      them
- [x] T008 Lines and workflows checked in `save`

## Phase C — Queries and pages (US4)

- [x] T009 `request.ts`: declarative queries over models
- [x] T010 `pages.ts`: page and block shapes; `renderPage` computes every block
- [x] T011 MCP `page` tool and view; REST `/api/pages`; the app draws pages, filters, record page

## Phase D — Rules (US6)

- [x] T012 `rules.ts`: triggers on save (depth ≤ 3), conditions, actions; savepoint dry-run
- [x] T013 Scheduled and « before » rules in the watcher; MCP `rule_test`

## Phase E — Scripts, migrations, bundles (US7, US8)

- [x] T014 `ScriptRunner` port; the API's isolated adapter; `runScript` with dry-run
- [x] T015 `migrate` with dry-run
- [x] T016 `exportApp` / `installApp`; Finances and Routines bundles
- [x] T017 Routine « Les apps » and instructions; docs and diagrams; tests at every phase

## Proof

- [x] T018 Tests: core (formulas, models, pages, engine: rules, scripts, migrations, bundles), API
      (the Finances app installed, used, drawn, imported, migrated through MCP and REST)
- [ ] T019 Checked in a browser: the app gallery, Finances installed, its page and a record page
- [ ] T020 The author's own Finances from his Life OS, installed and adjusted with Claude
