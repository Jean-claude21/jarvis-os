# 085 — The « next » preview: the v3 built beside the production

## Why

Jarvis OS v3 (new client, generic core) is built over several weeks. The people who use the
production must not see it change under them, and the v3 must be tried on real data.

## What changes

1. **A branch `next`** in git, where the v3 is built; fixes made on `main` are carried into it.
2. **A Neon branch `next`**, cloned from `main`: a copy of the real data, reset from `main` at will.
3. **A second Coolify application** on `next.jarvis.kete.digital` (branch `next`, base `next`, its
   own session secret). `JARVIS_BRANCH=next` reads `JARVIS_NEXT_*`.
4. **`JARVIS_SIDE_EFFECTS=off`** (a quiet copy): the watcher does not run (no reminders, briefs,
   collecting, backups, Telegram polling), `sendTelegram` sends nothing, and `/health` counts only
   the database. The copy's messages would otherwise reach real people twice. No Telegram token
   is given to next.
5. **`main` is tagged `v2-final`**: the production is frozen except for fixes.
