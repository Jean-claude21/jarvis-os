# Spec 058 — « Activités »: everything, in one place

**Status**: implemented on `058-activities-all` · **Date**: 2026-11-13

As Dataverse shows its activities, Jarvis shows hers in one section, « Activités », whatever they
are: what she does (tasks, kinds made activities, executions — spec 057) and what happens to her
(reminders, meetings, any entry with a `start`).

- **Three tabs.** « À faire »: what needs her, grouped (spec 057). « Toutes »: one line per activity,
  by when it happens, filtered by period (today, this week — the default, this month, upcoming,
  past, any date) and by kind. « Faites »: what is done.
- **Each line** says its kind (an icon), its title, when, what it concerns (`about`, or the thing a
  reminder is `for`), and its state: to do, late, to approve, failed, done, past, cancelled.
- **What happens to her** is done once its time has passed, unless its status says otherwise.
- `GET /api/activities?scope=all&period=week` reads the stream; without `scope`, what she has to do.
- The address of before, `#/taches`, opens the same page.

**Proof**: `packages/core/tests/activities.test.ts` (the stream: a task, a meeting, a past event, a
reminder, in order; a period).
