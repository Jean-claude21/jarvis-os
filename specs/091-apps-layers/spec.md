# 091 — Apps and templates: layers, catalogue, Aperçu (v3 D11, D14, V6)

## Step back

An app is a bundle of kinds (with their facets), pages, rules and scripts. Three needs are
served by one mechanism, not three:

- Jarvis ships apps;
- she changes them;
- an assistant proposes new ones.

That mechanism is **layers**. A release is the app's layer, her changes are hers, and an update
merges the two from the base kept at install. Nothing in a page is laid out by hand for one app.
The Aperçu is generated from the facets, so any app that declares them gets it.

## What changes

1. **Releases and layers.** A bundle has a `release`. Installing it always creates the App entry,
   which keeps the installed base (`data.installed`). `updateApp` merges three ways: base, her
   version and the new release.
   - What she did not touch takes the new release.
   - What only she changed stays hers.
   - What both changed stays hers and is listed as a conflict.
   - New fields and kinds are added.
   - The whole update is one journal line (`app.update`), undone at once.
2. **Catalogue.** `/apps/catalog` lists each shipped app with its description, release and
   installed release. Mes apps shows hers first, then « À ajouter ».
   - Each card opens a preview, run as a dry run, before anything is written.
   - For an install, the preview shows what the app creates, what is kept and what of hers it
     can use.
   - For an update, it shows what is updated, added and kept as she made it.
3. **Apps proposed by an assistant.** `/apps/propose` and the MCP tool `app_install` (`propose`,
   `why`) try the bundle as a dry run, then save an `AppProposal`. It waits in « À valider »
   (nature « app proposée ») until she says yes, which installs it, or no.
4. **Aperçu**, the generated template of an app page, built from its kinds' facets:
   - figures: the main kind, the first step, what falls in the next 30 days, the totals and
     the average progress;
   - goals with their progress bars;
   - the funnel by step;
   - the app's journal;
   - what is coming;
   - its last files.
5. **Objectifs**, a new shipped app:
   - Goal: target, unit, start → deadline, status;
   - GoalStep: a step linked to its goal, with a value and a date;
   - progress is computed, never typed.

## Proof

Core tests (`layers.test.ts`):

- install v1;
- her change kept through v2;
- a conflict kept as hers;
- a new field and a new kind added;
- the update undone at once;
- the proposal flow, both yes and no.

In the real app:

- the catalogue lists 10 apps;
- Objectifs was installed from its preview;
- two goals at 8 % and 4 % were shown with steps in the Aperçu;
- the proposed app « Jardin » was installed by « Accepter ».

Checked at 1440, 1024 and 390 px, with no overflow and no page error.
