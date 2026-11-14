# 071 — The live block: a component written by the assistant, for one need

## Why

The declared blocks (spec 070) cover most needs. Some need a picture nobody declared: offers found per
day and per type, a timeline of her applications, a weekly chart of her spending against her budget.
She asks it in plain words. The assistant (Claude, Claude Code) writes a small component and pins it
to her page. It is regenerated when she wants another one.

## What

```json
{
  "block": "live",
  "title": "Offres trouvées par jour",
  "data": { "kind": "JobOffer", "where": "score >= 100", "fields": ["published", "type"] },
  "height": 360,
  "code": "<div id=c></div><script>const rows = JARVIS.rows; …</script>"
}
```

- **`data`**: what the component may read. Either `{ kind, where?, fields }` (the entries with those
  fields, up to 2000), or `query` (a declared query, as the `table` and `bar` blocks have).
  The page's filters apply (`{type}`).
- **`code`**: plain HTML and JavaScript, at most 60,000 characters. It reads `JARVIS`:
  - `JARVIS.rows`: `[{ id, title, values }]`, or the query's `{ columns, rows }`;
  - `JARVIS.labels`: the fields' and choices' words, in her language;
  - `JARVIS.theme`: her colours;
  - `JARVIS.lang`.
- **`height`**: 120 to 1200 pixels.

## Safety

The component runs in a sandboxed frame:

- scripts only;
- no access to her session, her cookies, the page or the API;
- it reads only the data its block declared, computed by the core under her rights;
- it may open a link in a new tab, nothing else.

Nothing is loaded from the internet: the code carries everything it draws, in SVG, HTML or a canvas.

Inside Claude, where nested frames are not shown, the block says that it is live and where to see it.

## Writing one

The assistant writes the block into the page's `blocks` like any other, after showing her what it
will draw. It keeps it small, readable and in her colours, and draws what the data says, nothing
invented. A broken component breaks only its own frame.
