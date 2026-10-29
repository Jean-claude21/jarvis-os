# 0005 — A space is a circle of people, with its charter

- Status: accepted
- Date: 2026-10-29

## Context

The core already has spaces and members, and every policy asks « is she a member of this space? ».
The doors only used a person's first space. The author wants to live his marriage in Jarvis: one
shared life for the couple, while each keeps a private one. His Life OS also shows rules « always
active » (a router of principles) beside procedures run at a moment (skills).

## Decision

- **A space is a circle of people who share, not a theme.** A link never crosses spaces, so a
  theme split into spaces would cut a life apart. Themes stay kinds and links.
- Every account has its own space « Moi », private for good. A shared space is created, then
  joined only by an invitation the invited person accepts herself.
- Roles: `owner` (invites, renames, removes) and `member`. Leaving is always possible.
- Every MCP tool and API route takes an optional `space`; without it, her own space. `query` reads
  every space she may reach, each row naming its space; a write goes to one space.
- A client's consent names the spaces it reaches; a token reaches nothing else.
- **A charter** is an entry of kind « Charte » in a space: the rules always active there. The MCP
  server gives every reachable space's charter in its instructions. A **routine** stays a
  procedure followed at a moment. Changing a shared charter is said to every member in the journal.
- Kinds are compared without case or accents: « dépense » and « Dépense » are one kind, written as
  first used.

## Consequences

- A couple has three spaces: « Moi » for each, « Nous » together; a family grows « Nous ».
- A professional space exists only when someone else enters it (an associate, an accountant).
- Who did what in a shared space is already in the journal (actor, door, client).
