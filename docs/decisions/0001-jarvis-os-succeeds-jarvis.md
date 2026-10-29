# 0001 — Jarvis OS succeeds the first Jarvis

- Status: accepted
- Date: 2026-10-29

## Context

The first Jarvis (repository `jarvis`, 43 specs) coded the intelligence itself: categories,
projection, week plan, measures, permissions, proposals, receipts, its own agent and chat. The
browser test run of 2026-10-29 showed that the agent could not reach what the screens did, and that
most faults lived in layers that clients such as Claude already provide.

## Decision

Start a new repository. The model thinks; Jarvis OS gives it memory (entries, links, journal,
files), time (schedules, the watcher) and method (instructions, routines), behind an MCP server
and a REST API over one core. The first Jarvis is archived, nothing deleted.

## Consequences

- Kinds of things are data, not migrations; behavior is text, tested by scenarios.
- The vision stays: a life held by an agent, by the person's compass; certainty written; nothing
  executed from outside content; a SaaS.
