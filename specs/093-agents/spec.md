# 093 — Visible agents (v3 D12, V8), and Markdown read as a page

## Step back

An AI employee is not one more module. It is **a named setting of the same node**: the rules,
scripts and services that already run, grouped under a name, with its settings. Nothing new
executes. An agent's settings apply where its rules have always run:

- **Pause**: a paused agent does nothing.
- **Budget**: past its budget, its service calls wait until tomorrow.
- **Autonomy**: « propose » turns what it would write into a proposal in « À valider ».
- **Signature**: every change it makes is journaled with it as the author.

A rule says which agent runs it (`agent`). One agent can therefore serve several apps (the
Veilleur d'échéances watches offers, warranties and bills), and an app update gives it its rules
layer by layer.

## What changes

1. **`agent-node.ts`**:
   - **Settings** (`agentSettingsSchema`): role, executor (rule / script / llm / service),
     service, skills, the kinds it reads and writes, Jarvis's own works (`builtin`), autonomy,
     budget (calls per day), paused.
   - **Built-in agent**: the **Secrétaire des papiers**, who does the V7 reading. It has no
     entry until she changes it.
   - **Reads**: `agentsOf` gives, for each agent, its rules, today's calls, its last runs (its
     executions) and its state (prêt, au travail, en pause, budget du jour atteint, en échec).
   - **Changes**: `setAgent` updates an agent's settings.
2. **Rules** (`rules.ts`):
   - A rule can name its `agent`, and the rule is then signed `agent:<name>`.
   - Paused, the rule does nothing. Over budget, a rule that calls a service waits.
   - In « propose », what the rule would create or change becomes a proposal.
   - An agent does not trigger itself again.
   - The journal counts agents as « automatique ».
3. **Reading**: the Secrétaire signs its work. While paused, dropped files are kept but neither
   understood nor proposed.
4. **Bundles**: an app ships its `agents`, and its rules name them.
   - Candidatures (release 2): the Chasseur d'offres (Atelier service, 4 calls per day) and the
     Veilleur.
   - Garanties: the rule « Fin de garantie », 30 days before.
   - Finances: the rule « Facture à payer », 3 days before, unless paid.
   - The `app_install` instructions tell assistants how to write an agent.
5. **API**:
   - `GET /agents` lists them; `PATCH /agents/:title` changes paused, autonomy, budget or role.
   - `GET /skills/:name/SKILL.md` serves a skill in the _Agent Skills_ format (name, description,
     instructions), so it also works in Claude.
   - `GET /history?client=` filters the journal by author.
6. **Atelier** (the « bientôt » screen is gone):
   - Two tabs: Agents (cards: state, role, when, calls today, Pause) and Skills (SKILL.md download).
   - Each agent has its page: how it works, its runs, its journal, its freedom, its budget and its
     rules.
7. **Markdown read as a page** (`ui/Markdown.tsx`, marked and DOMPurify, served by Jarvis):
   - What it renders: headings, lists, tables (scrolling inside their own frame), quotes on a
     sand tint, code, task boxes (☑ ☐), and web links that open in a new tab.
   - A link to another file of a notes folder stays a word, with its path shown on hover.
   - An entry's text is shown this way.
   - Files are previewed by type:
     - `.md` as a page;
     - `.txt` and JSON as they are;
     - CSV as a table;
     - audio and video in a player;
     - Word and others through the text Jarvis read (`GET /files/:id/text`).
   - Reading facts are kept only for a document of a known genre: a table no longer gets a
     « De ».

## Proof

Core tests:

- `agent-node.test.ts`: signed, paused, propose; a built-in agent materialised on its first change.
- The whole core suite passes. One stale expectation since V6 was fixed: an install also creates
  the « App » entry.

In the real app:

- Candidatures, Garanties and Finances installed give three agents (Secrétaire with 0 rules,
  Chasseur with 2 and a 4-call budget, Veilleur with 3).
- With the Secrétaire paused, a dropped invoice made no proposal. After « Reprendre » and
  « Relire »: « facture.txt : 129,99 € chez Fnac », signed by the Secrétaire.
- SKILL.md is served in the right format.
- The user's Markdown note shows as a page; CSV shows as a table.

Checked at 1440, 1024 and 390 px, with no overflow and no page error.
