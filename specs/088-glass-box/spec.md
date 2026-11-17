# 088 — The glass box (v3 V4: D9, D11, D13)

## Step back

V4 is two modules already in the core — the journal (who, how, before/after, undo) and the queue
of what waits for her yes (spec 046: captures, proposed entries, proposals across apps, kinds
that are one) — shown in the one door of the present, « Aujourd'hui ». No new screen, no new
store: the journal gains filters, the client shows what the core already holds.

## What changes

1. **The journal filtered** (`GET /api/history`): `author` (`me`: her hand; `assistant`: MCP or a
   program's key; `auto`: the watcher, a rule, a script, a source, a check; `telegram`),
   `commands` (exact, or a prefix such as `entry.`), `since`. Additive in `history()`.
2. **« À valider » first in Aujourd'hui**: the one queue, each nature with its own gesture —
   Accepter / Refuser (proposed entries and proposals, the latter saying why and what they make),
   Fusionner / Ignorer (kinds that are one), Mettre de côté (a capture) — and Tout accepter,
   Ranger ce qui est sûr. What waits there shows nowhere else on the page.
3. **The receipt**: « Ce que Jarvis a fait pour toi » — today's changes not made by her hand,
   grouped by who (« Source « Jours fériés » a créé 13 entrées »), with a link to them.
4. **Activité**: filters Qui · Quoi · Quand kept in the URL; each creation or change opens on its
   fields, before → after (the values as stored); undo on every entry change.
5. The engine's states in her words (à faire, à ranger, proposé…); her own model's states as
   she wrote them.

## Proof

Three natures in the queue; « Tout accepter » made both proposals and left the capture; the
receipt and « Automatique · Aujourd'hui » show the source's 13 entries; a change opens on
`status: new → to_apply`; 1440, 1024 and 390 px without overflow.
