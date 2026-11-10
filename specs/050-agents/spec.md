# Spec 050 — Agents outside Jarvis

**Status**: implemented on `050-agents` · **Date**: 2026-11-11

An agent of hers runs outside Jarvis (a program on her server: collecting job offers, reading a
site, any work too heavy or too risky to run inside). Jarvis stays the place where everything is
kept, checked and shown: the agent never gets her whole life, and nothing it sends skips the rules
her models set. Four pieces, each generic: nothing is coded for one agent or one app.

## US1 — A key for a program, with its limits (P1)

She makes a key for a program in « Compte » (as the personal keys of spec 015), and gives it limits:
**one space** (the key sees and writes only there) and, if she wants, **the kinds it may write**
(« Offre », « Entreprise »). The journal names the key on each line it wrote (« clé Agent emplois »),
so she knows what came from it and undoes it as anything else. A key without limits stays what it
was: her own app, as her.

- A request with a limited key that names another space is refused (403).
- A save with a limited key that writes a kind outside its list is refused (403), nothing written.

## US2 — Jarvis calls an agent (P1)

A rule (spec 014) has a new action `call`: on a schedule (« every day at 7 »), when an entry is
saved, or some days before a date. It reaches one of her **connections** (spec 025), by name — so
the address and the secret stay sealed in the connection, never in the rule:

```json
{
  "call": {
    "connection": "Agent emplois",
    "path": "/search",
    "body": { "contracts": "Stage" },
    "include": "Profil de recherche",
    "save": { "kind": "Offre", "at": "offers", "match": "url", "title": "{position} — {company}" }
  }
}
```

- `path` (an HTTP connection): a POST of `body` (formulas allowed, as in `create`) with, under
  `entries`, the title and data of her entries of the kind `include` (her criteria).
- `tool` (an MCP connection): the tool called with `body` as its arguments.
- `save`: what the agent answered (the list at `at`, or the answer itself) becomes entries of
  `kind`, each passed through the field mapping (US3) and checked by her model; with `match`, an
  entry with the same value of that field is updated, not made twice. Nothing else of the answer is
  kept.
- Only `https` addresses outside private networks are called (or `http://localhost` on a developer's
  own machine), 20 seconds at most, an answer of 2 MB at most. A failure leaves a reminder saying
  what failed, and the rest of the rule is not run.
- A connection can be « HTTP » (a plain web address) as well as MCP: Connexions does not show it as
  broken for not speaking MCP.

## US3 — Her model translates (P1)

A field of a model can name other names it is given under: `aliases: ["job_title", "position"]`.
Whatever writes an entry of that kind (an agent, an import, Claude) with `job_title` has it written
as the field — the agent keeps its own words, her model keeps hers. Configured in the model, no code.

The same answer can also come in by itself: `POST /api/receive` `{ kind, items, match?, title? }`
(with a key) writes a list as US2's `save` does.

## US4 — An app's own patterns (P2)

An app's role (spec 033) can say what to watch for in her life: `patterns: [{ about, kind, where?,
rise? }]` — « Transport en hausse » counts (or sums, with `sum`) the entries of `kind` matching
`where` over the last 30 days against the 30 before, and comes back in her review (« Ce qui
revient ») when it moved by `rise` percent (30 by default), named with its app.

**Proof**: `packages/core/tests/agents.test.ts` (aliases, receive with match, key limits, call with
a stubbed caller, app patterns); `apps/api/tests/agents.test.ts` (a limited key refused outside its
space and kinds; `/api/receive`; a rule calling a local agent); every screen touched checked at
1366, 768 and 390 px on dev through ngrok.
