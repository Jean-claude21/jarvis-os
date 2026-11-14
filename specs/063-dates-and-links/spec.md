# 063 — A day given as a number, an address you can open

## Why

LinkedIn gives the publication day as seconds since 1970: Jarvis refused the whole delivery for it,
so no offer arrived. And the addresses shown in tables could not be opened.

## What

- `receive` fits a date given as seconds or milliseconds since 1970 to its day; a day it cannot read
  is left out rather than refusing everything sent with it.
- In every table (app pages, kind views), a value that is a web address opens in a new tab; a click
  elsewhere on the row still opens the entry. An address with {blanks} stays text.
