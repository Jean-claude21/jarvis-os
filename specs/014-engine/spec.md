# Feature Specification: The app engine

**Feature Branch**: `014-engine`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "A powerful app system, as strong as a low-code platform, with
scripts that run — so that from Claude a person gets complete apps: finances, routines, anything.
Technical names in English. Do as well as Frappe where it matters, better where Jarvis can."

Decision: [0008](../../docs/decisions/0008-the-app-engine.md).

## User Scenarios & Testing _(mandatory)_

### User Story 1 — One vocabulary, in English (Priority: P1)

1. A model is `{ fields: [{ name, type, required, options, target, cardinality, inverse, unit,
help, formula, fields }], open, path, columns, total, groupBy, app, workflow }`; types are
   `text, number, amount, date, datetime, duration, choice, boolean, list, link, formula, lines`.
2. Time is `start`, `end`, `duration`, `at`, `due`, `date`, `repeat`, `except`, `until`,
   `timezone`; state is `status`: `proposed`, `done`, `cancelled`, `sent`, `failed`, `to_fix`.
3. **Given** her entries written with the old names, **When** migration 0006 runs, **Then** they
   use the new ones and her calendar, reminders and models work as before.
4. **When** a save still gives `debut`, **Then** it is stored as `start` and the answer says so.

### User Story 2 — Relations (Priority: P1)

1. **Given** `Mouvement.compte` `{ type: link, target: Compte, cardinality: one, inverse:
mouvements }`, **When** Claude saves a mouvement with `data.compte` = an id (or a `ref`),
   **Then** a link « compte » is made (one replaces the previous), not a field.
2. A link to an entry of another kind is refused; a required link missing on creation is refused.
3. **Given** a compte, **Then** its record shows its `mouvements` (the inverse).

### User Story 3 — Formulas (Priority: P1)

1. `Compte.solde` `{ type: formula, formula: "solde_initial + sum(mouvements.montant where
nature = 'entrée') - sum(mouvements.montant where nature = 'sortie')" }` is computed when read,
   in Claude, in the app and in queries; never stored, never written.
2. Functions: `sum avg count min max` (with `where`), `if`, `coalesce`, `round`, `abs`, `today`,
   `this_month`, `month`, `year`, `last_days`, `days_between`, `since`, `lower`, `contains`.
3. A formula that does not parse is refused when the model is saved, saying where.

### User Story 4 — Pages and blocks (Priority: P1)

1. A `Page` `{ app, title, filters, blocks }` draws, in the app and in Claude, the blocks `stat`,
   `stat_delta`, `gauge`, `bar`, `line`, `breakdown`, `heatmap`, `table`, `task_list`, `kanban`,
   `calendar`, `form`, `record`.
2. A query `{ kind, where, groupBy, aggregate, sort, limit }` feeds a block; `{month}` comes from
   the page's filter.
3. **Given** a filter `month`, **When** she picks September, **Then** every block follows.
4. A `task_list` gesture (« paid ») is a save, undoable.

### User Story 5 — Lines and workflows (Priority: P2)

1. A field `{ type: lines, fields: [...] }` holds rows (an invoice's lines), each checked;
   `sum(lignes.montant)` works.
2. A `workflow` `{ field, initial, transitions: [{ from, to, if }] }` refuses a change of state
   that is not a transition.

### User Story 6 — Rules (Priority: P1)

1. A `Rule` `{ when, if, then, active }`; `when` is `{ saved: kind }`, `{ changed: { kind, field }
}`, `{ schedule: "0 8 1 * *" }` or `{ before: { kind, field, days } }`; actions `create`,
   `update`, `link`, `remind`, `run_script`.
2. **Given** a rule « when a Mouvement is saved, if fonds.reste < 0, remind », **When** an expense
   overspends, **Then** a reminder is made, journaled by the rule.
3. **Given** a schedule « the 1st at 08:00, create Loyer », **Then** the watcher creates it.
4. `rule_test` tries a rule on an entry and says what it would do, changing nothing.

### User Story 7 — Scripts (Priority: P2)

1. A `Script` `{ reads, writes, code }`: `run(input)` receives `{ entries, file, params }` and
   returns changes; anything outside `writes` is refused.
2. **Given** a bank statement file, **When** the import script runs with `dryRun`, **Then** she
   sees the mouvements it would create; then they are created, undoable.
3. An endless loop stops at the time limit; no network, no host access.

### User Story 8 — Migrations and bundles (Priority: P2)

1. `migrate` `{ kind, steps: [{ rename }, { set }, { remove }], dryRun }` changes every entry of a
   kind, tried first, each change journaled.
2. `app_export` gives the models, pages, rules and scripts of an app; `app_install` puts them in a
   space (tried first). Finances and Routines ship as bundles.

## Requirements _(mandatory)_

- **FR-001**: Every definition is an entry; every write goes through `save` (constitution V).
- **FR-002**: Formulas and queries are evaluated by the core, without `eval`.
- **FR-003**: Scripts run behind a port; the core names no engine (constitution III).
- **FR-004**: Every user-visible word from the catalogs; refusals are sentences a model can act on.

## Success Criteria _(mandatory)_

- **SC-001**: The Finances bundle installed, a month of mouvements saved in Claude, and the page
  « Vue du mois » right in the app and in Claude.
