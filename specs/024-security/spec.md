# Feature Specification: Who may come in, and how many tries

**Feature Branch**: `024-security`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, item S11 (security: controlled sign-up, a limit on attempts, sensitive data and
tokens encrypted), in the plan's order.

## What is missing

Anyone who finds the address can make an account. Nothing counts attempts: a password can be
guessed by trying, from as many server instances as Netlify starts.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Sign-up on invitation (Priority: P1)

1. Whoever runs Jarvis chooses: open to anyone, or on invitation (`JARVIS_SIGNUP=invite`).
2. On invitation, an address may make an account when a person invited it to a space (not answered
   yet), or when the configuration allows it (`JARVIS_SIGNUP_ALLOW`: addresses, « @domain »).
3. Refused, the page says why, in her language: ask a person already here to invite you.

**Proof**: on invitation, an address no one invited is refused with its reason; an allowed domain
and an invited address (whatever its case) come in; the rule reads its configuration.

### User Story 2 — Attempts counted (Priority: P1)

1. Five sign-ins a minute, five sign-ups an hour, per client address; the rest of `/auth`, a
   hundred a minute. Counted in the database: every server instance counts the same.
2. Refused, the page says to wait a minute.

**Proof**: the sixth sign-in in a minute from one address is refused; from another, it is not.

## Requirements

- **FR-001** The rule is open by default: choosing « invite » for production is decided at the end,
  with the production settings.
- **FR-002** Before an account exists, the database says only whether an address is invited.
- **FR-003** Encrypting the tokens of other services comes with the connectors (S6): none is kept
  today; passwords are hashed and signing keys encrypted by Better Auth already.
