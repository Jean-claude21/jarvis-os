# Feature Specification: What it changes

**Feature Branch**: `039-recurrence` (spec 044, plan v2 C10)

**Created**: 2026-11-10

## User Story 1 — Computed at each change (P1)

When a time is saved (a `start` or `at`, its `end` or `duration`), Jarvis computes without any AI what it collides with (appointments, blocks, routines — a repetition's occurrence named by its day), the deadlines inside or within two days after, the reminders inside, the people linked to what collides, and the free slots of that day (08:00–20:00 on her clock, at least as long). Through Claude, `save` gives them back in `changes`, to tell her first.

## User Story 2 — An absence replanned at once (P1)

« Je pars du 12 au 20 »: a repetition's occurrences inside are skipped, an appointment is to reschedule, a deadline inside comes the day before she leaves, a reminder the morning she is back. Proposed first (`dryRun`), applied after her yes in one save — undone at once.

Doors: MCP `save` (`changes`), tool `replan`; `GET /api/impact`, `POST /api/replan`.

**Proof**: `packages/core/tests/impact.test.ts`; `apps/api/tests/when.test.ts`.
