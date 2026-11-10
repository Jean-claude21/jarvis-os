# Tasks: Who may come in, and how many tries

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: sign-up on invitation (P1)

- [x] T001 Migration `0018_signup.sql`
- [x] T002 `auth.ts`: `SignUpRule`, `signUpRuleOf`, `mayJoin`, the `user.create.before` hook
- [x] T003 The sign-in page's words for a refusal

## Phase 2 — US2: attempts counted (P1)

- [x] T004 `auth.ts`: rate limit in the database, client address headers; off for the test suite
- [x] T005 Proof in `apps/api/tests/security.test.ts`

## Phase 3 — Documents and trial

- [x] T006 `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `.env.example`
- [x] T007 Local checks; tried locally; merged into `dev`
