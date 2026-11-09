# Feature Specification: Production, apart and from the repository

**Feature Branch**: `010-production`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, items S1 (production apart) and S2 (deployment from the repository), chosen by
the author as the first work: « l'ordre du plan ».

## What was found (9 Nov. 2026)

- The site `jarvis-os-mkjc.netlify.app` runs two functions, `api` and `watcher` (every minute), with
  `JARVIS_BRANCH=dev`: **the author's real life lives in the Neon branch `dev`**, the one developers
  migrate, provision and test against. The Neon branch `main` holds no data.
- Its source is versioned nowhere: no `netlify.toml`, no function in the repository or its history.
  What runs in production cannot be rebuilt.
- A provisioning mistake on 8 Nov. (a new `jarvis_app` password applied to `dev`) took production
  down until it was repaired by hand.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Production is built from the repository (Priority: P1)

1. The repository holds everything Netlify needs: its configuration, the `api` function (every
   request), the `watcher` function (each minute), a page for the root.
2. One command deploys: a draft (a private address, for checking) by default, the production site
   only when asked explicitly, from `main` (constitution: production is the human gesture).
3. The watcher's pass is one function shared by the local loop and the scheduled function.

**Proof**: a draft deploy built from the repository answers `/health`, serves `/connexion` and the
OAuth metadata, and lists the two functions with the watcher's schedule.

### User Story 2 — Her life lives on its own branch (Priority: P1)

1. The Neon branch `main` becomes the production database: restored from `dev` at a quiet moment,
   its previous state kept as a backup branch; `dev` and `test` stay, children of that backup.
2. Her files are copied to the storage of `main`.
3. Netlify switches to `JARVIS_BRANCH=main` with the same accounts' secret, so no one is signed out
   and no connector must be reconnected.
4. From then on, `dev` is a copy for development: provisioning, migrations and tests never touch
   production; the production database is migrated only by a deploy of `main`.

**Proof**: after the switch, the production site answers, her entries count is the same as on `dev`
before the switch, a reminder is sent by the watcher, and `pnpm provision` run locally changes
nothing on `main`.

### User Story 3 — Development refreshed from production (Priority: P2)

1. One command resets `dev` from `main` (a fresh copy of her life to develop against), on demand.

**Proof**: after the command, `dev` has the same entries count as `main`.

### Edge Cases

- A write to `dev` between the restore and the switch would be lost: the switch is done right after
  the restore, at a quiet moment, and the entries count is compared before and after.
- The restore of `main` fails or is wrong: the backup branch keeps `main`'s previous state; Netlify
  is switched only after the counts match.
- A deploy of a broken build: Netlify keeps the previous deploy published; a draft is checked first.

## Requirements _(mandatory)_

- **FR-001**: `netlify.toml`, `netlify/functions/api.mts`, `netlify/functions/watcher.mts` and a
  root page are in the repository; the watcher's pass is exported by `apps/api/src/watcher.ts`.
- **FR-002**: `pnpm deploy:draft` and `pnpm deploy:prod` (the latter refuses to run outside `main`)
  read the Netlify token from the secrets file or the environment; no secret is printed.
- **FR-003**: `tooling/production.ts` restores `main` from `dev` (with a named backup), migrates it,
  copies the files to `main`'s storage, and prints the counts; it changes nothing without `--apply`.
- **FR-004**: `pnpm provision` never changes `main`'s roles; the local `.env` keeps no production
  owner credential.
- **FR-005**: `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` describe production, with a diagram.

## Success Criteria _(mandatory)_

- **SC-001**: What runs in production can be rebuilt from one commit of `main`.
- **SC-002**: No developer command can change the production database.
- **SC-003**: The switch costs her no sign-in, no reconnection, no lost entry.

## Assumptions

- Hosting stays on Netlify and Neon (free plans) for now; the domain is a later decision of the
  author.
- Backups (S9) and monitoring (S10) follow in the same feature once production is apart.
