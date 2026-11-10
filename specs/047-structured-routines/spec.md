# Feature Specification: Structured routines

**Feature Branch**: `039-recurrence` (spec 047, plan v2 C14)

**Created**: 2026-11-10

## User Story 1 — A routine in five parts (P1)

A « Routine » has its **trigger** (a time — kept as its `repeat`, so it is in her calendar and reminded —, a kind saved, the phrases that start it, « /bilan »), its **preparation** done by Jarvis without any AI (her day, her week, a mirror of the day or the week, her goals, what comes back, her intentions, her inbox, entries of a kind), its **instructions** for the assistant, its **references** (style, criteria, kinds) and its **result** (the entry it makes, e.g. a « Bilan », and the actions).

## User Story 2 — Followed with what Jarvis prepared (P1)

Asked by its name or a phrase, a structured routine comes to the assistant with what Jarvis prepared, now.

## User Story 3 — A routine kept as text, proposed in that shape (P1)

A routine (or an imported skill) kept as text is read by rules into its five parts and proposed for her yes in « À ranger »; accepted, it is that routine's new shape — one save, undone at once.

Doors: MCP `routine` (by name or phrase), family `apps` action `structure_routine`.

**Proof**: `packages/core/tests/routines.test.ts`; `apps/api/tests/when.test.ts`.
