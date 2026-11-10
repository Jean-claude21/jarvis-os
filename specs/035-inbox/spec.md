# Feature Specification: Raw capture, filed later

**Feature Branch**: `038-inbox` (spec 035, plan v2 A8)

**Created**: 2026-11-10

## User Story 1 — Kept at once, as she said it (P1)

Whatever arrives is kept at once as a « Capture »: her words, its source (telegram, claude, app), its exact time, « said » — even without any AI. Any message to the bot from her linked chat is kept so, and the bot answers « Gardé ✓ — à ranger ».

## User Story 2 — Pre-sorted by rules only (P1)

Hashtags, the words her apps declare (their roles, spec 033), an amount with its currency (« 2 000 F », « 12,50 € »), an account (« cash », « Flooz », « banque »). Sure when one app claims it and an amount is there.

## User Story 3 — Filed later (P1)

One by one (what it becomes, linked to it `from_capture`, the capture marked filed — one step, undoable) or « everything sure » (a movement of money, out unless « reçu », its fields fitting her model, the rest in the note). A rule per source in her preferences (`capture`: inbox or auto). The morning brief says how many are to file.

Doors: MCP family `inbox` (capture, inbox, file_capture, file_sure); `/api/inbox`.

**Proof**: `packages/core/tests/inbox.test.ts`; the brief line in `apps/api/tests/brief.test.ts`.
