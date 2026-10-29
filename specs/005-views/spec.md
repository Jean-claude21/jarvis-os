# Feature Specification: Files by link, MCP Apps and dashboards

**Feature Branch**: `005-views`

**Created**: 2026-10-29

**Status**: Built (author's test in Claude pending)

**Input**: User description: "Saving a photo took Claude two minutes of base64; showing figures as
text loses what a chart says. Jarvis's own views inside Claude and ChatGPT, clean, in the Kete
brand; files sent by link; dashboards saved and recomputed on each open."

## User Scenarios & Testing _(mandatory)_

Ama asks Claude « montre-moi mes dépenses du mois ». Claude writes the queries and calls
`dashboard`: inside Claude, a Jarvis card draws a figure, bars by post and a curve by month, in the
brand's colors, light or dark like Claude. She keeps it; next month, « rouvre mon budget » redraws
it with the figures of that day. She wants to keep a receipt: Claude gives her a drop zone; the
photo goes straight to Jarvis, never through the conversation.

### User Story 1 — Files by link (Priority: P1)

**Independent Test**: `upload_link` returns a link; a file posted to it becomes a « Fichier » entry
in the space named, linked as asked; a forged or expired link is refused.

**Acceptance Scenarios**:

1. **Given** `upload_link` with `links`, **When** a file is posted to the link, **Then** it is
   stored, linked, its words found by `find`.
2. **Given** the link opened in a browser, **Then** a page offers to choose or drop files.
3. **Given** a link signed with another secret, or past its 30 minutes, **Then** it is refused.

---

### User Story 2 — A dashboard, recomputed on each open (Priority: P1)

**Independent Test**: `dashboard` with widgets returns each widget's rows (and a failing one's
reason); a saved « Tableau de bord » opened by name gives the figures of now.

**Acceptance Scenarios**:

1. **Given** widgets (titre, requete, graphe), **When** `dashboard` is called, **Then** each is
   computed by a read-only query over the spaces reached, in words for the model and in data for
   the view.
2. **Given** a saved dashboard, **When** an expense is added and it is opened again, **Then** the
   figures include it: no figure is stored.

---

### User Story 3 — An entry as a card (Priority: P2)

**Independent Test**: `show_entry` gives the entry, its space and its history; the card can undo a
change through the server's `undo` tool.

---

### User Story 4 — Views in the clients (Priority: P1)

**Independent Test**: the server declares `ui://jarvis/dashboard`, `ui://jarvis/entry` and
`ui://jarvis/upload` as `text/html;profile=mcp-app`; the tools name them in `_meta.ui.resourceUri`;
each view speaks the MCP Apps protocol and follows the host's theme and language.

### Edge Cases

- A host without MCP Apps: every tool still answers in words; the upload link works in a browser.
- A widget's query fails: the others are drawn, the failing one says why.

## Requirements _(mandatory)_

- **FR-001**: Bytes MUST NOT travel through the model: an upload link signed by the server, valid
  30 minutes, scoped to one person, one space and the links asked.
- **FR-002**: Views MUST follow the MCP Apps specification (2026-01-26) and degrade to words.
- **FR-003**: Views MUST use one design system — the Kete brand — light and dark, usable at 375 px.
- **FR-004**: A dashboard MUST store queries only, and recompute on each open.
- **FR-005**: No visible string in a view is hard-coded: French and English catalogs.

## Success Criteria _(mandatory)_

- **SC-001**: Tests prove stories 1, 2 and 4 on the Neon `test` branch.
- **SC-002**: The views render in a browser, light and dark, at phone width.
- **SC-003**: In Claude, the author sees a dashboard and sends a photo by the drop zone.

## Assumptions

- A confirmation view before an irreversible act waits for a real need: instructions already
  require her yes.
