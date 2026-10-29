# Tasks: Shared spaces and charters

- [x] T001 Migration `0003_spaces.sql`: `personal`, `invitation`, `client_space`, policies, column
      grants, preview and acceptance functions
- [x] T002 `packages/core/src/spaces.ts`: shared spaces, invitations, leaving, client allowances;
      `space.*` journaled, never undone
- [x] T003 One kind regardless of case and accents (`save`, `find`)
- [x] T004 `query` over several spaces: `my_spaces`, `space_id` and `space` on each row
- [x] T005 Core tests: invitation, refusals, sharing both ways, journal, leaving, kinds
- [x] T006 API: `?space=`, `/spaces`, invitations, leaving, client allowances; errors in words
- [x] T007 MCP: `space` on every tool; `spaces`, `create_space`, `invite`; charters and routines of
      each reachable space in the instructions; instructions on spaces, reminders and times
- [x] T008 Pages: consent lists her spaces; the invitation page; the first-name field fixed
- [x] T009 API and MCP tests: sharing through Claude, a client kept to what she allowed, charter
- [x] T010 The invitation page in a browser: create an account from the link, join, link used
- [x] T011 Docs: core and API READMEs, ARCHITECTURE, decisions 0005–0007, roadmap
- [ ] T012 `pnpm check` green; CI green on the pull request to `dev`
- [ ] T013 The author and a second account share « Nous » through Claude
