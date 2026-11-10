# Feature Specification: A person's card

**Feature Branch**: `039-recurrence` (spec 045, plan v2 C4)

**Created**: 2026-11-10

## User Story 1 — Who they are to her, across her apps (P1)

For an entry « Person », read from what she keeps without any AI: the last dated thing with them (linked, or naming them), what she promised them (open tasks and intentions), the next dated thing with them, and everything that touches them, by kind (calls, money, events, notes…). The card of the interface (I4) draws it.

Doors: `GET /api/people/:id`; MCP tool `person` (by id or name).

**Proof**: `packages/core/tests/person-card.test.ts`.
