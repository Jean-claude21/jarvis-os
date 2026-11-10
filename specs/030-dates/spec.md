# Feature Specification: Dates in her words

**Feature Branch**: `032-mcp-tools` (spec 030, first part of plan v2 item S13)

**Created**: 2026-11-10

## User Story 1 — « demain 9h » understood by Jarvis (Priority: P1)

1. A moment written in her words (`at`, `due`, `start`, `end`, `date`, `next`) in `save` is read by Jarvis on her clock (chrono-node, French then English), kept as a wall-clock time of her zone, or a day when no hour was said; `save` answers what it understood, for the assistant to tell her.
2. `agenda` takes `from`/`to` in her words too (« aujourd’hui », « dans 3 jours »).
3. A written date is kept as it is; words without a date are left alone; the typographic apostrophe of phones is read as the plain one.

**Proof**: `apps/api/tests/when.test.ts` — Lomé and Paris clocks at the same instant, a day without hour, written dates kept, Claude saving « demain 9h », an agenda asked in words.

## Also in this change

- The watcher no longer stops on a broken photo (found on the real files of dev): the OCR worker's error is caught, and a file is marked before it is read, so a crash cannot loop.
- `pnpm serve` reads `OPENAI_API_KEY` / `VOYAGE_API_KEY` from the secrets file beside the repository.
