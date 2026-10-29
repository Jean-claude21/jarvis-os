# Tasks: Her data, hers — Markdown out and in

- [x] T001 `markdown.ts`: `readMarkdown` (front matter, kind, title, `texte`, `source`, `date`, links)
- [x] T002 `importMarkdown`: batched entries, links (relative, wiki, « fait partie de »), re-import
      without duplicates, journaled as `import.run`
- [x] T003 `journal.ts`: `recordMany`; `undo` of `import.run`
- [x] T004 `exportMarkdown`: one file per entry, files beside, links under « Liens »
- [x] T005 API: `GET /api/export` (zip), `POST /api/import`
- [x] T006 Command line: `markdown import|export <folder>` (git-tracked, code projects left out)
- [x] T007 Tests: reading, import, re-import, undo, export read back; API zip; folder listing
- [x] T008 The author's Life OS imported into `dev` (624 files, 2 579 links), imported again (nothing
      added), exported back
- [x] T009 Docs: core and API READMEs, ARCHITECTURE, roadmap
- [ ] T010 `pnpm check` green; CI green on the pull request to `dev`
