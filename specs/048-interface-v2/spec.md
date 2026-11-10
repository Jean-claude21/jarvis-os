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

## I13 / I6 / I7 / I14 — Her apps (P1)

« Toutes les apps »: installed (pinned to her sidebar, in her order, every device alike), the catalog (each previewed before it is installed: what will be made, what of hers is reused, one journal line), how they talk (who reads and writes which common type, the active bridges). An app's role (I6): what it covers, when it is concerned, what it reads and writes, what it asks, what her assistants know of it; removed from there (her entries stay).

## I9 — A space and the life in common (P1)

A space's page: its charter (kept as it is), its routines in five parts (each one kept as text offered for structuring, in « À ranger »), and in a shared space: who does what (to her, to others, to nobody, « Je prends »), what happened, the money in common this month against equal shares.

## I5 — Her documents in one place (P1)

Written (long texts), kept by Jarvis (her files, linked or to link), Google Drive and OneDrive (shown, never copied — to connect), received by messages.

## I8 — A search that answers (P1, spec 049)

A question in the search box (« combien en transport en octobre ? », « combien de prières cette semaine ? ») gets a figure computed from her entries, never from memory: a sum of money or a count of what she kept (a word naming one of her kinds counts that kind), against the period before, week by week, with the entries that justify it.

## « Mes données » (P1)

Her entries, files, kinds (common, hers, possible duplicates), last backup, what Jarvis sent her these seven days, what to watch; her import and export, as before.

## I10 — The first launch (P1)

When nothing is kept yet: her spaces, what she already has, her connections, her rhythm (morning brief, time zone).

## I11 — The phone (P1, first part)

A tab bar under the thumb: Maintenant · Agenda · Noter (a few words kept at once) · À ranger · Menu.

**Proof**: each screen seen on dev through ngrok at the three widths; `apps/api/tests/platform.test.ts`; `packages/core/tests/inbox.test.ts` (the account linked or waited for).
