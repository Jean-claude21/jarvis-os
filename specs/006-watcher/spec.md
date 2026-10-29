# Feature Specification: The watcher

**Feature Branch**: `008-method` (built with the method and documents)

**Created**: 2026-10-29

**Status**: Built (the author's Telegram reached; the test in Claude pending)

**Input**: User description: "Reminders that come on time, once or again and again — the cadence of
my Life OS (20:45 every day but Saturday, Monday 7:15, the last day of the month 19:30) — on my
Telegram bot."

## User Scenarios & Testing _(mandatory)_

She tells Claude « every evening at 20:45 but Saturday, call me to the deposit of the day ». Claude
saves one « Rappel » with `repete` « 45 20 \* \* 0-5 »; Jarvis computes its next time and, at 20:45
on her clock, her Telegram says it.

### User Story 1 — Once, on time (Priority: P1)

1. **Given** a « Rappel » with `quand` (a time on her clock), **When** that time comes, **Then** each
   person of its space is told through her channel, and it becomes « envoyé ».
2. **Given** a time still to come, **Then** nothing is said.

### User Story 2 — Again and again (Priority: P1)

1. **Given** `repete` in five fields (minute hour day month weekday, `L` the last day of the month)
   and `fuseau` (Paris by default), **Then** Jarvis writes `prochaine`, tells her then, and moves it
   on.
2. **Given** the watcher stopped for hours, **Then** a repeated reminder missed by more than two
   hours moves to its next time, without a late flood.
3. **Given** a repetition written wrong, **Then** it becomes « à corriger » with `erreur`, once.

### User Story 3 — The anticipation (Priority: P2)

1. **Given** reminders and dated things in the next three days, **When** a client connects, **Then**
   its instructions list them.

## Requirements _(mandatory)_

- **FR-001**: The watcher finds candidate reminders through one security-definer function that
  returns ids and members only; it reads and writes each as a member, under row-level security.
- **FR-002**: Her channel is an entry « Canal » of her own space (`telegram`: her chat).
- **FR-003**: Every write of the watcher is journaled (door `watcher`, origin « inferred »).

## Success Criteria _(mandatory)_

- **SC-001**: A reminder said in Claude arrives on the author's Telegram within a minute of its time.
- **SC-002**: The cadence of the author's Life OS is written as repeated reminders and kept.
