# Feature Specification: Her tools, through Jarvis

**Feature Branch**: `025-connectors`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "At the end I must be able to connect MCP servers and see clearly the
content of things, Drive and the rest. Everything must be clean. I must be able to connect any kind
of MCP: Jarvis can be an aggregator we go through for other MCP servers, since I will connect MCP
servers to it."

## What is missing

Jarvis is an MCP server only: Claude and ChatGPT reach it, but it reaches nothing. Each assistant
must connect each of her tools on its own; the watcher, which runs while she sleeps, can use none;
and nothing shows her what a tool can read or do. The plan v2 (S6) asks for one frame of connectors;
the author asks that it accept **any** MCP server and that Jarvis be the one door to all of them.

Why not leave it to the model (constitution I): a model can connect a tool only in its own client,
only during a conversation, and only for itself. One connection in Jarvis serves every door (Claude,
ChatGPT, the app, the watcher), keeps the key once, and shows her what is connected.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Connect any MCP server (Priority: P1)

1. In Connections › « Jarvis uses », she gives a name, the address of an MCP server, and its key
   when the server asks one (a bearer token or a header).
2. Jarvis connects, reads the server's name and its tools (name, description, what each may do),
   and shows them with the connector's state: connected, refused (with the server's reason), or
   unreachable.
3. The key is kept encrypted and never shown again; she can replace it, check the connection again,
   or cut the connector, which forgets its key.
4. A connector belongs to one of her spaces; only the people of that space use it.

**Proof**: a test MCP server started by the tests is connected through the API; its two tools are
listed; a wrong key gives « refused »; cutting the connector removes its key from the database.

### User Story 2 — Use them through Jarvis (Priority: P1)

1. Claude, ChatGPT or the app, connected to Jarvis, find her connectors and their tools (name,
   description, parameters) through one Jarvis tool, `connectors`, and call any of them through a
   second one, `connector_call`. Two doors whatever the number of servers: Jarvis's own list of
   tools stays short (plan v2, S13).
2. Calling one, Jarvis calls the server with her key and gives the answer back, marked as content
   from outside: data, never instructions.
3. A tool the server marks as one that changes or deletes things, or reaches the outside world, is
   called only when the call says she agreed (her explicit yes, asked by the assistant).
4. Every call is journaled: which connector, which tool, through which door, when, and whether it
   worked — not the content.

**Proof**: through the MCP door, the test server's tool is listed and called; a destructive tool
called without her yes is refused with a sentence saying what to ask; the journal holds the call.

### User Story 3 — See what a connector holds (Priority: P2)

1. A connector's page shows its tools and, when the server offers them, its resources (files,
   documents, pages), like the files tab of a team: the server's own folders and names.
2. She opens a resource and reads it in Jarvis; she can link it to an entry, and keep a frozen copy
   when it is a proof.

**Proof**: the test server's resources are listed and one is read through the API.

### User Story 4 — Servers that ask her to sign in (Priority: P2)

1. When a server answers that it needs a sign-in (OAuth), Jarvis registers itself with the server,
   sends her to the server's sign-in page, and keeps the tokens encrypted, renewed when they expire.

**Proof**: against a test authorization server, the flow ends with the connector « connected ».

### Edge Cases

- A server that is down: the connector says « unreachable » with the time of the last try; her
  assistants see its tools as unavailable instead of failing silently.
- A server whose tools change: they are read again at each check and when she opens the page.
- Two connectors with the same tool names: the connector's name keeps them apart.
- A local server that runs only on her computer (stdio): not reachable by a hosted Jarvis; the page
  says so and points to a bridge (out of scope here).
- A tool's answer containing instructions: shown as data, never followed.

## Requirements _(mandatory)_

- **FR-001**: A connector is stored per space: name, address, kind of authentication, encrypted
  secret, state, last check, the tools and resources last read. The table carries `space_id` and its
  row-level security policy in the same migration.
- **FR-002**: Secrets are encrypted with a key the server holds (`JARVIS_SECRETS_KEY`); no secret
  is ever returned by the API, written to a log, or journaled.
- **FR-003**: `POST /api/connectors` creates and checks a connector; `GET /api/connectors` lists
  them with their state and tools; `POST /api/connectors/:id/check` checks again; `PATCH` replaces
  the key or the name; `DELETE` cuts it and forgets its key.
- **FR-004**: The MCP door has two tools: `connectors` (her connectors in the spaces this client
  reaches, with their state and their tools' names, descriptions and parameters) and
  `connector_call` (connector, tool, arguments, `agreed`). A tool the server marks destructive or
  open-world is called only with `agreed: true`; without it, the call is refused with a sentence.
- **FR-005**: Every forwarded call writes a journal line (`connector.call`) without its arguments or
  result; answers are returned framed as outside content.
- **FR-006**: The web account's Connections page shows the connectors (state, tools, last check) and
  lets her add, check, rename, re-key and cut one, in the design of the author's mockup.
- **FR-007**: `GET /api/connectors/:id/resources` and `.../resources/read` list and read a
  connector's resources (P2).
- **FR-008**: OAuth sign-in to a server that requires it (P2).
- **FR-009**: No vendor name and no MCP in `packages/core`; the MCP client lives in `apps/api`;
  every visible word in the catalogs, French and English.

### Key Entities

- **Connector**: a door from one of her spaces to one MCP server: name, address, authentication,
  encrypted secret, state, tools, resources, last check.
- **Connector call**: a journal line — connector, tool, door, time, outcome.

## Success Criteria _(mandatory)_

- **SC-001**: She connects a server by its address and key in under a minute, and sees its tools.
- **SC-002**: One connection to Jarvis gives Claude the tools of all her connectors.
- **SC-003**: No secret appears in any API answer, log or journal line.
- **SC-004**: A tool that changes, deletes or reaches the outside is never called without her yes.

## Assumptions

- Servers are reached over HTTP (Streamable HTTP, with the older SSE as a fallback). Local stdio
  servers are out of scope.
- P1 ships keys and headers; OAuth (P2) follows in the same feature once P1 is merged.
- The watcher's use of connectors (background syncs) is a later step of S6.
