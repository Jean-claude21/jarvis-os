# 0003 — Entries of any kind, links and a journal

- Status: accepted
- Date: 2026-10-29

## Context

A life holds an endless variety of things. The first Jarvis declared categories and fields;
a capable model can name and structure them as the person speaks.

## Decision

- One `entry` table: a free `kind`, a `title`, free `data` (JSONB), the `origin` of each value
  (`said`, `read`, `inferred`), `archived_at` instead of deletion.
- One `link` table: from, to, and a role in the person's words.
- One `journal` table: every change with its `before` and `after`, undoable.
- Files are entries of kind `Fichier` with their blob in object storage (`file` table).

## Consequences

- No migration for a new kind of thing. The model reuses kinds by listing them first (`find`).
- Values read on a file stay « à vérifier » until she confirms them.
