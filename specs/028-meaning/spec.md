# Feature Specification: Search by meaning

**Feature Branch**: `030-meaning` (spec 028)

**Created**: 2026-11-10

**Status**: Draft

**Input**: Plan v2, item S8 (search by meaning); the author chose an outside paid service (Voyage AI, OpenAI as the other).

## User Story 1 — A question finds what its words miss (Priority: P1)

1. Each entry's words are turned into a vector by the model, by the watcher; again when they change.
2. `find` gives the entries found by words, then those near in meaning; the Entries page shows them under « Near in meaning ».
3. Without a key, search stays by words; vectors are read by the space's members only.

**Proof**: with a themed model made for the proof, entries are turned once and again on change; « mes papiers pour le visa » finds the passport scan and the embassy appointment, not the garage; another person finds none of them. Tried with the real model once its key is set.
