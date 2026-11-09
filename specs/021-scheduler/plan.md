# Implementation Plan: One watcher at a time, and its trace

**Branch**: `021-scheduler` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

A lease in the database, taken before each pass and given back after it, so any number of watchers
(Netlify, laptops) may run: one pass at a time runs. The lease row keeps the last pass's trace.

## Technical Context

- Migration `0015_watcher_lease.sql`: table `watcher_lease` (`name`, `holder`, `until`,
  `started_at`, `ended_at`, `report`, `error`); no grant to `jarvis_app` on the table; functions
  `jarvis_lease_take(name, holder, seconds)` and `jarvis_lease_give(name, holder, report, error)`
  (security definer), and `jarvis_lease_last(name)`.
- A row lock in one statement (`insert … on conflict … where until < now()`): no session lock,
  so it works through Neon's pooler.
- `packages/core/src/lease.ts`; `watcherPass` takes and gives back the lease.

## Constitution Check

| Principle      | How this plan keeps it                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| I. Simple      | One row, two functions; no queue, no lock service.                             |
| III. One core  | The lease lives in the core; the watcher only calls it.                        |
| IV. Hers alone | The lease holds no one's life; `jarvis_app` reaches it through functions only. |
| VII. Proof     | Two holders on one database, a lease left behind, the trace read back.         |
