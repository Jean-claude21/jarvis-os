# Feature Specification: The common types, and her duplicates

**Feature Branch**: `034-common-types` (spec 032, plan v2 T1 and T2)

**Created**: 2026-11-10

## User Story 1 — Never created twice (T1, Priority: P1)

1. Eight common types, shared by every app: Person, Account, Transaction (« Mouvement »), Event,
   Task, Place, Organization, Fichier — each with its names in her languages and its other names
   (« Contact », « dépense », « Tâche », « Moyen de paiement »…).
2. A new entry under another name of a common type is saved as it, with a note — unless her space
   already keeps entries under that name: then it stays, until she merges them (story 2).
3. The app shows a common type by its name in her language; the instructions tell assistants to use
   them.

## User Story 2 — Her duplicates, merged on her yes (T2, Priority: P1)

1. Jarvis proposes merging a kind into the common or app kind it names (« Mouvement », « dépense »,
   « SubscriptionPayment » → Transaction; « Compte » → Account; « Fonds » → Fund), and the variants
   of one name into the most used (« Doc », « Document » → « document »).
2. Each proposal says the fields renamed on the way (montant → amount, solde_initial →
   opening_balance), set (a « dépense » goes out) or converted (« sens » entrée/sortie → direction
   in/out).
3. On the Entries page: Preview (tried, nothing changed, an example before and after), Merge (after
   her yes), Not now (remembered). For assistants: `apps` (action `merge_kinds`).
4. A merge is the engine's migration then rename of the kind: journaled, each undone.

**Proof**: `packages/core/tests/common.test.ts` — the other names known (not « Recette »); a new
« Contact » filed as a Person; proposals with their steps; a dismissed one gone; a merge tried
without change, applied, then undone back to her words. Tried in the browser with duplicates like
those of her real life: preview, merge, labels in French, phone width.

## Found on the way

Saving one preference erased those the schema did not list (her channels per kind, spec 020): the
preferences now pass unknown keys through.
