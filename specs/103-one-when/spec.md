# 103 — F6b: one word, one « when », an agent for every automation (v3 D12; after F6)

## Step back

J-C's screens (18 Nov) showed three natures that overlapped:

- a **skill** and a **routine** are the same entry under two names, listed twice (Agents and
  Skills tabs);
- **two ways to say « when »**: a rule's `when`, and a routine's own `trigger` (`phrases`,
  `repeat`, `saved`). F6 added a phrase to rules beside the routines' phrases;
- **rules « sans agent »**: no Pause in common, no budget, signed « règle ». Some called a service
  outside the budget of the agent meant for it.

The v3 says three things, each in one place:

|             | What                                                                | Who runs it                          |
| ----------- | ------------------------------------------------------------------- | ------------------------------------ |
| **Agent**   | _who_ works by itself: name, Pause, budget, freedom, memory, report | —                                    |
| **Skill**   | _how_ to do a thing: instructions for the AI                        | her assistant, when asked or started |
| **Trigger** | _when_: a time, a date, a save, a phrase, a message                 | the same words for rules and skills  |

Nothing new runs. The vocabulary is gathered, and every rule gets someone to answer for it.

## What changes

1. **One trigger vocabulary** (`core/src/triggers.ts`, `triggerSchema`):
   - the forms: `saved`, `changed`, `schedule`, `before`, `phrase`, `message`;
   - a rule's `when` is one trigger;
   - a skill's `triggers` is a list of them;
   - migration 0037 rewrites each skill's old `trigger` in these words. Each phrase is kept. So is a
     time of five fields, and so is a kind saved. A time in words stays her reminder (`repeat`),
     untouched;
   - `structureFromText` and `structure_routine` propose `triggers`.
2. **One phrase starts one thing** (`checkPhrases`, on every save):
   - a rule or a skill that takes a phrase another rule or skill of the space already has is
     refused. The message names the one that has it;
   - a phrase that names a rule is done by Jarvis (F6). One that names a skill is followed by her
     assistant (MCP `routine`), until an agent runs skills itself (F8).
3. **Every rule has an agent** (`agentsOfRules`, `agentOfRule`). Nothing is written. In order:
   - the agent the rule names;
   - else the agent that reaches the service it calls (its `service`);
   - else the one agent its app's other rules name;
   - else an agent named after its app (« Finances »), whose role says so;
   - else, for her own rules: the **Gardien des rappels** when the rule only reminds, the
     **Intendant** otherwise.

   That agent's Pause, budget and autonomy apply, and its name signs the work. A rule never starts
   itself again (`actor.rule`), whoever signs it.

4. **Screens**:
   - Construire › Agents et automatismes:
     - each agent lists every rule it answers for. One it answers for by default says
       « par défaut », and every rule can be given to another agent (« Confier à… »);
     - the panel « Sans agent : à confier » is gone, and so is the second list of routines;
   - Construire › Skills: each of her skills says when it starts (« quand tu dis « /bilan » »,
     « chaque samedi à 9 h 00 »), or « quand tu le demandes à ton assistant »;
   - the word on screen is **skill**, in Bilans too (« Le skill qui le structure »). « Routine »
     stays the stored kind and the MCP tool's name.
5. **Bilans**:
   - « Nouveau bilan » offers the skills that say they write a « Bilan » (`result`);
   - only when none says so, those named for one.

## Checked

- Core tests (`tests/triggers-f6b.test.ts`):
  - a rule taking a skill's phrase (« /Bilan » against « /bilan ») is refused, naming the skill;
  - a rule calling Atelier is answered for by the Chasseur d'offres (its `service`). A Finances
    rule naming no agent is answered for by « Finances », with its role. Her reminder goes to the
    Gardien des rappels, her other rule to the Intendant;
  - the Finances rule's work is signed `agent:Finances`; paused, « Finances » stops it.
- Updated:
  - `routines.test.ts`: a skill structured from text gets `triggers`;
  - `engine.test.ts`: an app's rule is signed by its agent.
- The whole core and API suites.

## Left for later

- A phrase that names a skill, said on Telegram, waits in « À ranger » for her assistant. An
  agent running the skill itself comes with the executor « modèle avec skills » (F8).
- The frozen v2 client still reads the old `trigger`: it goes at the switch (V9).
