# @jarvis-os/core

The domain of Jarvis OS (spec 001): a person's life as a space; entries of any kind with their
links; the journal of every change and its undo; a read-only query. No HTTP, no MCP, no vendor:
the REST API and the MCP server call these functions.

```mermaid
flowchart LR
  D[A door: API, MCP, worker] -->|asPerson| T[One transaction for one person]
  T --> S[save · get · find · kinds · archive]
  T --> J[history · undo]
  T --> Q[query]
  S --> J2[(journal)]
  S --> E[(entry · link)]
  Q -->|copies of her rows| R[jarvis_reader]
```

## Use

```ts
import { asPerson, pool, save, find, query, undo } from '@jarvis-os/core';

const db = pool(process.env.JARVIS_DEV_APP_URL!); // jarvis_app: cannot bypass RLS
const actor = { person: personId, door: 'api' };

await asPerson(db, personId, (tx) =>
  save(tx, actor, spaceId, {
    entries: [
      { ref: 'taxi', kind: 'Dépense', title: 'Taxi', data: { montant: 2000 } },
      { ref: 'cash', kind: 'Compte', title: 'Espèces' },
    ],
    links: [{ from: 'taxi', to: 'cash', role: 'payé avec' }],
  }),
);
```

| Function                  | What it does                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `createSpace`, `spacesOf` | a person's life, and the spaces she belongs to                                                          |
| `save`                    | new entries and changes, links added and taken away — in one call, journaled                            |
| `get`                     | one entry with its links both ways                                                                      |
| `find`                    | by words (accents and case aside), kind, creation day; archived only when asked                         |
| `kinds`                   | the kinds she has, with their counts and fields — to reuse before creating                              |
| `archive`                 | set an entry aside, never erase it                                                                      |
| `history`, `undo`         | the changes, and taking one back (journaled too)                                                        |
| `query`                   | one `select` over `my_spaces`, `my_entries`, `my_links`, `my_files` of the spaces given (decision 0004) |

## Spaces (spec 004)

A space is a circle of people (decision 0005): each person has her own, private for good; a shared
one is joined only by an invitation the invited address accepts.

```mermaid
flowchart LR
  A[Ama] --> MA[« Ama » — private]
  K[Kossi] --> MK[« Kossi » — private]
  A -->|owner| N[« Nous » — shared]
  K -->|member, by invitation| N
  N --> C[Charte · Routines · Dépenses du foyer…]
```

