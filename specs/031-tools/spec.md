# Feature Specification: Fewer doors

**Feature Branch**: `033-tools-grouped` (spec 031, second part of plan v2 item S13)

**Created**: 2026-11-10

## What is missing

Jarvis shows 38 tools to an assistant: a long list read at every conversation, among which it must find the right one.

## User Story 1 — The everyday tools, then families (Priority: P1)

1. The tools used every day stay on their own: `context`, `find`, `get`, `save`, `query`, `agenda`, `kinds`, `routine`.
2. The visual tools keep their own place, since each carries its own screen in the assistant: `dashboard`, `page`, `show_entry`, `upload_link`, `read_document`, `write_document`, `edit_document`.
3. The rarer ones gather in six families called with `action` and `args`: `spaces`, `apps`, `history`, `figures`, `files`, `connectors`. A family forwards to the tool it names, which checks its own arguments; its description lists each action with its arguments.
4. Instructions and routines name the family and the action (« `history` (action `undo`) »).

38 tools become 21. Ten was the aim; going lower would take the visual tools' screens away.

**Proof**: the list of tools is the one above; a family's description names its actions; an action with wrong arguments is refused with its reason; every earlier proof passes through the families (the test helper calls a moved tool as an assistant now does).
