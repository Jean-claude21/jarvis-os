# Feature Specification: Repetitions, occurrence by occurrence

**Feature Branch**: `039-recurrence` (spec 036, plan v2 C2)

**Created**: 2026-11-10

## User Story 1 — A repetition as she says it (P1)

« Tous les lundis à 7h », « le 2e lundi du mois à 18h », « le dernier vendredi », « tous les mois le 5 », « en semaine à 6h30 » are read by Jarvis, without any AI, into the five fields it keeps (`1#2` the second Monday, `5#L` the last Friday), and said back (`understood`). It ends on a day (`until`) or after so many times (`count`), skips days (`except`), and never shows before its `start`.

## User Story 2 — Each occurrence has its own state (P1)

One occurrence, named by its day, is done, missed, postponed to another time (shown there, marked moved) or cancelled; the others follow the repetition. Put back with nothing. One save: journaled, undone at once. The agenda gives each occurrence its `day` and its `status`.

Doors: MCP tool `occurrence`; `save` reads `repeat` in her words; `agenda` gives the states.

**Proof**: `packages/core/tests/recurrence.test.ts`; `apps/api/tests/when.test.ts`.
