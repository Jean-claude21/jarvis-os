# Tasks: Production, apart and from the repository

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — US1: production built from the repository (P1)

- [x] T001 Export `watcherPass(db, telegramToken, now)` from `apps/api/src/watcher.ts`; the local loop calls it
- [x] T002 `apps/api/netlify.toml`: no build step; functions shipped as bundled by `tooling/deploy.ts` (pnpm's layout broke Netlify's own bundling), with QuickJS's WebAssembly file, the shipped apps and the routines beside them
- [x] T003 `apps/api/netlify/functions/api.mts`: every path to the Hono app
- [x] T004 `apps/api/netlify/functions/watcher.mts`: one pass each minute
- [x] T005 `apps/api/netlify/public/index.html`: the root page (the app redirects)
- [x] T006 `tooling/deploy.ts` and scripts `deploy:draft`, `deploy:prod` (prod refused outside a clean `main`); esbuild pinned
- [x] T007 Draft deploy and its proof (US1): `/health` 200, `/connexion` 200, OAuth metadata 200 (issuer the production address), `/api` and `/mcp` 401; functions `api` and `watcher` (`* * * * *`); QuickJS runs from the bundle

## Phase 2 — US2: her life on `main` (P1)

- [x] T008 `tooling/production.ts` (`pnpm production`): dry run by default (counts of `dev` and `main`); `--apply` restores `main` from `dev` with a backup branch, checks `jarvis_app` on `main`, copies her files, compares the counts; `--switch` also sets Netlify's `JARVIS_BRANCH` and `JARVIS_MAIN_*`
- [x] T009 `tooling/provision.ts`: never invents nor changes `jarvis_app`'s password when the role exists (the cause of the 8 Nov. outage); writes no credential of `main`; keeps the `.env` keys it does not manage; reads `../.secrets/.admin.env`
- [x] T010 With the author's yes (9 Nov.): `pnpm production --apply --switch` — `main` restored from `dev` (backup `main_before_production_2026-11-09`), `jarvis_app` logs in, 2 files copied, counts whole (4 accounts, 5 spaces, 763 entries, 2 687 links, 3 486 journal lines, 1 file); Netlify set to `main`; `pnpm deploy:prod` from `main`. Proof: `/health` 200, `/connexion` 200, OAuth 200, `/api` and `/mcp` 401; the published deploy runs `api` and `watcher` (`* * * * *`); the online app's connections reach `main`, none reach `dev`. The local `.env` keeps no credential of `main`. Netlify's old `JARVIS_DEV_*` variables are kept one week, then removed.

## Phase 3 — US3: development refreshed from production (P2)

- [ ] T011 `pnpm db:refresh-dev`: reset `dev` from `main`

## Phase 4 — Documents

- [x] T012 `docs/ARCHITECTURE.md` (production, diagram), `docs/ROADMAP.md` (010 built), `.env.example`
