# 090 — The timeline, as it should be (v3 D10)

## Step back

The timeline is a render of the one view engine, read from the facets only: « dated » gives a
bar's start and end and — new — what comes first (`after`, a link of the kind to itself:
« dépend de », « après », « bloqué par »); « stages » gives the groups; a progress field or
« measurable » gives how far along. Any app that says so gets the whole timeline; nothing is
written for one app.

## What changes

1. **Bars** with their title inside and their progress as a fill; a single date is a diamond with
   its title; the rows grouped by step (in the step's own order) unless the view groups otherwise.
2. **Weeks** (a column per day, week-ends shaded, 13 weeks) or **months** (a column per week, 34
   weeks); the months and days in the head; today's column and line; « Aujourd'hui » and the
   crosshair bring today into view; the names' column holds while the days scroll (narrower on a
   phone).
3. **Drag**: a bar moves its dates, an edge moves one — written to the fields the facet names,
   journaled and undoable like any change; a day stays a day, an instant an instant.
4. **Arrows** from what comes first to what follows. The view of a kind now gives a link's
   entries by id too (`<field>#ids`).
5. **A fix found on the way**: a model whose fields bear an old keyword (« debut », « fin »,
   « statut », « echeance »…) had its values stored under the engine's word (« start ») but read
   under the old one — empty in every view. Read, the model now takes the engine's word too, and
   keeps hers as the field's label; its workflow, total, columns and groups follow.

## Proof

A kind « Chantier » (start, end, steps, progress, « dépend de ») with eight entries: groups À faire
/ En cours / En revue, fills at 33 %, 50 %, 75 %, 90 %, two arrows, a diamond; a bar dragged two
days saved 18 → 22 as 20 → 24; weeks and months; 1440, 1024 and 390 px without overflow.
