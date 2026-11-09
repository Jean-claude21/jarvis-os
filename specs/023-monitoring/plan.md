# Implementation Plan: Knowing when something went wrong

**Branch**: `023-monitoring` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

A reminder whose message fails for good is saved « failed » with its reason, which « Maintenant »
already shows to fix; entering a failed message again revives it. `/health` reads the watcher's
lease (spec 021), which now keeps the whole pass's report.

## Technical Context

- `enterMessage`: on a duplicate key, a message failed for good is queued again (attempts at 0).
- `markFailed` says when the failure is final; `deliverOutbox` then saves the reminder
  `status: failed`, `error: « Not sent by <channel>: <reason> »`, as her, door « watcher ».
- `apps/api/src/health.ts`: `healthOf(db)`; `/health` answers 200 or 503.
- No migration.

## Constitution Check

| Principle      | How this plan keeps it                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| I. Simple      | What she already sees to fix; a health page read by any monitor.             |
| IV. Hers alone | The reminder is changed as her; `/health` holds counts only.                 |
| V. Trust       | The change is journaled (door « watcher »); « Retry » is hers.               |
| VII. Proof     | A reminder failing four times, retried and sent; the watcher late, then not. |
