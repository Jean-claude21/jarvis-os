# Tasks: The MCP server and OAuth

- [x] T001 `auth.ts`: `jwt()` and `mcp()` (resource, pages, dynamic registration); migrations of the
      OAuth tables
- [x] T002 `i18n.ts` and `pages.ts`: sign-in and consent, French and English, naming the client
- [x] T003 `instructions.ts` and `routines/`: the rules and Jarvis's base routines
- [x] T004 `mcp.ts`: the tools over the core, the routines' list, `routine`
- [x] T005 `app.ts`: `/mcp` behind `requireMcpAuth`, the pages, the discovery routes
- [x] T006 Tests: every tool in memory, and isolation
- [x] T007 Tests: the OAuth flow over HTTP (401 challenge, discovery, registration, sign-in,
      consent, refusal, token), then the tools through the SDK client
- [x] T008 Claude Code connected to the local server; docs and roadmap