| Function                                        | What it does                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `createSharedSpace`, `renameSpace`              | a shared space she owns; its name                                 |
| `invite`, `invitationsOf`, `withdrawInvitation` | a link for one address, 14 days, used once; only its hash is kept |
| `previewInvitation`, `acceptInvitation`         | what a link opens; joining with the invited address               |
| `membersOf`, `leaveSpace`                       | who belongs; leaving or removing (an owner's space passes on)     |
| `clientSpaces`, `allowSpaces`, `allowSpace`     | the spaces a client (Claude, ChatGPT…) may reach for her          |

Kinds are one regardless of case and accents: a new entry takes the kind as first written in its
space. Membership changes are journaled (`space.*`) and never undone through `undo`.

## Markdown (spec 007)

Her life leaves and enters as Markdown (decision 0007).

| Function         | What it does                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `readMarkdown`   | one file: kind (front matter `kind`, else the nearest folder `kinds` names, else the parent folder), title (first heading), fields, `texte`, `source`, links |
| `importMarkdown` | a folder into a space: entries and links in batches; again, only what changed; journaled as one `import.run` that `undo` takes back                          |
| `exportMarkdown` | a space as files: one per entry (an imported one at its path, else `<kind>/<title>.md`), links under « Liens », the bytes of her files beside                |

Links come from relative Markdown links and `[[wiki]]` names (« mentionne »), and from the file that
describes a folder — `README.md`, `index.md` or `_<word>.md` — to which every file of that folder
belongs (« fait partie de »).

```mermaid
flowchart TD
  M["---<br/>cercle: 2<br/>---<br/># Christian<br/>Mon frère. [[Toujours s'associer]]"] --> R[readMarkdown]
  R --> E["Personne « Christian »<br/>cercle: 2 · texte · source (read)"]
  R --> L1["mentionne → Toujours s'associer"]
  R --> L2["fait partie de → Les 5 cercles (_cercles.md)"]
```

## Documents (spec 008)

A document is any entry whose Markdown is in `texte`: written whole, then changed one section at a
time, so a model never sends it again; read by its outline and the sections asked.

| Function        | What it does                                                                        |
| --------------- | ----------------------------------------------------------------------------------- |
| `outline`       | its headings, level and extent (never a heading inside code)                        |
| `applyEdit`     | append (to the end or a section), replace a section, insert after one, replace text |
| `writeDocument` | a new one, or one edit — journaled, so each change is a version, undoable           |
| `readDocument`  | the outline; the whole text when short, else the opening or the sections asked      |

## Time and the watcher (spec 006)

| Function           | What it does                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `timeOf`, `inZone` | a time she wrote, on the clock of her zone (Paris by default)                    |
| `nextTime`         | the next time of `repete`: « 45 20 \* \* 0-5 », « 30 19 L \* \* » (the last day) |
| `watchOnce`        | one pass: what is due is told, a repetition moves on, a stale one is skipped     |

`jarvis_due_reminders` (migration 0004) is the watcher's only look across spaces: ids and members,
nothing else; it then reads and writes as a member, under row-level security.

## The calendar (spec 011)

Time is a field any entry may carry; the calendar is computed from them, never stored.

| Field                          | In the calendar                                                    |
| ------------------------------ | ------------------------------------------------------------------ |
| `start`, `end` or `duration`   | a span; a day alone is the whole day                               |
| `at`                           | a moment                                                           |
| `due`                          | a deadline                                                         |
| `date`                         | a day, from today on (a past one is her journal)                   |
| `repeat`, `duration`, `except` | again and again, minus the days off; `start` and `until` bound it  |
| `status`                       | `cancelled` out; `proposed` marked; `done` kept, out of what comes |

| Function                            | What it does                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `agenda(tx, spaces, { from, to })`  | every occurrence in the window (366 days, 200 repeats at most) |
| `upcoming(tx, spaces, days)`        | the calendar of the next days, without what is done            |
| `renewCalendarKey`, `calendarOwner` | her phone's private address: a new key, and whose a key is     |

`jarvis_calendar_owner` (migration 0005) finds whose key a fingerprint is, and nothing else.

## What needs her (spec 013)

| Function                     | What it does                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| `attention(tx, spaces, now)` | to fix (`status` `to_fix`, `failed`), late, proposed, today, week |
| `filesOf(tx, space)`         | her files, latest first, with what each is linked to              |

## Type models (specs 012, 014)

A kind's shape, said once: an entry of kind « Model » whose title is the kind and whose data is
`{ label?, fields: [{ name, type, label?, required?, options?, optionLabels?, target?, cardinality?,
inverse?, formula?, fields?, unit?, help? }], path?, columns?, total?, groupBy?, app?, open?,
workflow? }`. Technical names are English; `label` and `optionLabels` (`{ fr, en }`) are what she
reads. Types: text,
number, amount, date, datetime, duration, choice, boolean, list, link, formula, lines.

| Function              | What it does                                                                     |
| --------------------- | -------------------------------------------------------------------------------- |
| `modelOf`, `modelsOf` | the model of a kind, every model of a space                                      |
| `checkAgainst`        | what is wrong with a save: unknown field, wrong type, a formula written, lines   |
| `placeOf`             | where the export puts an entry: `{year}`, `{month}`, `{day}`, `{title}`, a field |

`save` follows the model of each entry's kind: a `link` field given in `data` (an id or a ref)
becomes a link of that role, checked against its `target`; a `workflow` allows only its
transitions. Engine keywords are English (`keywords.ts`): old French ones are still accepted,
stored in English and reported in `notes`; migration 0006 renamed what was stored.

## The app engine (spec 014)

| Function                                  | What it does                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `parse`, `evaluate`, `formulaValue`       | the formula language: no `eval`, sentences that say where it goes wrong          |
| `readerOf`, `computedOf`, `withComputed`  | entries read through their models: relations both ways, lines, formulas computed |
| `runRequest`                              | a declarative query: `kind`, `where`, `groupBy`, `aggregate`, `fields`, `sort`   |
| `checkPage`, `renderPage`, `renderRecord` | a page's shape, its blocks computed for her filters, an entry's record page      |
| `pagesOf`                                 | the pages of a space, of one app                                                 |
| `checkRule`, `testRule`, `runDueRules`    | a rule's shape, tried on an entry, the scheduled ones (the watcher)              |
| `useScriptRunner`, `runScript`            | the engine scripts run in (a port), a script run or tried                        |
| `migrateKind`                             | rename, set, remove a field across a kind; one `migration.run`, undone at once   |
| `exportApp`, `installApp`                 | an app as a bundle, installed elsewhere                                          |
| `trial`                                   | work done in a savepoint, its journal read, rolled back                          |

`jarvis_due_rules` (migration 0007) finds the rules that may be due, and nothing else.

## Lists, groups, changes at once (spec 017)

| Function                   | What it does                                                                    |
| -------------------------- | ------------------------------------------------------------------------------- |
| `dayOf`, `folderOf`        | an entry's own day (field, source path, title, made) and folder                 |
| `listEntries`, `listStats` | any entries filtered and sorted; their statistics (streak, days, hours, splits) |
| `changeEntries`            | many entries filed, retyped or set aside: one change, undone at once            |
| `renameKind`               | a kind renamed or merged, with its model, views and groups                      |
| `groupKind`, `checkArea`   | a kind in one of her groups (an « Area » entry)                                 |

## Collections, shares, viewers (spec 016)

| Function                                              | What it does                                               |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `collectionsOf`, `collectionStats`                    | her collections, and each one's statistics from its model  |
| `press`                                               | a `button` field's action on its entry                     |
| `createShare`, `shareOf`, `sharedPage`, `submitShare` | a public form or view: made, found by key, shown, answered |
| `setRole`                                             | `owner`, `member` or `viewer` in a shared space            |
| `kilometres`, `PEGGED`, `locationOf`                  | distances and fixed currency pegs used by the formulas     |

## Views, zone, keys (spec 015)

| Function                                       | What it does                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `runView`, `viewsOf`, `checkView`              | a view run (filters, sort, columns, groups, totals, kanban, calendar); those kept |
| `filterFormula`                                | one filter as a formula (`fund.title = 'Courses'`)                                |
| `zoneOf`, `setZone`, `isZone`                  | her time zone, kept in her « Channel »                                            |
| `createKey`, `keysOf`, `revokeKey`, `keyOwner` | personal keys: made, listed, revoked; whose a key is                              |

## Database

`db/migrations/` is applied in order by `pnpm db:migrate` (the `dev` branch, or the URL in
`JARVIS_MIGRATE_URL`). Every table carries `space_id` and its row-level security policy.

## Tests

`pnpm test` runs on the Neon `test` branch (`JARVIS_TEST_OWNER_URL`, `JARVIS_TEST_APP_URL`): it
migrates it, clears its rows, then proves each story of spec 001.
