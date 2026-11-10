# Feature Specification: Intentions and what follows them

**Feature Branch**: `039-recurrence` (spec 040, plan v2 C11)

**Created**: 2026-11-10

## User Story 1 — What she means to do is kept (P1)

« Je vais… », « il faut que je… », « je dois… », « demain je… », « I need to… » in a capture become an « Intention » (open, done, dropped), linked to the capture, with each time she said it. Said again in other words (« il faut que j'appelle Paul »), it is the same one once more. Rules only.

## User Story 2 — Closed by what does it (P1)

An entry she makes whose title and kind hold every word of the intention (« Appel avec Paul » for « appeler Paul ») closes it, linked `done_by`. Journaled, undone at once.

## User Story 3 — It comes back (P1)

Said twice or more, or three days ago and still open: in « Maintenant » (group `intent`, with how many times and since when) and in the morning brief: « dit 4 fois depuis le 20 oct., rien n'a suivi : planifier, déléguer ou abandonner ? ». The review (C6) reads the same.

**Proof**: `packages/core/tests/intentions.test.ts`; the brief line in `apps/api/tests/brief.test.ts`.
