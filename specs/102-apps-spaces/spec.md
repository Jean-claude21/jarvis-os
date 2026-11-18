# 102 — F7: apps that come and go cleanly, members who see what is opened to them (v3 D14, D15; plan section 32)

## Step back

- **An app is a grouping** of models, pages, rules, scripts and agents (spec 099).
  - Removing one already existed in the core (`removeApp`, spec 034): its pieces are set aside, her
    entries stay. F7 brings that gesture to the v3, with what would go said first.
  - Trying one already existed as a dry run. F7 adds what it would _look like_: an example of each
    kind, drawn from its models alone. Nothing is written.
- **What a member sees is the database's work**, never the screen's: row-level security, in the
  same place as « is a member » (0001) and « may write » (0011).
  - The unit is the **kind**, as everywhere in the v3 (facets, views, queue). « Par entrée »
    already exists as shares (spec 016).
  - A member opened some kinds still **reads how the space is built**, so her screens draw: models,
    pages, views, apps, areas, agents, rules and scripts. She writes none of them.
- **Agents are members**, in the sense of who works in a space: shown beside the people, with their
  state. Their rights are their settings (spec 093): autonomy, budget, pause.

## What changes

1. **Désinstaller** (app page, top right):
   - a sheet says, in her words, what is set aside (« Garantie », « page « Mes garanties » »,
     « automatisme « Fin de garantie » ») and what stays: her entries, always, and the common kinds;
   - « Désinstaller » then makes one journal line, undone in one gesture from the Activity. She
     lands on Mes apps.
2. **Essai avec un exemple visible** (Mes apps › Essayer):
   - « À quoi ça ressemble »: one example of each kind the app brings (up to four), as a small
     fiche with its fields in her words and a value of each type;
   - core: `examplesOf`, and `examples` in the install report.
3. **What a member sees, by kind** (Réglages › Espaces › a shared space › Membres):
   - « Ce qu'il voit » lists the space's kinds that hold a life, never its structure. With nothing
     ticked, she sees everything;
   - each member's line says « voit tout » or « voit Courses »;
   - core: `member.kinds` (null for everything), set through `setRole` by an owner only; an owner
     sees everything; journaled as `space.role`, before and after;
   - doors: `POST /spaces/:id/members/:person/role` takes `kinds`, and MCP `set_role` too;
   - database (migrations 0034–0036): `jarvis_sees` and `jarvis_reads` on `entry`. A link is read
     when both its ends are; a file and a journal line when their entry is. The structure is read,
     never written.
4. **Agents among the members**:
   - each space's agents are listed under its people, with their role and state, and open on their
     page in the current space;
   - the Assistant du matin lives in her own space only, since the brief is told from there.

## Checked

- Core tests (`tests/member-kinds.test.ts`):
  - only an owner opens or closes kinds;
  - opened « Courses », a member reads only that kind. The rent, the link to it and its journal
    lines are hidden. She reads the space's models and cannot change them;
  - she writes « Courses » but not another kind, and cannot change an entry she cannot see;
  - everything open again, she sees it all;
  - `examplesOf` draws an example in her words, skipping links.
- Existing tests: `spaces`, `isolation`, `apps-lifecycle`, `layers`, `agents-f6`, `agent-node`.
- Real run on a quiet server (Neon `test` branch, side effects off), owner and member in « Maison »:
  - the owner opened « Courses » only to the member. The member's API then gave Riz and Huile and
    the space's structure, without the rent;
  - the agents were listed under the members, and the Assistant du matin only in her own space;
  - Garanties was uninstalled from its page (« Garantie », its page and its automation set aside),
    then « Essayer » showed an example warranty before « Ajouter »;
  - Réglages at 390 px: nothing past the edge.

## Left for later

- An app's agent stays when the app goes (« Veilleur d'échéances »): other apps may use it. Setting
  aside an agent no rule names any more is a later step.
- The kind checkboxes have no accessible name of their own.
- A note (« Comment ») on an entry she sees is shown to her only when « Comment » is opened to her.
