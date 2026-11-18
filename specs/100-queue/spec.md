# 100 — F5: the queue, changed before the yes (v3 D6, D13; plan section 32)

## Step back

- « À valider » is **one queue** (D13): what waits for her yes, whatever made it. It stays one
  place. An app does not get a queue of its own: it **sees the same queue**, narrowed to its kinds.
- Every item says **the kinds it makes or touches** (`kinds`). That is the only thing an app needs
  to find its own. No app, kind or life domain is named in the code.
- « Modifier » is not a new screen. A proposal is an entry. Changing it is **one save on that
  entry**, journaled and undone like any other. A proposed entry is already a real entry, so its
  « Modifier » is the fiche (F2) in the side card.
- A value « lu, à vérifier » waits in the queue **only when Jarvis read it from one of her files**:
  - Jarvis's reading of her papers is a guess. An amount from an invoice must be checked before it
    is hers.
  - Values copied from a source she connected (her calendar, an agent's collection of offers) are
    that source's words. They stay marked « lu » on their fiche but do not wait here. Otherwise
    every synced event would flood the queue.
  - A file's own reading (its genre, its facts with their quotes) is its evidence, not a value to
    confirm.

## What changes

1. **Modifier avant d'accepter**:
   - A proposal (several entries at once, e.g. what an invoice makes) opens in place. Each entry
     shows its title and its values; she changes what is wrong, then « Garder ».
   - Only what she changed is sent. What she sets becomes « dit ». What she left keeps how it was
     known (« lu » stays « lu »). An emptied value is taken off.
   - Nothing is made until « Accepter ».
   - A proposed entry's « Modifier » opens its fiche in the side card.
   - Core: `amendProposal`. API: `PUT /to-sort/:id`. MCP: `amend_proposal` (family « actions »).
2. **« lu, à vérifier » in the queue**:
   - A new nature, `verify`. It says the kind, the file it was read from, and the values still as
     read.
   - Two gestures:
     - « C'est juste »: every read value becomes « dit », in one journaled save;
     - « Corriger »: the fiche in the side card, where each value is changed in place.
   - Core: `toVerifyOf` (newest first, 100 at most). `decide(…, yes)` on such an entry confirms its
     read values (the MCP `decide` says so).
3. **The queue in each app**:
   - The app menu shows « À valider » with its count, under « Aperçu », only when something waits
     among the app's kinds.
   - A capture counts for an app when Jarvis guessed it is for that app.
   - It is the same panel, with the same gestures, filtered (`forApp`). Accepting there removes the
     item everywhere.
   - While a proposal is changed, the list drops its height limit, so the form never scrolls inside
     a box.

## Checked

- Core tests (`tests/queue-f5.test.ts`):
  - a proposal is changed, refused for an entry it does not make, then accepted. What she set is
    « said », the rest still « read », an emptied value gone. It cannot be changed once decided;
  - a value read from her file waits with its file. A value read from a source does not. « Yes »
    makes it « said » and it leaves the queue.
- Existing tests: `proposals`, `read-documents`.
- Real run on a quiet server (Neon `test` branch), at 1440 and 390:
  - a text invoice was dropped. Jarvis proposed the supplier, the purchase and the warranty;
  - in « Modifier », the purchase was renamed « Lave-linge Bosch » and its amount set to 600. Its
    origin then read `amount: said`, `date: read`;
  - after « Accepter », the purchase and the warranty waited « lu, à vérifier » with their file.
    The confirmed amount did not;
  - in the app Garanties, « À valider 1 » showed only the warranty. « Corriger » opened its fiche;
    « C'est juste » made its three values « said » and emptied the app's queue;
  - on a phone, the form fits the width, and nothing passes the right edge.

## Left for later

- Field names in « Modifier » come from the common words (`fieldWord`). A field of her own model
  shows its name until the editor reads her model's labels.
- Changing which entries a proposal links, or removing one entry of it, is still done by the
  assistant.
