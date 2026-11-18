# 094 — Formats and components, one registry (v3 D21, V8b)

## Step back

V5 to V8 left out part of the planned formats and components. Two formats had never been written
down at all: the list on the left with the detail on the right, and the app shell with its own
menu.

D21 fixes the rule: **build once, generically, and only extend what is shown**. Every component
lives in one registry, under any of its names. Pages, apps, Claude and the catalogue call it by
name. Adding one takes three gestures: its entry, its render, and its computation if it reads data.

## What changes

1. **Registry** (`packages/core/src/components.ts`): 41 components in 8 categories:
   - formats;
   - figures and charts;
   - lists and views;
   - input;
   - navigation;
   - identity;
   - content;
   - feedback.

   Each entry gives:
   - its id;
   - its free aliases (« entonnoir », « jauge », « liste + détail »);
   - what it needs (facets);
   - when to use it;
   - whether it is a page block.

   Lookups: `componentNamed` (any name, accents and case aside), and `checkPage`, which accepts a
   block named in her words.

2. **Access**:
   - `GET /components` returns the registry.
   - `POST /pages/try` computes blocks on her data without keeping anything.
   - The MCP tool `components` lets Claude choose instead of drawing.
3. **Renders** (`apps/web/src/blocks/`):
   - one render per page block, 19 in all;
   - charts in SVG on the tokens: bars, a curve, a share, a funnel, a heatmap, gauges;
   - a gesture on an entry (« Payée », « Écarter ») is saved and the page computed again.
4. **Formats**:
   - **Liste + détail** is a render of the engine (`split`): Personnes first, Documents, and any
     app's data. On a phone, the fiche opens over the list, with a way back.
   - **Modèle d'app**:
     - its menu on the left: Aperçu, its **Pages**, its **Données** per kind, Activité;
     - on a phone, tabs;
     - the pages its bundle declares (« Vue du mois », « À décider », « Suivi »…) are shown as
       **dashboards**: filters, a band of figures, a grid of blocks.
   - The fiche can be embedded (`EntryView`).
5. **Primitives** (`ui/more.tsx`): select, date, confirmation, brief message (toast), drop zone,
   file icon.
6. **Atelier**:
   - **Automatismes**: every rule (with its agent or « sans agent »), when it runs, what it does,
     Arrêter or Reprendre; « Chaque jour à 7 h, rappelle-moi… » is made on screen; her routines.
   - **Skills**: Jarvis's and hers.
   - **Composants**: the catalogue, by category. Each component has a live preview, when to use
     it, its names, the sentence for Claude and « Essayer avec mes données ».
7. **Fixes**:
   - The content grid is constrained on phones, so nothing goes past the right edge.
   - A figure's change shows the percentage the core gives.

## Not yet

- No map (« Carte »).
- No saved views or « + Vue »; the Kanban cannot add into a column or sort by hand.
- No right-click menu, no virtual lists, no text editor (TipTap).
- No types editor.
- No « Revue » template (a period and a written review).
- No inspirations from J-C yet: they will add components to the registry.

## Proof

Core tests (`components.test.ts`):

- names and aliases;
- one entry per id;
- a page whose blocks are named in her words.

The whole engine suite passes.

In the real app:

- Finances with its menu and its « Vue du mois » (figures, fund gauges, share, curve, to pay,
  table);
- Candidatures « À décider »;
- Personnes in list + detail;
- the catalogue, with « Entonnoir » tried on her offers;
- the 7 o'clock automation created on screen, signed by the Veilleur.

Checked at 1440, 1024 and 390 px: no page error, and no element past the right edge.
