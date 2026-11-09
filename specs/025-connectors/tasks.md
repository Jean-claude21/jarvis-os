# Tasks: Her tools, through Jarvis

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: connect any MCP server (P1)

- [x] T001 Migration `0019_connectors.sql`: table, policy, grants
- [x] T002 `packages/core/src/connectors.ts`: add, list, probe kept, change, cut, call journaled; journal commands `connector.*`, never undone
- [x] T003 `apps/api/src/secrets.ts`: seal and open (AES-256-GCM; `JARVIS_SECRETS_KEY`, else derived from the branch's auth secret)
- [x] T004 `apps/api/src/connectors.ts`: the MCP client (Streamable HTTP, else SSE): probe, call, when her yes is needed
- [x] T005 `apps/api/src/connector-service.ts`; routes `/api/connectors…`

## Phase 2 — US2: use them through Jarvis (P1)

- [x] T006 MCP tools `connectors` and `connector_call` (her yes for a tool that changes, deletes or sends)
- [x] T007 Proof in `apps/api/tests/connectors.test.ts`: a test server with a key; refused, connected, called, yes asked, journaled, key forgotten

## Phase 3 — The web account

- [x] T008 Connections › « What Jarvis uses for you »: add, check, cut; tried in the browser

## Later in this feature (P2)

- [x] T009 Resources: listed at each check, read through the API (US3)
- [x] T010 OAuth sign-in to servers that ask for it (US4); proof in `apps/api/tests/connectors-oauth.test.ts`; tried against Notion up to its sign-in page
- [x] T012 « Discover »: the catalog of hosted servers, one click; « Add my own connector »; every address checked live
- [ ] T011 The watcher's use of connectors (background syncs)
