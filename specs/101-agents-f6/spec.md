# 101 — F6: the brief and the reminders as agents, phrase and message triggers, memory, reports (v3 D12; plan section 32)

## Step back

- An agent is still **a named setting of the one node** (spec 093). Nothing new executes:
  - the morning brief and the reminders already ran in the watcher;
  - rules already ran after a save;
  - notes and the outbox already existed.
- F6 puts the brief and the reminders **under an agent's name** and gives every agent three more
  things through what exists:
  - a trigger by **phrase** or by **message**: a capture is how anything reaches her, so a rule
    reads the capture;
  - a **memory**: notes on its entry, like any entry's notes;
  - a **report on Telegram**: one message in the outbox, like a reminder.
- No life domain is named. The phrase, the words of a message and the notes are hers.

## What changes

1. **Two built-in agents**, in every space, beside the Secrétaire des papiers. Like her, each one
   gets its entry only when its settings are first changed.
   - **Assistant du matin** (`builtin: brief`):
     - paused, no brief is sent, and the day is not marked as sent: it comes the next morning
       after « Reprendre »;
     - its marking is signed `agent:Assistant du matin`;
     - its « Quand » reads her hour: « chaque jour à 07:00 », or « quand tu choisis une heure dans
       Réglages ».
   - **Gardien des rappels** (`builtin: rappels`):
     - paused, reminders wait;
     - its rescheduling is signed with its name.
2. **Rules start on a phrase or a message** (`when`):
   - `{ phrase: "/bilan" }`: she says the phrase, from Telegram, the app or an assistant
     (« /bilan semaine » says it; « /bilanx » does not). The rule runs on her capture, and the
     capture is filed: an order done does not wait in « À ranger ». The journal keeps it.
   - `{ message: { contains? } }`: every message that reaches her, or those with these words.
   - Telegram now passes « /words » on as captures (`/start` keeps its own meaning).
3. **Memory** (`remember`):
   - A note kept on the agent's entry, by her (the agent's page, « Sa mémoire ») or by an
     assistant doing its work (MCP `agent_remember`).
   - `agentsOf` gives the 50 newest notes. An assistant reads them before doing the agent's work.
4. **Reports** (`report: activity | telegram`):
   - On « Activité et Telegram », each run of its rules enters one message in the outbox:
     « Arroser » : fait. When it proposes, the message says what waits in « À valider ».
   - Only when her Telegram is linked. The Activity keeps everything in any case.
5. **Doors**:
   - API: `PATCH /agents/:title` takes `report`; `POST /agents/:title/memory`.
   - MCP, new family « agents »: `agents` (state, when, rules, runs, memory), `agent_set` (pause,
     autonomy, report, budget, role), `agent_remember`.
6. **The agent's page**:
   - « Quand » says the built-in agent's moment and a rule's phrase (« quand tu dis « /bilan » »)
     or message;
   - « Sa liberté » adds « Compte rendu »: Activité, or Activité et Telegram;
   - « Sa mémoire »: the notes, newest first, and one to write.

## Checked

- Core tests (`tests/agents-f6.test.ts`):
  - the Assistant du matin is listed with « chaque jour à 07:00 ». Paused, it sends nothing and
    marks nothing; resumed, it sends and signs. The Gardien des rappels is listed;
  - « /Bilan semaine » runs its rule and files the capture. « /bilanx » does neither. A message
    with « URGENT » starts the message rule;
  - a note kept for the Secrétaire gives her an entry and shows in her memory. A report is entered
    only after « Activité et Telegram »: one message, « Arroser » : fait.
- Existing tests: `agent-node`, `brief`, `reminders`, `inbox`.
- Real run on a quiet server (Neon `test` branch, side effects off):
  - « /bilan semaine » said through the app's inbox made the task, signed « Le Bilan », and left
    nothing in « À ranger »;
  - on the Assistant du matin's page, at 1024 px, a note was kept, « Activité et Telegram » chosen,
    and « Mettre en pause » pressed. The API then read: paused, report telegram, state paused, the
    note in its memory;
  - Le Bilan's page at 390 px: « quand tu dis « /bilan » », its journal, and nothing past the edge.

## Left for later

- Running a phrase from the app has no button of its own: she writes it in the inbox or on
  Telegram.
- The executor « modèle avec skills » (an agent loop on Jarvis's side) and « où il tourne » come
  with the Service (F8).
- Telegram answers a phrase with the same « gardé » as any capture. Saying which agent took it is
  a later change.
