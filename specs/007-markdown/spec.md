# Feature Specification: Her data, hers — Markdown out and in

**Feature Branch**: `007-markdown`

**Created**: 2026-10-29

**Status**: Built and proven (the author's Life OS imported into `dev`, exported back)

**Input**: User description: "Import my Life OS (lifeos_docs) into my Jarvis space; the Markdown is
the truth. She can take her life out of Jarvis as readable files, and bring a Markdown life in."

## User Scenarios & Testing _(mandatory)_

The author keeps his life as Markdown under git: a journal per day, prayers, reviews, resolutions,
people, projects. He brings it into Jarvis once, then again whenever the folder moves on: nothing is
added twice, what changed is read again, and what he added in Jarvis stays. Claude then finds a
resolution, a person or a day's journal, and follows the links between them. Any day, he takes his
space out as a zip of Markdown that any editor opens, and that Jarvis reads back the same.

### User Story 1 — Import a Markdown folder (Priority: P1)

**Independent Test**: a folder of Markdown files becomes one entry per file, its links between
them; importing it again changes only what changed; the import is undone at once.

**Acceptance Scenarios**:

1. **Given** a file with a front matter, **When** it is imported, **Then** the front matter becomes
   fields (origin « read »), the first heading the title, the text below it the field `texte`, its
   path the field `source`, and a date in its name the field `date`.
2. **Given** no `kind` in the front matter, **Then** the kind comes from the nearest folder that the
   import names (`kinds`), else from its parent folder; a kind she already wrote is kept as written.
3. **Given** links to other files of the folder (relative Markdown links, `[[wiki]]` names),
   **Then** they become links « mentionne »; a file belongs to the file that describes its folder
   (`_carte.md`, `README.md`) by a link « fait partie de ».
4. **Given** the same folder imported again, **Then** no entry or link is added twice; a changed
   file updates its entry; fields added in Jarvis stay.
5. **Given** the import's journal line, **When** it is undone, **Then** its entries are set aside,
   its links removed, its updates taken back.
6. **Given** a folder with code projects (`package.json`, `pyproject.toml`), hidden folders or
   `node_modules`, **Then** their Markdown is left out; under git, only tracked files are read.

---

### User Story 2 — Export a space (Priority: P1)

**Independent Test**: `GET /api/export` returns a zip of one Markdown file per entry and the bytes
of her files; imported into another space, it gives the same entries and links.

**Acceptance Scenarios**:

1. **Given** a space, **When** she exports it, **Then** each entry is a file in its kind's folder (an
   imported one goes back to its path), its kind, id and fields in the front matter, its text below
   its title, its links under « Liens » with their roles.
2. **Given** a file she gave, **Then** its bytes are beside its entry, linked from it.
3. **Given** the export imported into an empty space, **Then** the export of that space is the same,
   ids aside.

### Edge Cases

- A front matter that is not YAML stays in the text.
- A link to a file outside the folder is counted as unresolved, never invented.
- A path with `..` or starting with `/` is refused by the API.
- The bytes of files are exported; an import reads Markdown only.

## Requirements _(mandatory)_

- **FR-001**: The core reads and writes the format (`readMarkdown`, `importMarkdown`,
  `exportMarkdown`); no door holds the format.
- **FR-002**: Every change of an import is journaled; one line `import.run` names them, so undo takes
  the import back at once.
- **FR-003**: The import runs under row-level security as the person, through any door: the REST API
  (`POST /api/import`) or the author's command line (`pnpm --filter @jarvis-os/api markdown`).
- **FR-004**: The export is a zip any system opens, made without a library.

## Success Criteria _(mandatory)_

- **SC-001**: The author's Life OS (624 files) imported in under a minute, with its links.
- **SC-002**: Imported again, it adds nothing.
- **SC-003**: Exported back, a file reads as he wrote it, its links listed under « Liens ».
