# 0004 — Figures come from a read-only query

- Status: accepted
- Date: 2026-10-29

## Context

A model adding numbers in its head makes mistakes; a person who reads a wrong amount stops
trusting. Models write good SQL. Letting a model run SQL in a multi-tenant database must not let
one person read another's life, nor anything of the accounts.

## Decision

`query` runs a single `select` written by the model:

- inside a read-only transaction, with a statement timeout and a row limit;
- as the role `jarvis_reader`, which can read only the views `my_entries`, `my_links`,
  `my_files`, filtered by row-level security to the acting person's spaces;
- never on identity tables, the journal or anything else (the role has no grant there).

## Consequences

- « Combien en transport ce mois ? » is one query over `my_entries`, exact and auditable.
- A malformed or forbidden query fails with Postgres's message, which the model can correct.
