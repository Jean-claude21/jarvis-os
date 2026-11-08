# Feature Specification: Every day, without lifting a finger

**Feature Branch**: `018-every-day`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Why should these corrections wait? Only the deployment stays for
later. Everything else must be done now — and the interface cut up properly, clearly."

## What was left

Spec 017 was built, but four things kept it from being used every day:

1. A habit's rate needed every prayer linked to the habit by hand.
2. Nothing told her her day in the morning unless she asked Claude.
3. Her real data had days the lists did not read (`ouvert`, `applied_on`), routines taken for
   habits through mere mentions, and a prayer noted at 05:10 shown as « late ».
4. Her web account was one file of 1,541 lines.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — A habit counts by itself (Priority: P1)

1. A habit counts every entry of the kind it tracks: `tracks`, else the kind its title names
   (« Prière » tracks the kind « Prière »). No link is needed.
2. Only a link `for` is a deed; a mention or a `part_of` is not.
3. A habit said twice (in « Habitude » and among her prayers) shows once; an entry that says its
   days is a habit, never counted as done.

### User Story 2 — The morning brief (Priority: P1)

1. She chooses an hour (Account › The morning brief); at that hour on her clock, once a day, the
   watcher sends her day on Telegram: what to fix, what is late, today's calendar, her habits of
   today (done or to do, with their rate).
2. A brief missed by more than three hours waits for the next morning: never at night.
3. She can read today's brief, or have it sent now, from the same card.

### User Story 3 — Her real data read right (Priority: P1)

1. An entry's day is also any other field holding a day — but an end, a next or a last one
   (`expiration`, `derniere-interaction`, `next`…).
2. A moment she noted (a prayer at 05:10) is not late; a moment with a status (planned, to do) is.

### User Story 4 — An interface cut by what it draws (Priority: P2)

1. The script of her web account lives in `platform/client/`, one module per part: the ground,
   the views, the Entries page, the pages of her day, her life and her settings, what they do,
   the router; styles and icons apart. The page served is the same.

## Requirements _(mandatory)_

- **FR-001**: `listStats` gives each habit's rate from its `for` links and the entries of the kind
  it tracks.
- **FR-002**: `preferences.brief` (« HH:MM » or null) is kept in her « Channel »;
  `jarvis_brief_people()` gives the watcher the people to tell, and nothing else.
- **FR-003**: `briefOnce` sends at most one brief a day per person and marks `brief_sent`.
- **FR-004**: `GET /api/me/brief` reads today's brief; `POST /api/me/brief` sends it now.
- **FR-005**: No new table; no vendor name in `packages/core`; every visible word in `words.ts`
  or `i18n.ts`.

## Success Criteria _(mandatory)_

- **SC-001**: On her data, the « Prière » page shows one habit « Prière », counted from her
  prayers, and no routine.
- **SC-002**: The brief arrives at her hour on Telegram, once.
- **SC-003**: The page served by `/app` keeps every line of its script and its styles.
