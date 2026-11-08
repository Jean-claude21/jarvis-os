# Implementation Plan: Entries she can find, file and count

**Branch**: `017-entries` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

## Summary

`lists.ts` reads, for any entries: their day (`dayOf`), their folder (`folderOf`), a list
filtered and sorted (`listEntries`), and its statistics (`listStats`, which collections now use
too). `folder` becomes a field every kind may carry. A kind is grouped by an « Area » entry, its
model's `area`, its app, or as Jarvis's own (`kinds` says `group`). `renameKind` and `fileEntries`
change many entries under one journal line (`kind.rename`, `entries.file`), undone at once.

```mermaid
flowchart LR
  E[(entries)] --> D[dayOf: date · at · start · due → source path → title → made]
  E --> F[folderOf: folder → source folder]
  D & F --> L[listEntries: kind · text · period · folder · sort]
  L --> P[Entries page: flat · by period · by folder]
  L --> S[listStats: days · streak · hours · splits · averages]
  S --> P & C[Collections] & M[MCP stats]
  A[Area entries] --> K[kinds: group]
  K --> P
  B[select] -->|fileEntries · save · archive| E
  R[renameKind] --> E
```

## Constitution Check

| Principle             | How this plan keeps it                                              |
| --------------------- | ------------------------------------------------------------------- |
| I. Simple and working | read from what her entries already hold; no table, no configuration |
| V. Trust              | renaming and filing many entries are journaled and undone at once   |
