# Feature Specification: What comes back

**Feature Branch**: `039-recurrence` (spec 042, plan v2 C12)

**Created**: 2026-11-10

## User Story 1 — Counted by Jarvis (P1)

Without any AI, Jarvis counts what comes back, each with its figures and the entries it was counted from, marked « inferred »: a state said three times or more in fourteen days (`mood`, `state`, `humeur`, `état`…); a habit whose last thirty days are twenty points under the thirty before; a spending category a third over its usual (its last thirty days against the average of the ninety before); a person linked to or named in four entries or more in thirty days.

## User Story 2 — Read by the assistant (P1)

At the brief and the review, the assistant says what they may mean, as « déduit », with the figures, never more than they say.

Later: apps adding their own patterns.

Doors: `GET /api/patterns`; MCP family `figures`, action `patterns`.

**Proof**: `packages/core/tests/patterns.test.ts`.
