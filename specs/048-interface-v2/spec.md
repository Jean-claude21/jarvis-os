# Feature Specification: The interface of plan v2, in J-C's mockup

**Feature Branch**: `040-interface-v2` (spec 048, plan v2 section I)

**Created**: 2026-11-10

The mockup (`docs/design/jarvis-v2.html`) is the design. Its whole stylesheet is carried as it is (`tooling/mockup-css.py` generates `client/styles-v2.ts`), every rule under `.v2`, so each screen of section I is drawn in its markup while the pages drawn before keep theirs; its icons too (`client/sprite.ts`). Every screen is checked at 1366, 768 and 390 px, without horizontal scroll.

## I13 — The sidebar (P1)

Au quotidien: Maintenant · Agenda · À ranger (its count) · Revue. Ma vie: Personnes · Entrées · Documents · Tableaux de bord. Apps: hers, then « Toutes les apps ». Espaces: each one. The profile menu: journal, reminders, kind models, connections, data, account, theme.

## I12 / C7 — « À ranger » (P1)

Everything that waits for her yes, one by one: a capture with what Jarvis understood (« déduit ») and the choices (a movement of money when sure, a note, ask Claude); a proposal across her apps (what each app receives, one gesture); a proposed entry; two kinds that are one thing. « Ranger tout ce qui est sûr »: a movement is linked to the account her model asks for — the one she named, or her only one; otherwise the capture waits and says what for.

## I1 — The review (P1)

The last seven days or this month: the mirror in one sentence (computed), what she kept and finished, her money, her open intentions, what comes back, her goals; her questions; her decisions, each becoming a task.

## I4 — Her people (P1)

The list, then a person's card: last time, promises, next time, what she promised, across her apps.

## I2 — Her full agenda (P1)

Day (each occurrence of what repeats: done, missed, postponed — that day only, undone with a second tap), Week (events, blocks that come back, deadlines, proposals, by space, a click on a free hour adds something), Month (deadlines and events; green dots: what repeats, kept that day), Reminders (what will ring, where it comes from, where it stands). Spaces shown or hidden. Her iCal address. Google and Outlook stay a connector (later).

## I3 / C1 — An entry's card (P1)

« What has Jarvis kept, exactly? »: its fields in the model's order with their labels (the model's, else the usual ones), dates in her words, each value corrected in place (as Jarvis keeps it, never as words; written « said », undone from the message), its links as sentences in her words, the apps it touches, its notes (C8), its history (each step undone from here), « see the structure ».

## I11 — The phone (P1, first part)

A tab bar under the thumb: Maintenant · Agenda · Noter (a few words kept at once) · À ranger · Menu.

**Proof**: each screen seen on dev through ngrok at the three widths; `apps/api/tests/platform.test.ts`; `packages/core/tests/inbox.test.ts` (the account linked or waited for).
