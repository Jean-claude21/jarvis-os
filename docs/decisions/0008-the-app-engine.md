# 0008 — The app engine: apps are data Claude writes, with one escape hatch

- Status: accepted
- Date: 2026-10-30

## Context

Spec 012 gave kinds a shape (models). The author wants complete apps — finances, routines, and
what a person needs next — as strong as a low-code platform (NocoBase, Notion, Frappe), including
scripts. Jarvis has one builder those platforms lack: the model, in conversation. Whatever the
engine holds must be something a model can write, Jarvis can check and explain, and the person can
trust without reading code.

## Decision

An app is a bundle of entries of system kinds, each validated by the core and journaled like any
entry:

| Layer      | System kind | What it says                                                                  |
| ---------- | ----------- | ----------------------------------------------------------------------------- |
| Model      | `Model`     | fields, their type, required, options, relations, formulas, lines, workflow   |
| Relation   | (a field)   | `type: link`, `target`, `cardinality`, `inverse`; stored as links             |
| Formula    | (a field)   | `type: formula`: an expression in a small safe language, computed at read     |
| Query      | (in a page) | `kind`, `where`, `groupBy`, `aggregate`, `sort`, `limit` — over models        |
| Page       | `Page`      | filters and blocks (stat, gauge, bar, line, table, task list, kanban…)        |
| Rule       | `Rule`      | `when` → `if` → `then` actions, run by the core and the watcher               |
| Script     | `Script`    | JavaScript run in an isolated engine: reads what it declares, returns changes |
| Migration  | (a tool)    | rename, set, remove a field across a kind's entries, tried first              |
| App bundle | (export)    | models, pages, rules and scripts of one app, exported and installed at once   |

- **Engine keywords are English** (`fields`, `type`, `required`, `start`, `repeat`, `status`…);
  her kinds, fields and values stay in her words. The app shows keywords through its catalogs.
- **Figures are computed at read, never stored.** Formulas and queries run in the core; raw SQL
  (decision 0004) stays as the escape hatch for what queries cannot say.
- **Every write goes through `save`.** A rule, a script or a migration writes as any door does:
  checked against models, journaled, undoable. Each can be tried first (`dryRun`): the change is
  made inside a savepoint, reported, and rolled back.
- **A script computes, Jarvis writes.** A script is a pure function: it receives the entries it
  declared it reads and returns the changes it wants. It has no network, no clock of its own beyond
  what it is given, a time and memory limit. The core defines the port (`ScriptRunner`); the API
  provides the adapter.
- **Rules never loop**: a rule's changes may trigger rules up to a depth of three.
- From Frappe we take **lines** (a child table inside an entry) and **workflows** (states and the
  transitions allowed between them).

## Consequences

- Finances and Routines are bundles, not code: installed in one sentence, adjusted in conversation.
- The French keywords shipped in specs 006–013 are renamed by migration `0006`; for a while a save
  still accepts the old names and says so.
- Breadth stays smaller than Frappe (no roles per document, no print formats); the gain is in how
  an app is built and trusted.
