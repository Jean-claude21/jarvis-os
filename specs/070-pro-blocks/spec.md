# 070 — Professional blocks: a data table, a list with its record, a funnel, a ring

## Why

An app's page was a column of simple blocks. To follow an internship search, a budget, a reading list,
she needs what professional tools give, and generically:

- a real data table, with search, filters chosen from what exists, sorting and actions;
- a list beside the record of the one she picked;
- figures that read at a glance: a funnel, a ring.

Each block is declared, never coded per app. Every block draws itself in her web account and inside
Claude, so it loads nothing from the internet: plain JavaScript and SVG.

## The blocks

### `datatable` — the data table

```json
{ "block": "datatable", "kind": "JobOffer", "where": "score >= 100",
  "columns": ["company", "location", "type", "score", "status", "url"],
  "facets": ["type", "status", "source"], "link": "url", "sort": "-score",
  "action": { "label": "À creuser", "set": { "status": "interesting" } }, "more": [ … ] }
```

The core gives each entry's columns and facets (up to 1000 entries); the page does the rest, without
asking the server again. Filters work on four levels:

1. **Search** across the title and every column.
2. **Facets**: one menu per facet field, its values with their counts, ticked or unticked.
3. **Pills**: each active filter is a pill. A click removes it, and « Tout effacer » removes them all.
4. **Advanced**: conditions (field, « est / n'est pas / contient / ≥ / ≤ », a value chosen among those
   present), all of them (ET) or any of them (OU).

The table also gives:

- sorting by a column's head, and pages of 25;
- addresses as links that open the site;
- one button per gesture on each row;
- several rows ticked, then one gesture for all.

### `review` — a list and its record

```json
{ "block": "review", "kind": "JobOffer", "where": "status = 'new'",
  "subtitle": ["company", "location"], "badge": "score",
  "fields": ["company", "location", "type", "published", "source", "reasons"],
  "facets": ["type", "source"], "link": "url", "action": …, "more": … }
```

On the left, the list (search, facets and pills as above), each item with its title, its subtitle and
its badge. On the right, the record of the item picked: its fields, « Voir ↗ » opening its address,
and the gestures. A gesture moves to the next item.

### `funnel` — where things stand, step by step

```json
{
  "block": "funnel",
  "kind": "JobOffer",
  "by": "status",
  "steps": ["new", "interesting", "applied"],
  "where": "…"
}
```

Each step gives how many entries hold that value, as bars narrowing down, with its share of the first.

### `breakdown` drawn as a ring

The existing block keeps its query. It is now drawn as a ring with its legend, instead of a bar cut
in parts.

## The app's tabs

- First come the app's pages, in their order.
- Then its saved views (the map of the offers).
- Then a single « Données » menu, holding its types: the raw entries, kind by kind.

## Candidatures, rebuilt on these blocks

| Page        | What it shows                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Aujourd'hui | figures, the last collection, the new offers as a list with their record                                        |
| Offres      | every offer as a data table, with facets for type, state and site                                               |
| Suivi       | the funnel of the offers, what each site brings, the share by type, the board, the applications, the days ahead |
| CV          | the CVs and the grid                                                                                            |
| Réglages    | the searches and the sites                                                                                      |

## Not in this round

- The live block written by Claude.
- Filter groups nested more than one level deep.
- Saving a data table's filters as a view.
