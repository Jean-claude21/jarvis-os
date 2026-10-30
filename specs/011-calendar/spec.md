# Feature Specification: The calendar — one model of time

**Feature Branch**: `011-calendar`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "A calendar, taken from above: Jarvis knows what to put in my agenda;
I see my week in the app, in Claude, and in the calendar of my phone."

## The idea

A calendar is not a new kind of thing. Time is a **property** that any entry may carry: an event
has a start, a reminder a moment, a file a deadline, a habit a repetition, a birthday a day that
comes back. The calendar is the **view of everything dated**, whatever its kind — computed, never
stored twice.

| Her words                           | The fields of the entry (any kind)                    | In the calendar        |
| ----------------------------------- | ----------------------------------------------------- | ---------------------- |
| « dentist Thursday 14:00 to 15:00 » | `debut` (and `fin`, or `duree` in minutes)            | a span                 |
| « remind me Monday at 9 »           | `quand`                                               | a moment               |
| « the file is due the 14th »        | `echeance`                                            | a deadline             |
| « Mum's birthday, 1 November »      | `date` (from today on)                                | a day                  |
| « gym Tuesday and Wednesday 18:30 » | `repete` (five fields) and `duree`; `sauf` (days off) | a span, again          |
| « every evening at 20:45 »          | `repete` alone                                        | a moment, again        |
| a proposal Jarvis makes             | any of these and `statut` « proposé »                 | shown apart, to accept |

`fuseau` gives the zone (Paris by default); `statut` « annulé » takes it out; « fait » or
« envoyé » keeps it in the past and out of what comes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Her week, whatever its kinds (Priority: P1)

1. **Given** an « Événement » with `debut` and `fin`, a « Rappel » with `quand`, an « Obligation »
   with `echeance`, a « Habitude » with `repete` « 30 18 \* \* 2,3 » and `duree` 90, **When** she
   asks for the week, **Then** she gets each one at its place, the habit twice (Tuesday and
   Wednesday), sorted by time, with its kind, its space, its end, whether it repeats.
2. **Given** `sauf` « 2026-10-28 » on the habit, **Then** Wednesday's is not there.
3. **Given** `statut` « annulé », **Then** it is not there; « proposé », **Then** it is there, marked
   proposed.

### User Story 2 — In Claude (Priority: P1)

1. **When** she asks « what do I have Thursday? », **Then** Claude calls `agenda` for that day and
   answers from it — never from memory.
2. **When** she says « dentist Thursday at 14:00 », **Then** Claude saves an entry with `debut`
   (the routine « Le temps » teaches the fields), and it is in her week.
3. What comes in the next three days stays in Claude's instructions, read from the same calendar.

### User Story 3 — In the app (Priority: P1)

1. « Agenda » shows her week (and a day, on a phone): spans, moments, deadlines, proposals apart;
   now marked; earlier and later weeks a click away.

### User Story 4 — In her phone's calendar (Priority: P2)

1. **Given** « Ajouter à mon agenda » in the app, **Then** she gets a private address (iCalendar)
   that Google Calendar or her iPhone subscribes to: her Jarvis calendar appears there, read-only,
   kept up to date by the calendar app.
2. **When** she renews the address, **Then** the old one answers nothing any more.

### Edge Cases

- A repetition every five minutes is not a calendar: at most 200 occurrences of one entry in a view.
- A window is at most 366 days.
- A time she wrote without a zone is on her clock (`fuseau`, else Paris), across changes of hour.
- A date alone is a whole day, not 09:00.

## Requirements _(mandatory)_

- **FR-001**: The core computes the calendar of a window from the entries of the spaces it is
  given; nothing new is stored; no kind is special.
- **FR-002**: `upcoming` (spec 006) is the calendar of the next days, without what is done.
- **FR-003**: One MCP tool `agenda`, one REST route `GET /api/agenda`, the app's « Agenda », and the
  subscription `GET /agenda/:key.ics` read the same function.
- **FR-004**: The subscription key is hers: random, kept in her « Canal » entry, renewable; without
  it nothing is served. The feed holds only what her own spaces hold.
- **FR-005**: Every word from the catalogs; the feed's text is her own entries'.

## Success Criteria _(mandatory)_

- **SC-001**: Her week is right in the app, in Claude and in her phone's calendar, from the same
  entries.
