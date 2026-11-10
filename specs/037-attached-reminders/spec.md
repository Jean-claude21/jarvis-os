# Feature Specification: Reminders attached to a thing

**Feature Branch**: `039-recurrence` (spec 037, plan v2 C3)

**Created**: 2026-11-10

## User Story 1 — « 1 jour avant », moved with it (P1)

A dated thing (a `start`, `at`, `due`, `date` or `repeat`) says its reminders in `remind` (« 1 jour avant », « 15 min », « 2h », « la veille »). Jarvis keeps one « Reminder » per offset, linked to it (`for`), at its next time minus the offset — moved when the thing moves, set aside when she removes the offset or the thing is done or cancelled. Without any AI.

## User Story 2 — The next occurrence (P1)

For a thing that repeats, once a reminder is sent, Jarvis sets it for the next occurrence (a done or cancelled occurrence is skipped).

## User Story 3 — Her defaults (P2)

In her preferences, `reminders` by kind (« Event »), by space and kind (« Famille/Event ») or for all (« * »): applied to a new dated thing that says none.

**Proof**: `packages/core/tests/reminders.test.ts`.
