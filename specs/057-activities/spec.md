# Spec 057 — Activities, « Tâches », Executions and long work

**Status**: in progress on `057-activities` · **Date**: 2026-11-13

Everything she has to do, and everything machines do for her, in one place. Today a task, a
reminder, a follow-up of an application or a bill to pay live in their own lists; a run of an agent
leaves nothing but a reminder when it fails. This spec makes « something to do » a property any
kind can have (as time is, spec 011), gives it one page, links each one to what it is about, and
traces every piece of work done by a program — including work that takes minutes, done outside
Jarvis by a service (spec 050), which answers later.

Generic throughout: nothing is coded for one app. « Candidatures » (an application to follow up
seven days after it was sent; offers collected each morning) is the first use, not a special case.

## US1 — An activity is any entry with something to do (P1)

An entry is an **activity** when its kind is one: the common `Task`, the new `Execution`
(US4), and any kind whose model says `activity: true` (« Relance », « Facture à
payer »). Its state is its `status` (`planned` by default, `done`, `cancelled`, `proposed` — « à
valider », `failed`, `to_fix`), its time is its `due` (or `at`), and it may be for someone (`who`,
spec 038). Nothing new is stored: the activity is read from what the entry already holds.

`activities(tx, spaces, { state?, kind?, about?, when?, limit? })` lists them, open first:

- `state`: `open` (default: not done, sent, failed or cancelled), `review` (`proposed`), `failed`
  (failed or to fix), `done`, `all`;
- `when`: `late`, `today`, `week`, `later`, `undated`;
- `about`: only those that concern this entry (US3);
- each one comes with its group (late, today, week, later, undated, review, failed), its due, its
  status, its space, and what it concerns.

## US2 — The « Tâches » page (P1)

A page `#/taches` in the menu shows her activities by group — **À valider**, **En retard**,
**Aujourd'hui**, **Cette semaine**, **Plus tard**, **Sans date** — and, apart, **Travaux** (the
executions of the last days, failed first). Each line: its title, its kind, its due, what it
concerns (a link to that entry), and the actions that fit: **Fait**, **Reporter** (tomorrow, next
week), **Valider** / **Écarter** for what waits for her yes. A filter by kind and by space; a quick
add (« Appeler l'école vendredi » becomes a Task due Friday). Seen at 1366, 768 and 390 px.

## US3 — « Concernant » (P1)

An activity concerns other entries through the link role `about` (any kind: an offer, a person, a
project). It is set like any link (`links: [{ from, to, role: 'about' }]`) — by her, by Claude, by
a rule (`link`), by a service. The entry concerned shows its open activities (« À faire » on its
card), and the « Tâches » page names it on each line.

## US4 — Executions: every piece of machine work leaves a trace (P1)

A new common kind `Execution` (« Exécution »): `service` (the connection), `action` (path or
tool), `rule`, `status` (`running`, `done`, `failed`), `started`, `ended`, `counts` (`created`,
`updated`, `skipped`), `error`, `log` (a few lines). Each `call` of a rule (spec 050) now makes
one, linked `about` the rule:

- a call that answers at once closes it (`done` with its counts, or `failed` with the error — the
  reminder of spec 050 stays, linked `about` the execution);
- what an execution wrote is linked to it (role `made_by`), so she sees « 12 offres de l'exécution
  du 14 novembre » and can undo them together through the journal.

## US5 — Long work: the service answers later (P1)

A call says `long: true` (the service then answers at once, `202` with `{ "accepted": true }`).
The execution stays `running`, and Jarvis sends along, under `jarvis`:

```json
{ "jarvis": { "execution": "ent_…", "token": "jos_…", "url": "https://…/api", "until": "…" } }
```

- the **work token** is a key limited to the rule's space, to the kinds of `save` (and
  `Execution`), to this execution, and to a time (`timeout`, 30 minutes by default, 6 hours at
  most); it is revoked when the execution closes;
- with it, the service sends its results to `POST /api/receive` with `execution` (counted on it,
  linked `made_by`), then closes it: `POST /api/executions/:id` `{ status: done | failed, counts?,
error?, log? }`;
- an execution still `running` after its time is closed `failed` (« no answer in 30 minutes ») by
  the watcher, its token revoked, a reminder left;
- a second close, or a close with another execution's token, is refused.

## US6 — A connection lent for the work (P2)

A service working for her may need one of her connections (her treg account, her Drive) without
ever holding its secret. The call names what it lends: `lend: ["treg"]`. With its work token, the
service asks Jarvis: `POST /api/executions/:id/call` `{ connection, tool | path, args | body }`;
Jarvis makes the call with her connection and answers what came back. Only the connections lent,
only while the execution runs; each call is counted in the execution's log.

## Out of scope

- The page that activates a service in one click from its catalogue (next spec, with the services
  application `jarvis-atelier`).
- Reminders by e-mail or phone for activities (the reminders of spec 006 stay as they are).

**Proof**: `packages/core/tests/activities.test.ts` (an activity of a model, groups, `about`,
executions of a call, a long call kept running, closed by its token, timed out by the watcher);
`apps/api/tests/executions.test.ts` (the work token's limits, receive counted on an execution,
close twice refused, a lent connection called, one not lent refused); the « Tâches » page checked
at 1366, 768 and 390 px on dev through ngrok.
