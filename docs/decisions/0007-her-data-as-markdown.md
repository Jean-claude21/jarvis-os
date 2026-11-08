# 0007 — Her data leaves and enters as Markdown

- Status: accepted
- Date: 2026-10-29

## Context

The author's Life OS holds his life as Markdown files under git: « the Markdown is the truth »,
readable without any tool. Jarvis OS keeps a life in a database. The constitution says she can
export and erase everything.

## Decision

- Export gives one folder per space: an entry is a Markdown file (front matter for its kind, data
  and origins; links as wiki links), files beside it. The same shape is read back by the import.
- The import reads a Markdown life (front matter becomes `data`, folders and front matter give the
  kind, wiki links become links), with origin « read » and the source path kept, journaled as one
  import that can be undone. Code folders are skipped.
- The author's Life OS is the first import and its proof.

## Consequences

- A life in Jarvis stays readable, versionable and movable without Jarvis.
- A method (kinds, charter, routines) can later be shared as such a folder.
