# Feature Specification: What waits for her yes

**Feature Branch**: `039-recurrence` (spec 046, plan v2 C7)

**Created**: 2026-11-10

## User Story 1 — One place, « À ranger » (P1)

Everything that waits for her yes, in her spaces: her captures to file (A8), the entries proposed (`status: proposed`, by a form, a rule, Jarvis), the proposals across her apps, the kinds that are one thing (T2).

## User Story 2 — A proposal across her apps (P1)

« J'ai acheté un frigo 250 000 F »: one « Proposal » holds what it would make — the expense, the thing, its warranty — with the links among them, why, and the apps it touches. Nothing is made before her yes.

## User Story 3 — Her answer (P1)

Yes makes it in one save, undone at once: a proposed entry takes the status it was proposed for (`then`, else planned); a proposal makes its entries, linked `from_proposal`, and is marked accepted. No sets the entry aside, or marks the proposal declined.

Doors: MCP family `inbox` (`to_sort`, `propose`, `decide`); `GET /api/to-sort`, `POST /api/to-sort/:id`.

**Proof**: `packages/core/tests/proposals.test.ts`; `apps/api/tests/when.test.ts`.
