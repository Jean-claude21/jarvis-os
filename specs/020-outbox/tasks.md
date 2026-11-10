# Tasks: Every message, on her channel, and its trace

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: the outbox (P1)

- [x] T001 Migration `0013_outbox.sql`: table, policy, grants, `jarvis_outbox_pending`, `jarvis_outbox_person`
- [x] T002 `packages/core/src/outbox.ts`: `enterMessage`, `pendingMessages`, `markSent`, `markFailed`, `recentMessages`, `messageOf`, `markActed`
- [x] T003 Proof of US1 in `packages/core/tests/outbox.test.ts`

## Phase 2 — US2: e-mail and actions (P1)

- [x] T004 `apps/api/src/channels.ts`: Telegram and e-mail (nodemailer, SMTP); her channels per kind
- [x] T005 `apps/api/src/watcher.ts`: reminders and briefs entered in the outbox, then delivered
- [x] T006 `apps/api/src/act.ts`: signed links, `GET /act/:token` (confirm page), `POST /act/:token` (act)
- [x] T007 `GET /api/outbox`; words in `i18n`
- [x] T008 Proof of US2 in `apps/api/tests/outbox.test.ts`

## Phase 3 — Documents and delivery

- [x] T009 `docs/ARCHITECTURE.md`, `.env.example`, Netlify variables documented
- [ ] T010 Local checks, PR to `dev`, then `main`, deploy
