# Feature Specification: Her method and her documents

**Feature Branch**: `008-method`

**Created**: 2026-10-29

**Status**: Built (the author's skills and charter imported; the test in Claude pending)

**Input**: User description: "Everything my Life OS does must be redone naturally with Claude: my
skills, my rules, and documents — theories, reviews — that I write from Claude and ask back to read
or download. Jarvis will be the source."

## User Scenarios & Testing _(mandatory)_

The author says « /matin » in Claude: his own `matin` skill, imported as a routine, is followed with
Jarvis's tools. He asks for a theory: Claude writes it section by section, he reads it in a Jarvis
view, prints it as PDF, goes back to the version of yesterday.

### User Story 1 — Her method, imported (Priority: P1)

1. **Given** skills (`SKILL.md`: `name`, `description`, text), **When** imported with
   `--include .claude/skills`, **Then** each is a « Routine » named as she calls it (« matin »,
   « /matin »), applied when its description says.
2. **Given** files named as the charter (`--kinds` by path), **Then** they reach every client.
3. **Given** a routine that names files and scripts, **Then** the client follows its intent with its
   tools (`source`, `query`, `save`), never asking her to run a script.

### User Story 2 — Documents (Priority: P1)

1. **Given** `write_document`, **Then** a document is an entry with its Markdown in `texte`.
2. **Given** `edit_document` (append, replace a section, insert after, replace a passage), **Then**
   only that part travels, and each change is a version.
3. **Given** `read_document`, **Then** its outline always, the whole text when short, else the
   sections asked; hosts with views show it to read, with its versions, undoable.
4. **Given** its reading link (a day), **Then** a page to read and print as PDF, or its `.md` file.

## Requirements _(mandatory)_

- **FR-001**: The format of sections lives in the core (`outline`, `applyEdit`); doors only call it.
- **FR-002**: Her text is escaped before any mark becomes a tag: no script runs from a document.

## Success Criteria _(mandatory)_

- **SC-001**: The parity checklist ([parity.md](parity.md)) passes in Claude.
