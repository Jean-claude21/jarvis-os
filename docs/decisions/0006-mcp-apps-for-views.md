# 0006 — Jarvis's views inside the clients: MCP Apps

- Status: accepted
- Date: 2026-10-29

## Context

Saving a photo through `add_file` made Claude encode it in base64 and write it out as tokens: two
minutes for 7 KB, impossible for a real document. Showing a dashboard as text loses what a chart
says. MCP Apps (extension `io.modelcontextprotocol/ui`, specification 2026-01-26, stable) lets a
tool declare a `ui://` resource (`text/html;profile=mcp-app`) that Claude, ChatGPT and other hosts
render in a sandboxed frame; the frame calls the server's tools through the host.

## Decision

- Bytes never travel through the model: `upload_link` returns a short-lived signed link where the
  client, or she, sends the file; `add_file` keeps base64 for small files only.
- Jarvis's views are MCP Apps: the upload, a dashboard, an entry with its links and history, a
  confirmation before an irreversible act. One design system — the author's brand (Kete): its
  colors, type and sharp corners — light and dark, usable on a phone, following the host's theme.
- Every tool with a view still answers in words and data: a host without MCP Apps loses nothing.
- A view is plain HTML and a small script, no build step, served by the server itself.
- A dashboard is an entry of kind « Tableau de bord » holding widgets (a query and a chart type);
  figures are never stored, they are recomputed on each open (decision 0004).

## Consequences

- One renderer serves the clients now and the web platform later (spec 009).
- The views are tested in a browser against a small host stand-in, and in Claude by the author.
