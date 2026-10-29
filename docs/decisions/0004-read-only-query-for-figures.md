# 0004 — Figures come from a read-only query

- Status: accepted
- Date: 2026-10-29

## Context

A model adding numbers in its head makes mistakes; a person who reads a wrong amount stops
trusting. Models write good SQL. Letting a model run SQL in a multi-tenant database must not let
one person read another's life, nor anything of the accounts.

## Decision

`query` runs a single `select` written by the model:

- her rows are first copied into temporary tables of the transaction, `my_entries`, `my_links`,
  `my_files`, under her row-level security;
- the `select` then runs as the role `jarvis_reader`, granted those copies and nothing else: not
  the real tables, not the accounts, not the journal;
- with a statement timeout (3 s) and a row limit (500), wrapped as one subquery sent with the
  extended protocol, so one statement only.

Row-level security alone was not enough for model-written SQL: the acting person is a session
setting, and a `select` can call `set_config` to change it. The copies make that trick useless,
and a test proves it.

## Consequences

- « Combien en transport ce mois ? » is one query over `my_entries`, exact and auditable.
- Copying costs a few milliseconds per thousand entries; past hundreds of thousands, a
  materialized copy per space can replace it without changing what the model writes.
- A malformed or forbidden query fails with Postgres's message, which the model can correct.
