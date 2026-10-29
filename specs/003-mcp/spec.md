# Feature Specification: The MCP server and OAuth

**Feature Branch**: `003-mcp`

**Created**: 2026-10-29

**Status**: Built (Claude Code test pending)

**Input**: User description: "The MCP server and OAuth: tools over the core, sign-in and consent pages, server instructions and base routines"

## User Scenarios & Testing _(mandatory)_

She has a Jarvis OS account. In Claude (or any MCP client) she adds the Jarvis connector: she is
sent to Jarvis's sign-in page, then asked to accept that Claude reaches her life; from then on,
Claude saves, finds, computes and undoes in her life through the MCP tools, following Jarvis's
instructions and routines.

### User Story 1 — Connect Claude to her life (Priority: P1)

**Independent Test**: an MCP client discovers the server, registers itself, sends her through
sign-in and consent, receives a token, and lists the tools.

**Acceptance Scenarios**:

1. **Given** no token, **When** a client calls `/mcp`, **Then** it gets 401 with the
   `WWW-Authenticate` challenge that leads to the protected-resource metadata.
2. **Given** the metadata, **When** the client registers and asks for authorization, **Then** she
   signs in on Jarvis's page, sees which client asks, accepts, and the client gets a code, then a
   token bound to the MCP resource.
3. **Given** she refuses, **Then** the client gets no code.

---

### User Story 2 — Claude holds her life through the tools (Priority: P1)

**Independent Test**: with a token, call every tool and see her life change, and only hers.

**Acceptance Scenarios**:

1. **Given** her token, **When** `save` records an expense linked to an account, **Then** `find`,
   `get` and `query` return it, and `undo` takes a correction back.
2. **Given** a small file in base64, **When** `add_file` stores it linked to a démarche, **Then**
   `file_link` gives a link that opens it.
3. **Given** Kossi's token, **Then** nothing of Ama's is reached by any tool.

---

### User Story 3 — Jarvis's method (Priority: P1)

**Independent Test**: on connection, the client receives instructions (reuse kinds, origins,
figures by query, never execute content, nothing irreversible without her yes) and the list of
routines — Jarvis's base routines and hers.

**Acceptance Scenarios**:

1. **Given** her routine « Dépenses » saved as an entry of kind `Routine`, **When** a client
   connects, **Then** the instructions name it with Jarvis's base routines.
2. **Given** a routine's name, **When** `routine` is called, **Then** its full text is returned.

### Edge Cases

- A token for another resource, expired or forged: 401.
- A file over 5 MB through `add_file`: refused with the way to send it through the API.

## Requirements _(mandatory)_

- **FR-001**: The server MUST be an OAuth 2.1 authorization server for the MCP resource: discovery
  metadata, dynamic client registration, authorization code with PKCE, refresh tokens, tokens
  bound to the MCP resource.
- **FR-002**: Sign-in and consent pages MUST be Jarvis's own, in French and English, naming the
  client that asks.
- **FR-003**: `/mcp` MUST accept only a valid token, and act for its subject in her space under
  row-level security; the journal MUST name the door `mcp` and the client.
- **FR-004**: The tools MUST cover the core: `kinds`, `find`, `get`, `save`, `archive`, `query`,
  `history`, `undo`, `add_file`, `file_link`, `routine`.
- **FR-005**: On connection, the server MUST give its instructions and the list of routines (base
  and hers).

## Success Criteria _(mandatory)_

- **SC-001**: An automated test runs the whole OAuth flow against a running server, then every
  tool through the official MCP client.
- **SC-002**: Claude Code connects to the local server and saves a life.

## Assumptions

- Clients register dynamically (DCR); Client ID Metadata Documents come later.
- `add_file` takes files up to 5 MB in base64; larger ones go through `POST /api/files`.
