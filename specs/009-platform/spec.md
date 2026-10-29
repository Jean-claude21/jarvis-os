# Feature Specification: The platform — her web account

**Feature Branch**: `009-platform`

**Created**: 2026-10-29

**Status**: Built (checked in a browser with a test account; the author's own visit pending)

**Input**: User description: "The final platform, in the Kete brand, inspired by a clean invoicing
dashboard: what's on the person's account — her life, her spaces, her connections, her data."

## User Scenarios & Testing _(mandatory)_

She opens Jarvis in a browser, signs in, and sees her life without a model: what comes this week,
what changed, her documents to read, her dashboards drawn, her reminders and whether they reach her.
She invites her husband into « Nous », chooses which spaces Claude reaches, disconnects ChatGPT, and
downloads her whole life as Markdown.

### User Story 1 — Read her life (Priority: P1)

1. **Given** her session, **When** she opens `/`, **Then** the app shows: counts, the next seven
   days, the latest changes.
2. **Given** « Ma vie », **Then** her kinds with their counts, the entries of one, a search; an entry
   with its fields and origins, its links both ways, its text, its history — each change undoable.
3. **Given** « Documents » and « Tableaux de bord », **Then** they open in the same views Claude
   shows (framed), to read, print, download, or see recomputed.
4. **Given** « Rappels », **Then** each reminder, its next time, and whether her channel is linked.

### User Story 2 — Her settings (Priority: P1)

1. **Espaces**: her spaces and members, rename, invite (the link to send), withdraw, leave, create.
2. **Connexions**: the address to connect a client; each client she allowed, since when, last used,
   the spaces it reaches (changeable); disconnecting closes the door at once, before any token
   expires.
3. **Mes données**: her space as a zip of Markdown; a Markdown folder brought in, undone at once.
4. **Compte**: her name and address; sign out.

### Edge Cases

- Without a session, `/app` and its frames send her to sign in.
- Two quick navigations: only the latest is drawn.

## Requirements _(mandatory)_

- **FR-001**: The app is a door like the others: it reads and acts through `/api` with her session,
  under row-level security; no page holds data of its own.
- **FR-002**: One page, no build step, in the Kete brand, light and dark, usable at 375 px; every
  word from its catalog, French and English.
- **FR-003**: A revoked client is refused by `/mcp` at once (its consent is checked on each request).

## Success Criteria _(mandatory)_

- **SC-001**: She manages her spaces and connections and reads her life without a model.
