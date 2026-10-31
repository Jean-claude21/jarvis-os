# Feature Specification: Entries she can find, file and count

**Feature Branch**: `017-entries`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Entries are lists too: I want statistics on them (my prayers). The
pages need clear scroll areas; search, filter and select to find quickly what I want; a flat
list or a tree, because I want my own way of filing my reviews; the kinds shown flat or in groups
I define. I tell Claude how to file, and it does it every time, like a rule."

## What her data says

Her Life OS came in with 58 kinds and no model for most of them. Each entry kept the path of its
file (`vie/2026/2026-08/bilans/W33.md`): her own folders. A prayer is one entry a day, with a
`date`. Reviews carry their month only in their path. Every entry shows the day of the import.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — The day of an entry, and its folder (Priority: P1)

1. An entry's day is its own: `date`, `at`, `start` or `due`; else a day or a month in its source
   path or its title; only then the day it was made.
2. An entry's folder is `folder` when she (or Claude) filed it; else the folder of its source.

### User Story 2 — Finding (Priority: P1)

1. The Entries page has its own scroll areas: the kinds, and the list with its header kept.
2. She searches the kinds and the list, filters by period and folder, sorts by day, title or
   change.
3. She shows the list flat, by period (year › month) or by folder (a tree).
4. She selects entries and files them in a folder, changes their kind, or sets them aside — at
   once, undone at once.

### User Story 3 — Kinds in her groups (Priority: P1)

1. The kinds show flat or in groups. A group is an entry of kind « Area » (`{ kinds }`); a kind
   with a model may say its `area`; an app's kinds go with the app; Jarvis's own kinds together.
2. She renames a kind (`document` → `Document`): every entry follows, undone at once.

### User Story 4 — Statistics on any list (Priority: P1)

1. Any kind, with or without a model, filtered or not, gives: how many, this month, day by day
   over twelve weeks, the current and best streak of days, the active days of the last thirty,
   the hours (when entries have a time), the splits of short repeated values, the averages.
2. Claude reads them through `stats`: « how many prayers this week? ».

### User Story 5 — Said once, done each time (Priority: P2)

1. She tells Claude how to file; Claude writes it in her « Charter », sets `folder` on each new
   entry, and keeps a « Area » for the kinds she groups.

## Requirements _(mandatory)_

- **FR-001**: Every visible word from the catalogs; technical names English.
- **FR-002**: Every change through `save` or the journal: renaming and filing are undone at once.
- **FR-003**: No new table: groups and folders are entries and fields.

## Success Criteria _(mandatory)_

- **SC-001**: The author opens « Prière » and sees his streak; opens « Bilan » by folder and by
  period; groups his kinds; renames `document`.
