# Feature Specification: The core

**Feature Branch**: `001-core`

**Created**: 2026-10-29

**Status**: Built

**Input**: User description: "The core: spaces, entries of any kind, links, the journal and undo, read-only query, row-level security"

## User Scenarios & Testing _(mandatory)_

The users of this feature are the doors built next (the REST API, the MCP server): through them, a
person's words become entries of her life. Each story is proven by tests on the Neon `test` branch.

### User Story 1 — Save what she says, with its links (Priority: P1)

She says « taxi 2000, payé en espèces » or hands a passport: the model saves one or several entries
of any kind it chooses (`Dépense`, `Passeport`), with their fields, where each value comes from,
and the links between them, in a single call.

**Why this priority**: without it, nothing is remembered.

**Independent Test**: save two new entries and a link between them in one call; read them back
with their fields, origins and links both ways.

**Acceptance Scenarios**:

1. **Given** her empty space, **When** an expense and the account it was paid from are saved with a
   link « payé avec », **Then** both entries exist with their fields and the link reads from both
   ends.
2. **Given** an existing entry, **When** it is saved again with some fields, **Then** those fields
   change, the others stay, and a field given `null` is removed.
3. **Given** a value read on a file, **When** it is saved with origin `read`, **Then** it is
   returned marked « read » (to check) until saved again as `said`.

---

### User Story 2 — Find, and know the kinds that exist (Priority: P1)

Before creating a kind, the model asks which kinds and fields she already has; to answer, it finds
entries by words, kind and dates.

**Why this priority**: reusing kinds keeps a life tidy; finding is half of remembering.

**Independent Test**: with entries of several kinds, list the kinds with their counts and fields,
then find entries by a word of the title, by kind and by a period.

**Acceptance Scenarios**:

1. **Given** three expenses and a passport, **When** the kinds are listed, **Then** `Dépense` (3)
   and `Passeport` (1) are returned with the fields each uses.
2. **Given** « Passeport togolais », **When** she looks for « passeport », **Then** it is found,
   accents and case aside; archived entries are left out unless asked.

---

### User Story 3 — Every change undoable (Priority: P1)

Every change is journaled with its before and after. Any of them can be undone, and the undo is
journaled too.

**Why this priority**: the model will make mistakes; trust needs a way back (constitution V).

**Independent Test**: change an amount, undo it, see the old amount back and two journal lines.

**Acceptance Scenarios**:

1. **Given** an expense of 2 500 corrected from 2 000, **When** the correction is undone, **Then**
   the amount is 2 000 again, with its previous origin.
2. **Given** an entry set aside (archived), **When** it is undone, **Then** it is back.
3. **Given** a link added, **When** it is undone, **Then** the link is gone.

---

### User Story 4 — Figures from the database (Priority: P2)

« Combien en transport ce mois ? » is answered by a read-only query over her own entries.

**Why this priority**: the model never computes in its head (decision 0004).

**Independent Test**: sum the amounts of her expenses of a month with one `select`.

**Acceptance Scenarios**:

1. **Given** three expenses, **When** a `select sum(...)` over her entries runs, **Then** the exact
   total is returned.
2. **Given** a query that writes, reads the accounts, runs two statements or takes too long,
   **Then** it is refused with the database's message and nothing changes.

---

### User Story 5 — One life is never another's (Priority: P1)

**Independent Test**: two people with their spaces; neither reads, finds, queries, changes nor
undoes anything of the other's.

**Acceptance Scenarios**:

1. **Given** Ama and Kossi, **When** Kossi finds, queries or saves into Ama's space, **Then** he
   sees nothing and changes nothing.

### Edge Cases

- A link to an entry of another space, or to an unknown id, is refused.
- Saving an entry with an unknown id is refused; an empty kind or title is refused.
- Undoing a change already undone is refused.
- A query returns at most 500 rows.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The core MUST keep entries of any kind: a free kind, a title, free fields, the origin
  of each field (`said`, `read`, `inferred`), created and updated instants, and an archive mark
  instead of deletion.
- **FR-002**: One save MUST create or update several entries and add or remove links among them
  and existing entries; new entries are referred to by a local reference within the call.
- **FR-003**: Links MUST carry a role in her words and read both ways.
- **FR-004**: The kinds of a space MUST be listable with their counts and the fields they use.
- **FR-005**: Find MUST search titles and field values by words (accents and case aside), by kind,
  by period, and leave archived entries out unless asked.
- **FR-006**: Every change MUST be journaled with its before, its after, who made it and through
  which door; any journal line MUST be undoable once.
- **FR-007**: A read-only query MUST run one `select` over her own entries, links and files, with a
  time limit and a row limit, never on identity tables or the journal.
- **FR-008**: Every table holding her data MUST carry its space and its row-level security policy;
  the application role MUST NOT bypass it.

### Key Entities

- **Space**: a person's life; its members are the accounts that may act in it.
- **Entry**: anything of a life, of a free kind, with free fields and their origins.
- **Link**: from one entry to another, with a role.
- **Journal line**: one change, before and after, who and through which door, undone or not.
- **File**: the stored blob of an entry of kind `Fichier` (its storage comes in spec 002).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every acceptance scenario above passes as an automated test on the Neon `test`
  branch, in CI.
- **SC-002**: A save of five entries and four links takes one call and under one second.
- **SC-003**: No test can read, change or undo across two spaces.

## Assumptions

- Accounts arrive in spec 002: until then a person is an identifier given by the caller.
- One space per person for now; members allow sharing later without a change of schema.
- Files are stored in spec 002; this spec only reserves their table.
