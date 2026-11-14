# Spec 061 — Generic capabilities, recipes in her apps

**Status**: implemented · **Date**: 2026-11-14

The Atelier offers gestures, never a trade (its spec 003). `chercher` searches the web (SearXNG);
`parcourir` reads sites by a recipe (Crawl4AI, a plain request, or treg); `pdf` makes a PDF.

The trade lives here, in her app: which sites, which recipe, which words, where it goes.

## One shape back

Every capability returns items `{ title, url?, source, text?, fields?, score?, reasons? }`:

- a **structured** item becomes an entry of her `save.kind`, its fields by name;
- a **raw** item becomes a « Capture » (`save.raw`), for the AI to file later.

Any model of hers connects to any capability by naming its fields as the recipe extracts them.

## US1 — A rule sends several kinds along (P1)

`call.include` is a kind (sent under `entries`, as before), or names → kinds:
`{ searches: "JobSearch", sources: "Source" }`. Each kind is sent under its name, its 20 latest
entries.

## US2 — Raw kept apart (P1)

`call.save.raw` (« Capture » by default). The work token of long work may write `save.kind` and
the raw kind. The same holds for `capabilities { run, save: { kind, raw } }`.

## US3 — Candidatures on recipes (P1)

| Kind           | What it holds                                                                         |
| -------------- | ------------------------------------------------------------------------------------- |
| `JobSearch`    | gains `mots`: one idea per line, its forms separated by `\|`                          |
| `Source` (new) | its search address with `{placeholders}`, `js`, its `recipe` (JSON written by the AI) |

The rule « Offres du matin » calls `parcourir` with
`include: { searches: JobSearch, sources: Source }` and
`save: { kind: JobOffer, match: url, title: "{title}", raw: Capture }`.

- **Capabilities**: `chercher`, `parcourir`, `pdf`.
- **Instructions**: the AI finds the sources (`chercher`), writes and tries their recipe
  (`parcourir`), and repairs a failing one.
- **The page** adds the raw pages to sort and the sources.

## US4 — Near shapes fitted on receive (P2)

What a service sends in a near shape is made the one her model keeps before it is checked:

- a date with its time, for a day;
- a number written as text, for a number;
- « oui » or « true », for a yes.

What cannot be read so is refused by her model, as before.
