# Feature Specification: Apps installed on what she keeps, removed without loss

**Feature Branch**: `037-apps-install-remove` (spec 034, plan v2 A5–A7)

**Created**: 2026-11-10

## User Story 1 — Installed on what she keeps (A5, P1)

Trying an install (`dryRun`) also says what she already keeps that the app can use: her entries under another name of one of its kinds (« Compte » for « Account »), each with its fields renamed — a merge proposed, done only after her yes (`apps`, action `merge_kinds`).

## User Story 2 — Proposed, not imposed (A6, P1)

An install is one gesture, one line in the journal, undone at once (already true); « not for me » is remembered in her preferences (`appsDeclined`, `POST /api/apps/decline`).

## User Story 3 — Removed without loss (A7, P1)

Removing an app sets aside its role, pages, rules, scripts and the models of its own kinds — one line `app.remove`, undone at once; every entry of hers stays, and the models of the common types stay for her other apps (`apps`, action `app_remove`; `POST /api/apps/remove`).

**Proof**: `packages/core/tests/apps-lifecycle.test.ts`.
