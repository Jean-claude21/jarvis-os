# Feature Specification: Shared spaces and charters

**Feature Branch**: `004-spaces`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "A couple lives one shared life while each keeps a private one: shared
spaces, invitations, the space of every tool, consent per space, a charter per space; and the first
fixes seen with Claude (kinds kept consistent, reminders kept in Jarvis, the sign-in page)."

## User Scenarios & Testing _(mandatory)_

Ama and Kossi are getting married. Each has an account and a private space « Moi ». Ama creates
« Nous », invites Kossi, who accepts; from then on, what concerns the household goes to « Nous »,
both see it and either can change it, and the journal says who did what. What is Ama's alone stays
in her « Moi », where Kossi never reaches. « Nous » has a charter — the rules of their household —
which Claude reads every time it opens their life.

### User Story 1 — A shared space by invitation (Priority: P1)

**Independent Test**: Ama creates « Nous » and invites Kossi's address; Kossi accepts with the
link; both are members; Kossi still never reaches Ama's « Moi ».

**Acceptance Scenarios**:

1. **Given** Ama's account, **When** she creates « Nous », **Then** she owns it and it is not
   private.
2. **Given** « Nous », **When** Ama invites an address, **Then** she gets a link valid 14 days.
3. **Given** the link, **When** Kossi, signed in with that address, accepts, **Then** he is a
   member; the link cannot be used again.
4. **Given** the link, **When** someone signed in with another address uses it, **Then** it is
   refused.
5. **Given** a private « Moi », **When** anyone tries to invite into it, **Then** it is refused.
6. **Given** « Nous », **When** Kossi leaves, **Then** he no longer reaches it and nothing in it
   is erased; Ama, the owner, may also remove him.

---

### User Story 2 — Every tool knows its space (Priority: P1)

**Independent Test**: through MCP, save an expense in « Nous » and a note in « Moi »; each lands
in its space; `query` totals over both, naming the space of each row.

**Acceptance Scenarios**:

1. **Given** no `space`, **When** a tool is called, **Then** it acts in her own « Moi ».
2. **Given** `space: "Nous"` (its name or its id), **When** `save` is called, **Then** the entry
   is in « Nous » and Kossi finds it.
3. **Given** both spaces, **When** `query` runs, **Then** it reads the rows of every space the
   client may reach, `my_entries.space` naming each, and `my_spaces` listing them.

---

### User Story 3 — A client reaches only the spaces she allowed (Priority: P1)

**Independent Test**: at consent, she leaves « Nous » unticked; that client sees only « Moi »,
even if it asks for « Nous » by name.

**Acceptance Scenarios**:

1. **Given** the consent page, **Then** it lists her spaces, each ticked, and she may untick some.
2. **Given** a client allowed « Moi » only, **When** it calls a tool with `space: "Nous"`, **Then**
   it is refused, saying the space is not allowed for this client.
3. **Given** a client connected before this feature, **Then** it reaches her « Moi » only.
4. **Given** a client creates a space through `create_space`, **Then** that client may reach it.

---

### User Story 4 — The charter of a space (Priority: P1)

**Independent Test**: save an entry of kind « Charte » in « Nous »; a client that connects reads
it in its instructions, under « Nous ».

**Acceptance Scenarios**:

1. **Given** charters in « Moi » and « Nous », **When** a client connects, **Then** its
   instructions give each, named by its space.
2. **Given** routines in each space, **Then** the instructions name them with their space.

---

### User Story 5 — The fixes seen with Claude (Priority: P2)

1. **Given** a kind « dépense », **When** an entry of kind « Dépense » is saved, **Then** it takes
   the kind as first written: one kind.
2. **Given** a reminder asked, **Then** the instructions say it lives in Jarvis (« Rappel »), even
   when the client has its own scheduler, which may double it until the watcher exists.
3. **Given** « I did it at 7:10 », said later, **Then** the instructions say to write the time she
   gave, not the time of saving.
4. **Given** the sign-in page, **Then** the first-name field shows only when creating an account.

### Edge Cases

- An expired, withdrawn or already used invitation: refused, in words.
- The last member of a shared space cannot leave it (nothing would reach it any more).
- An owner who leaves while others stay: the oldest member becomes owner.
- Membership changes are journaled in the space and cannot be undone through `undo`.

## Requirements _(mandatory)_

- **FR-001**: Each account MUST have one private space, which no one can be invited into.
- **FR-002**: Shared spaces MUST be joined only through an invitation accepted by the invited
  address; invitations expire, are used once, can be withdrawn.
- **FR-003**: Every API route and MCP tool MUST take an optional space (id or name), defaulting to
  her private space; `query` MUST read every space the door may reach and name each row's space.
- **FR-004**: A client's access MUST be limited to the spaces allowed at consent (or created by
  that client); a client without any recorded allowance reaches her private space only.
- **FR-005**: The MCP instructions MUST carry the charter and the routines of every reachable
  space, named by space.
- **FR-006**: Kinds MUST be one regardless of case and accents, written as first used.
- **FR-007**: Every table added MUST carry `space_id` and its row-level security policy in the same
  migration.

## Success Criteria _(mandatory)_

- **SC-001**: Tests on the Neon `test` branch prove stories 1 to 5, including that a member of
  « Nous » never reaches another member's « Moi ».
- **SC-002**: The author and a second account share « Nous » through Claude.

## Assumptions

- Jarvis does not send e-mail yet: the invitation link is given to her, she sends it herself.
- Allowing a space to an already connected client is done by connecting it again, until the
  platform (spec 008) offers it.
