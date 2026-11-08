# Feature Specification: The platform, organised around her day

**Feature Branch**: `013-platform`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Take the design we validated (docs/design/jarvis.html): open on what
matters now, the apps built with Claude in the menu, the files listed and downloadable."

## The idea

The first platform (spec 009) mirrored the data model: ten pages, one per table. This one opens on
**her day**: what went wrong, what is late, what Jarvis proposed, what comes today and this week —
each with its context and the gestures that settle it, undoable. Her apps (the kinds whose model
names an app) have their place in the menu; her files have a page of their own.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — « Maintenant » (Priority: P1)

1. **Given** a reminder the watcher could not send, a deadline passed, a proposal, an event today
   and a day this week, **When** she opens the app, **Then** « Maintenant » lists them in that order
   with a count per group — nothing she has not kept herself.
2. **When** she picks one, **Then** she sees its fields and their origin, its links, her day as one
   band (the repeated blocks included), and the gestures that fit: accept or decline a proposal;
   plan again what failed; done, tomorrow, or cancel for the rest.
3. **When** she makes a gesture, **Then** it is saved and journaled, and the notice offers to undo.
4. A `date` of today (an expense, a note) is a fact, not a thing to do: not listed today.
5. On a phone: the list, then the thing, with a way back.

### User Story 2 — Her apps (Priority: P1)

1. **Given** models naming « Finances », **Then** « Finances » is in the menu; its page has a tab per
   kind, a table with the model's columns, grouped as the model says, with subtotals and a total.
2. « Ajouter » opens a form drawn from the model; a save the model refuses says why in the form.
3. « Voir le modèle » shows its fields, natures, choices and rangement.

### User Story 3 — Her files (Priority: P1)

1. « Fichiers » lists every file: name, type, what Jarvis read of it, what it is linked to, when,
   its size; filters by type; a preview (image, PDF, text) and a download.

### Edge Cases

- No model with an app: the menu offers « Nouvelle app », which says to ask Claude.
- The space chosen changes the apps and the files shown; « Maintenant » reads all her spaces.

## Requirements _(mandatory)_

- **FR-001**: The app stays a door: everything through `/api` with her session (`/api/now`,
  `/api/files`, `/api/kinds`, `/api/entries`, `/api/save`, `/api/undo`).
- **FR-002**: Every word from the catalog, French and English; the Kete tokens, light and dark,
  usable at 375 px.
- **FR-003**: The pages of spec 009 stay (entries, documents, dashboards, reminders, journal,
  spaces, connections, data, account), reached from the menu.

## Success Criteria _(mandatory)_

- **SC-001**: She opens Jarvis and knows in ten seconds what to do now, and does it in one gesture.
