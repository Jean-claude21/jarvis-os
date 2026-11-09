# Feature Specification: Search that finds

**Feature Branch**: `029-search` (spec 027)

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S8 (search by words and by meaning, on entries and files), in the plan's
order.

## What is missing

Search asks every word, letter for letter (accents and case aside), and gives the latest first:
a typing slip or a plural finds nothing, and the entry named after the word comes after any that
only mentions it.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — By words, the best first, a slip forgiven (Priority: P1)

1. With words, an entry whose title holds them comes before one whose fields do, before one whose
   file does.
2. When no entry holds every word, words close to hers count (« ophtalmologe », « vidanges »).
3. The same rule for `find` (Claude, the API) and the app's Entries page.

**Proof**: the title before the field; a slip and a plural found; a word far from hers finds
nothing. Tried by hand on the Entries page with « ophtalmologe ».

### User Story 2 — By meaning (Priority: P2, waiting for a decision)

« mes papiers pour le visa » finds the passport scan and the bank statement. This needs a model
that turns texts into vectors: an outside service (paid per use, the texts leave) or a model run by
Jarvis itself (free, private, heavier). The author chooses.

## Requirements

- **FR-001** One rule for every search by words (`search.ts`).
- **FR-002** Close words by trigrams (`pg_trgm`, migration `0022`), threshold 0.6.
