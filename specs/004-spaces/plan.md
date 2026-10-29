# Implementation Plan: Shared spaces and charters

**Branch**: `004-spaces` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

The core already scopes every row by space and every policy by membership. This plan adds what
sharing needs — a `personal` flag, invitations, leaving, the spaces a client may reach — and makes
every door name its space. A charter is an ordinary entry (« Charte ») the MCP server reads into its
instructions: no new mechanism, only text (constitution II).

## Technical Context

**Storage**: migration `0003_spaces.sql` — `space.personal`, `invitation`, `client_space`, policies
for renaming, roles and leaving, and two `security definer` functions: the preview of a link and
its acceptance (the invited person is not a member yet, so she cannot read the invitation).

**Testing**: Vitest on the Neon `test` branch — core stories directly; API and MCP through the
in-process server and the MCP SDK's in-memory client; the invitation page in a browser.

## Constitution Check

| Principle                    | How this plan keeps it                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| I. Simple and working        | a charter is an entry; no mail sending — she sends the link; no roles beyond owner/member                                       |
| II. The model thinks         | where to file (« Moi » or « Nous ») is an instruction, not code                                                                 |
| III. One core, several doors | spaces live in the core; API and MCP only resolve the space named                                                               |
| IV. Her life is hers alone   | `personal` spaces refuse invitations in policy; column grants keep `personal` untouchable; a client reaches only allowed spaces |
| V. Trust                     | membership changes journaled; the link's secret kept as a hash, carried in the fragment                                         |

## Project Structure

```text
packages/core/
├── db/migrations/0003_spaces.sql
├── src/spaces.ts        spaces, invitations, leaving, client allowances
├── src/entries.ts       one kind regardless of case and accents
├── src/query.ts         several spaces, `my_spaces`, `space` on each row
└── tests/spaces.test.ts
apps/api/
├── src/spaces.ts        the space a call names; account names; invitation link
├── src/routes.ts        `?space=`, /spaces, /invitations, /clients/:client/spaces
├── src/mcp.ts           `space` on every tool; spaces, create_space, invite; charters
├── src/instructions.ts  spaces, charters, reminders kept in Jarvis, the time she gave
├── src/pages.ts         consent with spaces; the invitation page
└── tests/spaces.test.ts
```

## Complexity Tracking

None.
