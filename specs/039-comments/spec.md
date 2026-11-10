# Feature Specification: A note on an entry

**Feature Branch**: `039-recurrence` (spec 039, plan v2 C8)

**Created**: 2026-11-10

## User Story 1 — Her note on anything (P1)

Any entry may carry notes: a « Comment » linked to it (`on`), her words as she wrote them (« said »), who wrote it (`by`) and when, the oldest first. In a shared space each member sees them. Journaled, undone at once, set aside like any entry. The entry's card (C1, I3) shows them.

Doors: `GET`/`POST /api/entries/:id/comments`; through Claude, `save` a « Comment » linked « on ».

**Proof**: `packages/core/tests/comments.test.ts`.
