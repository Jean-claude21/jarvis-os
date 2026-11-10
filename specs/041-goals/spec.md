# Feature Specification: Goals

**Feature Branch**: `039-recurrence` (spec 041, plan v2 C13)

**Created**: 2026-11-10

## User Story 1 — A goal, measurable or not (P1)

A common type « Goal » (objectif, but): measurable (`target` and `unit`, or a number in its title — « Épargner 500 000 F ») or not (« Être plus présent »), with a `deadline` (or `due`).

## User Story 2 — Progress computed, never written (P1)

Linked to what makes it move (role « advances »: a fund, an account, habits, tasks, a project), its progress is computed by Jarvis: a measurable goal adds up what they hold (`balance`, `current`, `amount`… or the field it names in `measure`, formulas computed) against its target; another averages how they are kept (a habit's last thirty days, a thing done or not). Days left to the deadline. The review (C6) and the patterns (C12) read it.

Doors: `GET /api/goals`; MCP family `figures`, action `goals`.

**Proof**: `packages/core/tests/goals.test.ts`.
