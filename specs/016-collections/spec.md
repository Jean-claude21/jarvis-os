# Feature Specification: Collections and the types of every day

**Feature Branch**: `016-collections`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Follow one collection without building an app — my internship
applications, my morning orders — and see its statistics. Have the types I need most often (a
link, a file, an address on a map, tags, a rating, a progress, a button…), a timeline, and
everything the life cases asked for. Leave routing aside."

## The cases it was measured against

Applications, a flat search, a vehicle's upkeep, blood pressure, loans to relatives, subscriptions,
reading, a wedding, a small shop's orders and stock, a building project, warranties and papers,
spending in two currencies. Each fits once this spec is built.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — The types of every day (Priority: P1)

1. A field may be `url`, `email`, `phone`, `multi_choice`, `file`, `location`, `rating`,
   `progress`, `button`, `time`, `long_text`; each is checked, shown and entered as such.
2. A field may have a `default` (a value or « =today() »), `min` / `max`, and be `unique`.
3. `distance(a, b)` gives the kilometres between two places; `convert(amount, from, to)` converts
   between currencies (XOF, XAF, EUR fixed; others from her « Rate » entries).

### User Story 2 — A collection on its own (Priority: P1)

1. Every kind with a model opens from « Collections », no app needed, with its statistics read
   from its model: total, this month, the split of each choice, weeks, sums and averages.

### User Story 3 — More views (Priority: P1)

1. A collection shows on a map (a `location`), in a gallery (a `file`), on a timeline (dates, a
   start and an end), as a tree (a link to the same kind), beside table, kanban and calendar.
2. A page may hold a view (block `view`); a line may compare several series.

### User Story 4 — Actions (Priority: P1)

1. A `button` does what its model says (fields set, a rule or a script), journaled.
2. A rule may change the entry it links to (`update.on`): an order takes from a product's stock.

### User Story 5 — Sharing outside (Priority: P2)

1. A public form: anyone with the link adds an entry, which reaches her as « proposed », origin
   « read »; a public view: read-only. She closes it.
2. A member of a shared space may be a viewer: reads, never writes.

## Requirements _(mandatory)_

- **FR-001**: No routing service; distances are as the crow flies.
- **FR-002**: Every visible word from the catalogs; technical names English.
- **FR-003**: A share keeps only its key's fingerprint; what comes through it is data, never orders.

## Success Criteria _(mandatory)_

- **SC-001**: The author follows his applications as a collection, with its map, kanban, timeline
  and statistics, and a relative fills a public form.
