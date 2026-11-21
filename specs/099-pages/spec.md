# 099 — F4: pages made on screen, bilans as documents, « Suivre quelque chose » (v3 D11, D21)

## Step back

- A **page** is a format plus blocks from the one registry (D21). The same screen, the same core
  and the same MCP make any app's page. Nothing is written for one app.
- A **bilan** is not a page. It is a **document**: an entry « Bilan » written by her assistant
  following **her routine**.
  - The routine (bilan-hebdo, bilan-mensuel, any she writes) sets its structure, its style and its
    criteria.
  - The facts come from the period only. A missing trace is « non renseigné ».
  - This is what J-C decided on 17 Nov (spec 083) and what his LifeOS did, and the v3 keeps it.
    Jarvis never invents a bilan's structure.
- **Everything she follows is a collection, and a collection lives in an app.**
  - An app is only a grouping: collections, plus their pages, agents and routines.
  - Collections are tied to each other by links.
  - Her routines read them over a period.

## What changes

1. **« Suivre quelque chose »** (sidebar › Mes apps, an app's menu, the Mes apps page):
   - She writes a phrase (« je veux suivre mes actions de grâce »). Jarvis makes a first draft:
     the name in the singular (« Action de grâce »), a date and a note.
   - She then adjusts it:
     - she renames it;
     - she adds or removes fields, among 15 plain types: a choice with its options, a link with its
       collection, a file, a place…;
     - she chooses the app it lives in, one she has or a new one.
   - Before she creates it, the screen says where else it will go. A date sends it to Agenda, Frise
     and Bilans; an amount to Argent; and so on.
   - Its facets follow from its fields.
   - The server calls no model. A richer proposal is the assistant's. The screen gives the sentence
     to say, and the assistant's proposal waits in « À valider ».
   - In the core: `draftCollection`, `createCollection` (one model with its `app`, refused if the
     name already exists) and `placeCollection`.
   - Routes: `POST /collections/draft`, `POST /collections`, `PUT /collections/:kind/app`.
2. **« À ranger »** (on the Mes apps page) lists the collections that have no app. Each one is
   placed in an app, existing or new, in one gesture. Nothing she keeps is left out of the menu.
3. **Ma vie › Bilans** (spec 083 brought to the v3):
   - Her bilans are listed on the left. They can be filtered by type (the routine that makes them)
     and by period.
   - The bilan she picks is read on the right, in the reader:
     - its titles, with a table of contents beside the text on a wide screen;
     - tables and task boxes;
     - callouts `> [!IMPORTANT] À retenir`, now drawn in the v3;
     - Mermaid diagrams in Jarvis's colours, served by Jarvis, now drawn in the v3.
   - « Nouveau bilan » asks for two things:
     - the routine that structures it. Her own is preselected: a routine that says it makes a
       « Bilan », or that is named for one;
     - a period: this week, last week, this month, last month, or any two days.
   - The new entry waits « à écrire ». It shows:
     - the sentence to give the assistant, with « Copier la phrase »;
     - what the period gave (the `highlights` block over those days), as the matter of the bilan.
   - The base routine « Les bilans » tells every assistant how to write it.
4. **Pages composed on screen**, for apps (`/composer`):
   - It opens from « + Nouvelle page » in an app's menu, and from « Modifier la page ».
   - A page has a name and a format: « Tableau de bord », or « Revue ». A Revue is a page over a
     period, moved with ‹ › and switched between Semaine and Mois.
   - Blocks are picked from the registry, by category. A block that none of her data can feed is
     greyed, with the reason.
   - Each block asks in plain choices: de quoi, compter, par, its columns, its days, only within the
     period.
   - The core writes the block's settings (`composeBlock`) and gives it a title in her words.
   - The page is computed on her data as she composes, then kept.
5. **The registry**:
   - Each block says what it asks (`asks`).
   - New entries: the format « Revue », and the block `highlights` (« Faits marquants »: what a
     period gave, computed by Jarvis).
   - The list block that was also called « Revue » is now « Passer en revue ».
6. **Periods**: `pagePeriod` reads `week`, `month`, `2026-W47`, `2026-11` and any days written
   `2026-11-10..2026-11-16`. Formulas receive `{from}` and `{to}`.
7. **The app menu**: a rule between its sections, and an icon for each item.

## Checked

- Core tests (`tests/compose.test.ts`):
  - blocks are built from answers, and what is missing is said;
  - weeks, months and free days are read; what a period gave is drawn;
  - a collection is drafted from a phrase and made once in an app. Making it twice is refused, and
    so is a choice without options. Her entries follow it, and it moves to another app.
- Real run on a quiet server, at 1440, 1024 and 390:
  - « Suivre quelque chose » made « Action de grâce » with Date, Note and Genre (provision, porte
    ouverte…) in a new app « Vie spirituelle », and opened it there;
  - « Lecture » was placed from « À ranger »;
  - « Nouveau bilan » preselected the routine « bilan-hebdo ». The entry waited « à écrire » with
    its sentence and the facts of the week;
  - a written bilan was read with its table of contents, callouts, table and pie chart;
  - in Finances, « Nouvelle page » with a key figure and bars (total amount by direction) was kept;
  - no page overflowed.

## Left for later

- The assistant writes a bilan when she asks. An agent writing it on its own at the routine's hour
  comes in F6.
- His routines online carry wrongly proposed triggers: bilan-hebdo every day at 9 h, bilan-mensuel
  every Monday. They are corrected only with his yes.
- Changing a composed block's settings, and dragging blocks.

## Since

- Spec 107 (21 Nov 2026): a page is changed on the page itself (« Modifier », « Ajouter une carte »),
  her pages’ named blocks become cards, and Aujourd’hui and a fiche get pages of their own.
