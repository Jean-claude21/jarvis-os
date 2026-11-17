# 084 — The views of an app, as tabs

## Why

The author, 17 Nov, looking at gr8r-studio: each project has tabs for its views — list, board,
calendar, timeline, files, activity — and « + » to keep a new one. In Jarvis an app had its pages,
its saved views and its raw kinds, but no way to see its dated things on a calendar or a timeline,
its files or what changed in it, and keeping a view meant finding the old view explorer.

## What changes

1. **Four tabs on every app**, after its pages and its saved views (`#/app/<name>?tab=…`):
   - **Calendrier**: every date its kinds hold (date and datetime fields), on a month, one colour
     per kind, with a legend naming the fields; month by month, back to today. On a phone the grid
     shows dots and the month's things are listed under it.
   - **Frise**: over three months, each entry from its first date to its second (a bar), or a
     point when it has only one; today as a line; the name and the two days beside.
   - **Fichiers**: the files linked to its entries (an attachment, a photo sent on Telegram), as
     cards with their type, size, day and the entries they belong to.
   - **Activité**: the journal of its entries only, by day, with what changed and when.
     Calendrier and Frise show only when one of its kinds has a date. Each item opens the side card.
2. **« + Vue »** at the end of the tabs (it stays in sight when the tabs scroll): a name, one of its
   kinds, and how to show it — a list, a board by one of its choices, a calendar by one of its
   dates, a timeline from one date to another. It is kept as a « View » of the app and opens at once
   as a tab. A kind without a choice or a date says so instead of saving an empty view.
3. **The journal can be read for some kinds**: `GET /api/history?kinds=A,B` (any case).

## Proof

Candidatures with eight offers (published, sent, follow-up) and two files: the four tabs at 1440,
1024 and 390 px without any overflow; a timeline view kept from « + Vue » opening as its own tab.
