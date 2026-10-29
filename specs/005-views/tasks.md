# Tasks: Files by link, MCP Apps and dashboards

- [x] T001 `views/base.ts`: the Kete design system (light, dark, phone) and the MCP Apps bridge
      (`ui/initialize`, tool input and result, host context, `tools/call`, size)
- [x] T002 `views/words.ts`: the views' words, French and English
- [x] T003 `views/upload.ts`: signed upload tokens; the drop-zone view, also a plain page
- [x] T004 `views/dashboard.ts`: widgets computed by `query`; number, bars, curve, table
- [x] T005 `views/entry.ts`: fields with origins, links, history with undo
- [x] T006 `views/register.ts`: `ui://` resources with their CSP; `dashboard`, `show_entry`,
      `upload_link` naming their views, answering in words too
- [x] T007 `app.ts`: `GET` and `POST /upload/:token`
- [x] T008 Instructions and the « Tableau de bord » routine
- [x] T009 Tests: resources and tool metadata, dashboards given and saved, the card, upload by
      link, forged and expired links
- [x] T010 The three views in a browser: light, dark, phone width
- [x] T011 Docs: API README, ARCHITECTURE, roadmap
- [ ] T012 `pnpm check` green; CI green on the pull request to `dev`
- [ ] T013 In Claude: a dashboard drawn, a photo sent by the drop zone
