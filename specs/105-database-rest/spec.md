# 105 — Rest for the database (after the Neon quota of 19 Nov 2026)

## What happened

On 19 Nov 2026 Neon refused every connection to the project `jarvis-os`: « Your account or project
has exceeded the quota ». Production and next answered « Site not available ».

Neon bills **compute hours** per project, every branch counted (main, next, dev, test). A branch's
compute suspends only after **5 minutes without a query**. Five things kept the branches awake day
and night:

| Where                         | What                                                                                                     | Effect                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Netlify, scheduled function   | a watcher pass **every minute**, and a ping to `/health` « to keep the server awake » (commit `0fb5c48`) | production awake 24 h a day                 |
| Server of its own (`host.ts`) | the same pass every minute                                                                               | production awake 24 h a day, a second time  |
| Docker `HEALTHCHECK`          | `/health` **every 30 seconds**, and `/health` reads the database                                         | production **and next** awake 24 h a day    |
| The live journal (`live.ts`)  | a listening connection opened by the first screen, **never closed**                                      | the branch awake as long as the server runs |
| Connections check             | every hour                                                                                               | a wake each hour                            |

Two branches always on, at the smallest size, use about 360 compute hours a month: more than the
free quota. The test suites, run many times a day on the same project, added their share.

## What changes

1. **The watcher sleeps.**
   - It looks at the clock every minute, without the database.
   - It opens the database only when:
     - something is due: the next reminder, the next brief, the next scheduled rule, the next retry
       of a message;
     - a change came in through a door of the same server;
     - a message waits on Telegram, which is checked without the database;
     - an hour has passed, the longest it sleeps (`LONGEST_SLEEP_MS`).
   - After each pass it computes its next time. New SQL functions do it (migration 0038):
     `jarvis_next_rule_run`, `jarvis_outbox_next`, plus `nextBriefAt` and the next reminder the
     pass saw.
   - A failed pass is tried again in five minutes.
2. **The container's check asks `/alive`**, which never reads the database. `/health` reads it at
   most every quarter of an hour (`JARVIS_HEALTH_CACHE_MS`). A watcher is said late after 75 minutes
   instead of 5.
3. **The live journal closes its connection** a minute after the last screen left.
4. **Connections are checked every six hours**, not every hour.
5. **The Netlify function has no schedule any more**, and no ping. The watcher runs on the server of
   its own.
6. **dev and test live in a project of their own**, `jarvis-os-dev`:
   - `JARVIS_NEON_PROJECT_NAME=jarvis-os-dev pnpm provision` creates it;
   - a laptop and the test suites never spend production's hours again;
   - their file storage stays where it was, since storage is not compute.

## Left to do (by hand)

- Production's quota: wait for its monthly reset, or change the Neon plan. Production stays down
  until then.
- The Netlify scheduled function keeps running on the deployed site until a deploy removes it, or
  until the site is stopped. Production is served by its own server: the Netlify watcher can be
  turned off now.
- These changes reach production at the switch (V9), or sooner as a fix on `main`.

## Checked

- `mails.test.ts` and the whole suites, on the new project `jarvis-os-dev`.
