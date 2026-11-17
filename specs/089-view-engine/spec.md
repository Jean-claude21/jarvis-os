# 089 — One view engine, every scope (v3 V5: D10)

## Step back

A view is a source and a state shaping it, drawn by a render. The server already has the sources:
a kind's rows with its fields in her words (`/views/run`), everything dated with repetitions
unfolded (`/agenda`), what she has to do (`/activities`), her files (`/files`). The client keeps one
engine on top: the pages across her life and an app's tabs are the same component, only their
source changes.

## What changes

1. **The engine** (`apps/web/src/engine`): sources give rows (and their facets: when, which step)
   and fields; the state — search, filters, sort, groups, render, kind, month, scale — lives in the
   URL; one toolbar (Chercher, Filtre, Tri, Grouper, the renders this source allows).
2. **The renders**: Liste (groups under sand bands), Tableau (TanStack Table: sortable headers,
   columns chosen, the title held), Kanban (a column per step of a choice; a card dropped takes the
   step, journaled and undoable), Calendrier (six weeks, chips tinted by kind, dots and a list on a
   phone), Frise (weeks or months, week-ends shaded, bars or points, today's line, rows grouped),
   Fichiers (genre, order, grid or list, coloured icons, what each belongs to, a drop zone).
3. **Across her life**: Agenda (calendar, timeline, list — the server's agenda plus the kinds dated
   by a field of their own), Tâches (list by when, board by status, table), Documents (files),
   Personnes (the kinds that are someone).
4. **An app's tabs**: Aperçu, then Liste, Tableau, Kanban (when a kind has steps), Calendrier and
   Frise (when one is dated), Fichiers, Activité (its journal) — and « Type » when it has several.

## Proof

Candidatures with seven offers, tasks, two people, a file and a public calendar: every render at
1440 px, the main ones at 1024 and 390, no overflow; a card dragged from « nouvelle » to the next
column saved as `rated`.
