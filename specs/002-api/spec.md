# Feature Specification: Accounts and the REST API

**Feature Branch**: `002-api`

**Created**: 2026-10-29

**Status**: Built

**Input**: User description: "Accounts and the REST API: Better Auth accounts, the API over the core, files in Neon Object Storage"

## User Scenarios & Testing _(mandatory)_

The users are people who create an account, and the clients acting for them (the Jarvis app,
tests, later the MCP server). Every story is proven by API tests against the Neon `test` branch and
its object storage.

### User Story 1 — An account and a life (Priority: P1)

She signs up with her e-mail and a password; her space is made at once. She signs in and gets a
token any client can use.

**Independent Test**: sign up, read `/api/me`: her name and her one space.

**Acceptance Scenarios**:

1. **Given** no account, **When** she signs up, **Then** she is signed in and `/api/me` shows her
   space.
2. **Given** no token, **When** any `/api` route is called, **Then** it answers 401.

---

### User Story 2 — Her life over HTTP (Priority: P1)

Every gesture of the core is one route: save, find, kinds, get, archive, query, history, undo.

**Independent Test**: save an expense linked to an account, find it, sum it with a query, correct
it, undo the correction.

**Acceptance Scenarios**:

1. **Given** her token, **When** she saves two linked entries, **Then** `GET /api/entries/:id`
   returns them with their links.
2. **Given** a malformed body or an unknown entry, **Then** the answer is 400 or 404 with a message
   a model can act on.

---

### User Story 3 — Her files (Priority: P1)

She sends a file (a scan, a PDF, a text): it is stored in her space's storage, becomes an entry of
kind `Fichier` linked to what it is for, and can be read back, byte for byte, or through a link
that expires.

**Independent Test**: upload a PDF and a text file linked to a `Démarche`, download both, compare
bytes; find the text file by a word it contains.

**Acceptance Scenarios**:

1. **Given** a PDF, **When** it is uploaded with a link « pièce de » to a démarche, **Then** a
   `Fichier` entry exists, linked, and the download returns the same bytes and type.
2. **Given** a text file, **Then** its words are searchable.
3. **Given** a file, **When** a temporary link is asked, **Then** it opens the file without a
   token, until it expires.
4. **Given** a file larger than 20 MB, **Then** it is refused.

---

### User Story 4 — One account never reaches another (Priority: P1)

**Acceptance Scenarios**:

1. **Given** Ama and Kossi, **When** Kossi asks for Ama's entry or file, **Then** 404, and nothing
   of hers is listed, queried or changed.

### Edge Cases

- A wrong password: 401, the same message whether the e-mail exists or not.
- A query that fails: 400 with the database's message.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Accounts MUST be made with an e-mail and a password; a space MUST be made with each
  account.
- **FR-002**: Every `/api` route MUST act for the signed-in person, by session cookie or bearer
  token, in her space, under row-level security.
- **FR-003**: The routes MUST cover every function of the core, with the core's schemas as their
  contract.
- **FR-004**: Files MUST be stored in object storage behind a port (no vendor in the core), keyed
  by space and entry, with their name, type, size and, for text, their words.
- **FR-005**: A file MUST be readable back through the API and through a temporary link.
- **FR-006**: Errors MUST say what is wrong in words a model can act on.

### Key Entities

- **Account**: an e-mail, a name, a password; global, reached only by the application.
- **File**: an entry of kind `Fichier` with its blob in her space's storage.

## Success Criteria _(mandatory)_

- **SC-001**: Every acceptance scenario passes as an API test in CI.
- **SC-002**: A 1 MB file is stored and read back in under three seconds.

## Assumptions

- E-mail verification and password reset come later; sign-up signs in at once.
- One space per account; the space is chosen by the server, not the client.
- Files up to 20 MB.
