# Feature Specification: A system to use every day, and to share

**Feature Branch**: `015-finish`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Finish the whole system so that I use it every day and share the
link with someone (through ngrok): explore my data as in Frappe — filters on every field, sorts,
columns, table, kanban, calendar, saved views; file my apps by area (personal, professional); my
time zone; Telegram from the app; errors I can read; the blocks at the level of the validated
design; keys for the real-time app to come."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Views (Priority: P1)

1. **Given** her Finances, **When** she opens « Transaction », **Then** she filters on any field and
   one link away (« fund › title is Courses »), sorts, chooses columns, groups, with totals.
2. She switches the same entries to a kanban (by a choice field) or a calendar (by a date field)
   when the model allows it.
3. In the kanban she drags a card to another column: its state changes, through the workflow.
4. « Save view » keeps it as an entry « View »: a tab of the app, for good; she updates it.
5. Claude reads the same views with the tool `view`.

### User Story 2 — Areas (Priority: P2)

1. She files an app in an area in her words (« Personnel », « Professionnel »): the sidebar groups
   her apps by area; an app not filed is « Not filed ».

### User Story 3 — Her settings (Priority: P1)

1. She chooses her time zone once: her calendar, reminders and « today » follow it.
2. She links her Telegram from the app: a link opens the bot, she presses Start, it is linked.
3. She makes a personal key for an app of her own, sees it once, revokes it.

### User Story 4 — What she reads (Priority: P1)

1. A refusal shows its kind in her language, with the model's sentence as the detail.
2. Blocks look as the validated design: panels, KPIs, status bars.
3. A page may hold an `sql` block, the escape hatch of the old dashboards.

### User Story 5 — Shared (Priority: P1)

1. A second person signs up through the link, connects her Claude, installs an app, and sees nothing
   of the first one's life; a shared space « Nous » works for both.

## Requirements _(mandatory)_

- **FR-001**: A view is an entry, journaled; a view run is never stored.
- **FR-002**: Every visible word from the catalogs; technical names English, labels `fr` / `en`.
- **FR-003**: A personal key's fingerprint only is kept; a revoked key answers nothing.

## Success Criteria _(mandatory)_

- **SC-001**: The author uses Jarvis a full week from the app and Claude, and a second person uses
  it through the shared link.
