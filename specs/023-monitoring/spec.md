# Feature Specification: Knowing when something went wrong

**Feature Branch**: `023-monitoring`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S10 (monitoring: knowing a reminder did not leave, a connection expired, an
error happened), in the plan's order.

## What is missing

Since the outbox (spec 020), a reminder whose message fails for good stays « sent »: she never
knows it did not reach her. Whoever runs Jarvis cannot tell, from outside, that the watcher stopped
or keeps failing.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — She knows a reminder did not reach her (Priority: P1)

1. A reminder whose message failed for good becomes « to fix », with the reason (channel, error):
   « Maintenant » shows it.
2. « Retry » asks for it again: the failed message is tried again, not refused as already sent.

**Proof**: a reminder whose e-mail fails four times is « failed » with its reason and shows in
« Maintenant » to fix; after « Retry » it is sent.

### User Story 2 — Whoever runs it knows the server is unwell (Priority: P1)

1. `/health` says whether the database answers, when the watcher last passed, whether it is late
   (more than five minutes), whether its last pass failed or counted failures; 503 when unwell.
2. Nothing personal in it, nor who runs the watcher: a monitor outside reads it and alerts.

**Proof**: after a clean pass, the watcher is not late; ten minutes later, it is, and the server is
unhealthy; `/health` answers its three parts only.

## Requirements

- **FR-001** A message tried again after « Retry » is the same message, its attempts started again.
- **FR-002** The watcher's lease keeps what its last pass did: reminders, outbox, backups, rules.
- **FR-003** A connection that expires (connectors, S6) will report here when connectors exist.
