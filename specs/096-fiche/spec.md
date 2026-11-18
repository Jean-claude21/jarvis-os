# 096 — F2: the full fiche (v3 D6, D7, D10; plan section 32)

## Step back

The interface is for checking (D1): every value is corrected where it is read, in one gesture, and
each correction is one line of the journal, undone from the Activity. Nothing new in the core: `save`
already sets fields, links and unlinks, and comments already exist. Only the fiche changes, and it
is the same fiche everywhere: its own page, the right side of « Liste + détail », and the side card.

## What changes

1. **Values in place**:
   - Each field has the input its type calls for:
     - text, long text;
     - number, amount;
     - date, date and time;
     - a choice in her words, a multiple choice;
     - yes / no;
     - a link, chosen among her entries of the target kind.
   - Entrée keeps the value, Échap leaves it, « Vider » empties it.
   - Formulas, lines and files stay read-only.
   - The **title** is renamed in place.
2. **« lu, à vérifier » → « C'est juste »**: a value Jarvis read is confirmed in one click (its
   origin becomes « dit »).
3. **Empty fields**: the values she has come first; the empty fields of her model wait behind one
   line, « Compléter : N champ(s) vide(s) ».
4. **Links**:
   - « Relier » finds an entry and says what the link means (« concerne » by default).
   - Each link is taken off with its ✕.
   - Notes and files are shown apart.
5. **Notes**: written and kept with the fiche (comments, linked « on »).
6. **Side card**:
   - From every view (list, cards, table, kanban, calendar, timeline, files), an entry opens in a
     side card over the page (`?fiche=…`). Back or ✕ closes it; « Pleine page » opens its own page.
   - On a phone the card takes the whole screen.

## Proof

In the real app, on an offer:

- the read company was confirmed (origin `said`);
- the place was changed to « Lyon » with Entrée;
- a link « concerne → Awa Koné » was added;
- a note was written;
- the journal shows each change.

The side card opens from the offers list, at 1440 and 390 px, with no page error and nothing past
the right edge.
