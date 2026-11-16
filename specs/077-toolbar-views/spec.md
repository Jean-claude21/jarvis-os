# 077 — One toolbar, three views of the same entries

## Why

Seen on 16 Nov in « Candidatures »: each table carries a row of filter buttons (Étape, Type, Source,
Lieu, Filtre avancé) and two or three text buttons on every row (« Postulée », « Écarter »…) that
overflow to the right. The author asks to follow Gr8r Studio: one quiet toolbar, the same entries as
a list, a board or a table, groups that fold, and the gestures of a row behind « ⋯ ».

## What changes (the `datatable` block, every app)

1. **One toolbar**: search · « Filtre » · « Tri » · « Grouper » — and, on the right, « Liste ·
   Kanban · Tableau ».
   - **Filtre** opens one menu: each filterable field with its values and how many entries hold each;
     « Filtre avancé » at its foot (the conditions of spec 070). Active filters stay as pills below.
   - **Tri**: a field and a direction. A table header still sorts on a click.
   - **Grouper**: none, or a field with options (an offer's step, its type…).
2. **Tableau**: as before; grouped, each group has a header with its count that folds; the gestures
   of a row move into a « ⋯ » menu (with « Fiche complète »). Selection and bulk gestures stay.
3. **Liste**: one line per entry — its title, its main values in a line under it, its figure on the
   right, « ⋯ ». Grouped the same way.
4. **Kanban**: one column per option of the grouped field (the first field with options when none is
   chosen), in the model's order; compact cards (title, two values, the figure); a column folds. A
   card dragged to another column takes that option, saved at once and undone from the toast.
5. A click on a row, a line or a card opens the side card (spec 076). The view, the group, the sort
   and the filters are kept per page and block on this device.
6. The list with its record (`review` block) gets the same toolbar, without the views.

No coloured bar on the left anywhere (the author's rule).

## Proof

« Toutes les offres » checked at 1440, 1024 and 390 px in the three views, grouped by step; a card
moved from « appréciée » to « à postuler » is saved and undone.
