# Feature Specification: For whom

**Feature Branch**: `039-recurrence` (spec 038, plan v2 C5)

**Created**: 2026-11-10

## User Story 1 — A thing says for whom (P1)

In a shared space, an entry's `who` names a member — by her name, her first name, her email, « moi », or her id — or nobody in particular (« personne », « tous »). Jarvis keeps the member's id; a name that is no member, or names several, says so with the members to choose from.

## User Story 2 — Each sees what is hers (P1)

« Maintenant » shows her what is hers and what is for nobody; what is for another member stays theirs. A reminder — its own `who`, else its thing's — goes to that member alone.

**Proof**: `apps/api/tests/who.test.ts`.
