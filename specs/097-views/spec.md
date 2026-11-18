# 097 — F3: the views complete (v3 D10, D21; plan section 32)

## Step back

One engine, every scope (D10): whatever is added here works in every view of every page — her
whole life, an app, a kind. Nothing is written for one app.

## What changes

1. **Saved views**:
   - « + Vue » keeps what she arranged on a page (render, filters, sort, groups) under a name.
   - It comes back as a chip above the view, on that page. « Tout » goes back to the plain view,
     and ✕ sets a view aside.
   - A view is an entry « View »: `viewDataSchema` gains `place` (the page) and `state` (the
     engine's state). A view kept across her whole life has `kind: '*'`, and `runView` says to open
     it on its page.
2. **Kanban**:
   - « Ajouter » makes an entry right in a column, of the kind that column holds most.
   - A card dropped on another card goes before it: her own order, kept per board and column in her
     preferences (`boardOrder`), never written into her entries.
   - A card dropped in another column still takes that step.
3. **Calendar**:
   - « Mois » or « Semaine »: the week shows its seven days side by side (one under another on a
     phone), everything each holds, the hour first, week-ends shaded.
   - The Agenda reads exactly that week (`d`).
   - The timeline already had its months.
4. **Map**:
   - The « place » facet's render: every entry that says where it is (`{ address, lat, lng }`), a
     dot tinted by its kind; a dot opens the entry beside the map.
   - Leaflet is served by Jarvis (no CDN); the map tiles come from OpenStreetMap, as in the v2.
   - The map is in the registry (`map`, « carte »).
5. **Right click** on any entry of any view (list, cards, table, kanban): open beside, open in
   full, copy its link, set aside (undone from the Activity). There is one menu, mounted once.
6. **Fix**: the app page's content grid is constrained, so nothing goes past the right edge at
   1024 px.

## Not yet

- Very long lists (thousands of rows) are not yet virtualised.

## Proof

Core suite: 206 tests pass.

In the real app:

- a « Lieux » app proposed, then accepted, shows 3 dots on the map;
- « Mes salles de sport » (filter genre = sport) was kept, then reopened in one click;
- a card added in « idée » on the Projets board;
- the right-click menu opened on a card;
- the Agenda week from Monday 16 to Sunday 22 Nov.

Checked at 1440, 1024 and 390 px, with no page error and nothing past the right edge.
