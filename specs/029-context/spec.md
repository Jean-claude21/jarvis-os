# Feature Specification: The charter received whole

**Feature Branch**: `030-meaning` (spec 029, shipped with spec 028)

**Created**: 2026-11-10

**Status**: Draft

**Input**: Plan v2, item S12: a `context` call at the start of a conversation — the date, her day,
what changed, the charter in full; Jarvis knows whether an assistant read it.

## What is missing

The charters are in the MCP instructions, which some clients cut or ignore: an assistant may act
without her rules, and nothing tells her whether it read them.

## User Story 1 — Read first, reminded otherwise (Priority: P1)

1. The tool `context` gives the date and time where she lives, her day (to fix, late, proposed,
   today), what is coming, what changed in her spaces since this assistant last read it (not
   what it did itself), her spaces, her charters in full and her routines.
2. Until an assistant read it in the last twelve hours, every answer of every tool ends with a line
   asking it to call `context`.
3. The web account's Assistants tab says when each assistant last read her charter and her day.

**Proof**: a tool answer before `context` carries the reminder; `context` gives her day, her
charter in full and the changes; the next answer has no reminder; a change made by the assistant is
not given back to it, hers is.
