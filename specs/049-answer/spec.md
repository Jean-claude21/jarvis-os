# Feature Specification: A search that answers

**Feature Branch**: `041-interface-v2-b` (spec 049, plan v2 I8)

**Created**: 2026-11-10

## User Story 1 — A figure, never from memory (P1)

« Combien en transport en octobre ? », « combien de prières cette semaine ? », « how much last month? »: Jarvis reads the period (a month named, this or last week or month, this year, today, yesterday; this month otherwise) and the words, then the database sums her money movements that match, or — when none matches and she did not speak of money — counts what she kept. A word that names one of her kinds counts that kind. Without any AI.

## User Story 2 — What justifies it (P1)

How many, the period before (and the difference), week by week, the largest or latest entries, each opened in one tap.

Doors: `GET /api/answer?q=`; the search box of her web account.

**Proof**: `packages/core/tests/answer.test.ts`.
