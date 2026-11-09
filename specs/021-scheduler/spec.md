# Feature Specification: One watcher at a time, and its trace

**Feature Branch**: `021-scheduler`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S5 (an independent scheduler: outside the web server, one active at a time
even on several machines), in the plan's order.

## What is missing

The watcher runs each minute on Netlify, and on a laptop through `pnpm serve` or `pnpm watcher`.
Nothing stops two of them on the same database at once (two machines, or a pass still running when
the next one starts): she could be told twice, a rule could run twice. Nothing says when the last
pass ran, or how it ended.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — One watcher at a time (Priority: P1)

1. Before a pass, the watcher takes the database's lease. Another watcher holding it, the pass is
   skipped and says so.
2. A pass that ends gives the lease back. A watcher that stops in the middle (a machine shut down)
   loses it by itself after five minutes.
3. Each pass leaves its trace: when it started, when it ended, by whom, what it did or why it failed.

**Proof**: two watchers on one database: one takes the lease, the other skips; after the first
ends, the other takes it; a lease left behind expires; the last pass is read with its report.

## Requirements

- **FR-001** One lease per database, named `watcher`, held by one holder (machine and process).
- **FR-002** The lease lasts five minutes at most; a pass gives it back when it ends.
- **FR-003** The trace of the last pass (start, end, holder, report or error) is kept beside it.
- **FR-004** The lease and its trace hold no one's life: only the watcher's own functions touch them.

## Success Criteria

- **SC-001** Two watchers started together on one database: exactly one pass runs.
- **SC-002** A watcher killed in a pass: another runs within five minutes.
