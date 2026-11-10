# Feature Specification: The review

**Feature Branch**: `039-recurrence` (spec 043, plan v2 C6)

**Created**: 2026-11-10

## User Story 1 — The mirror, prepared by Jarvis (P1)

For a period (the last seven days by default), Jarvis prepares without any AI: what she kept by kind, what she did, her money out and in, what she said she would do and nothing followed (C11), her goals and how far they went (C13), what comes back (C12) — and her own questions (`review.questions` in her preferences), else the usual four.

## User Story 2 — Her decisions become actions (P1)

The review is kept as a « Review » (her answers, its period); each decision becomes a task (with its due day and for whom when she said them), linked `decided_in`. One save, undone at once.

Doors: MCP tool `review` (`prepare`, `keep`); `GET`/`POST /api/review`.

**Proof**: `packages/core/tests/review.test.ts`; `apps/api/tests/when.test.ts`.
