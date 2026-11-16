# 075 — An agenda that reads at a glance

## Why

Seen on 16 Nov with a real week (courses, an interview, sport, a deadline, rent, church):

- **Month is broken.** Its items take the old absolute style of the week: they leave their day, pile
  up, and one of them crosses the whole page; nothing else shows.
- **A repetition said « toutes les semaines » or « chaque semaine » is not understood**, and the
  event then vanishes from the agenda altogether.
- **« tous les mercredis » without an hour is placed at 9:00**, not at the event's own hour.
- **A repeated event with a start and an end loses its end** (only `duration` was read).
- **The week is heavy**: an hour grid from 4:00 to 24:00, mostly empty, scrolled; deadlines lose their
  hour.

The author asks to follow Gr8r Studio's calendar: a week of columns with cards, a month of short
chips, both plain.

## What changes

### Understanding repetitions (core)

1. « chaque semaine », « toutes les semaines », « hebdomadaire », « every week », « weekly »: the day
   and hour of the event's own start.
2. A repetition without an hour takes the hour of the event's start (else 9:00, as before).
3. A repeated event with `start` and `end` lasts as long as they say, when it has no `duration`.
4. A repetition that cannot be read still shows the event once, at its start, instead of nothing.

### The agenda page (her account)

- **Top**: « Aujourd'hui ‹ › » and the period on the left; her spaces as a legend; « Jour · Semaine ·
  Mois » on the right; « Rappels » stays as the last choice. One button: add.
- **Week**: one column per day, today marked; in each, cards sorted by hour — title, hour (or « ⚑ »
  and the hour for a deadline), the colour of its space, a mark for what repeats or is proposed. A
  « + » per day adds something that day. Empty days say so quietly. No hour grid.
- **Month**: per day at most three short chips with their hour, then « +N » that opens the day;
  repetitions kept count as dots, as before. The day number opens the day.
- **Day**: the hours of that day only (from its first to its last thing), with the line of now; the
  states of each occurrence as before.
- A click on a card opens the entry, as before. Small screens: the week scrolls sideways by day
  columns, the month keeps its grid.

## Proof

- Core: the three repetition phrases; the hour taken from the start; the end of a repeated span;
  an unreadable repetition shown once.
- The page, checked at 1440, 1024 and 390 px with a real week: every item in its day, nothing out of
  its cell.
