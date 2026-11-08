# Implementation Plan: Files by link, MCP Apps and dashboards

**Branch**: `005-views` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

The MCP Apps wire protocol is small: a `ui://` resource of type `text/html;profile=mcp-app`, a tool
naming it in `_meta.ui.resourceUri`, and JSON-RPC over `postMessage` between the view and its host.
The server keeps the MCP SDK it has (1.x); each view is plain HTML with a ~60-line bridge, no build
step. The upload link is a token signed with the server's secret, so the bytes go to `/upload/:token`
and never through the model.

```mermaid
sequenceDiagram
  participant M as Model
  participant H as Host (Claude, ChatGPT)
  participant V as Jarvis view (iframe)
  participant J as Jarvis OS
  M->>H: call dashboard { widgets }
  H->>J: tools/call dashboard
  J-->>H: words + structuredContent; _meta.ui.resourceUri
  H->>J: resources/read ui://jarvis/dashboard
  H->>V: render; ui/initialize → theme, locale
  H->>V: ui/notifications/tool-result
  V->>H: tools/call undo / show_entry (from a card)
  V->>J: POST /upload/:token (the upload view only)
```

## Constitution Check

| Principle                    | How this plan keeps it                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| I. Simple and working        | no framework, no build, no chart library: HTML, CSS and inline SVG                        |
| II. The model thinks         | the model writes the queries; a dashboard is an entry holding them                        |
| III. One core, several doors | views call the same tools; dashboards use `query`                                         |
| IV. Her life is hers alone   | a view acts through the host's own token; the upload token names one person and one space |
| V. Trust                     | figures recomputed, never stored; a failing query says why                                |

## Complexity Tracking

None.
