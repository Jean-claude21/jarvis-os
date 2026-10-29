# Roadmap

> Each spec ships something a person can use and ends with its **proof**. A spec is « built » when
> merged into `dev` with green CI, « proven » when its proof was obtained with a real life.

| Spec | What it ships                                                                                                                                                                       | Proof                                                                                                                                        | State   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 001  | **The core**: spaces, entries of any kind, links, the journal and undo, read-only query, row-level security                                                                         | Tests on the Neon `test` branch: an entry saved, linked, changed and undone; one person never reads another's life; a query computes a total | built   |
| 002  | **Accounts and the REST API**: Better Auth accounts, `/api` over the core, files in Neon Object Storage                                                                             | API tests: sign up, save, find, query, undo; a file uploaded, read back and linked                                                           | built   |
| 003  | **The MCP server and OAuth**: the tools over the core, sign-in and consent pages, server instructions and base routines                                                             | An MCP client signs in through OAuth and uses every tool; Claude connected and saving a life                                                 | proven  |
| 004  | **Shared spaces and charters**: a space per circle of people, invitations, the space of every tool, consent per space, a charter per space; kinds kept consistent                   | Two people share « Nous », each keeps « Moi » private; a client sees only the spaces she allowed; the charter reaches the client             | planned |
| 005  | **Files by link, MCP Apps and dashboards**: an upload link that keeps bytes away from the model; Jarvis's views inside Claude and ChatGPT; saved dashboards recomputed on each open | A photo sent by link; a dashboard drawn inside Claude, with a text fallback elsewhere                                                        | planned |
| 006  | **The watcher**: reminders, the morning brief, silences, notifications                                                                                                              | A reminder arrives on time, outside her silences                                                                                             | planned |
| 007  | **Her data, hers**: export as Markdown, import of a Markdown life (the author's Life OS first)                                                                                      | The author's Life OS imported, then exported back as readable Markdown                                                                       | planned |
| 008  | **The platform**: the web account — profile, spaces, connections, her life, journal, dashboards, routines, data                                                                     | She manages her spaces and connections and reads her life without a model                                                                    | planned |
| 009  | **Production**: hosting, domain, the `main` branch deployed, backups, monitoring, the cost of a day of use                                                                          | Claude connected to the production URL; a restore tested                                                                                     | planned |

Later, once a real need asks: search by meaning, a Telegram door, recurring entries, imports
(bank CSV, ICS, mail), methods shared between people, the Jarvis app (voice, mobile).

## Decisions waiting for the author

- The product name (« Jarvis » is a working name, close to a known brand), before the landing page.
- Prices, once the real cost per day of use is measured.
- The real-time voice provider.
- Hosting and domain for production (spec 009).
- When a couple parts: does each keep a copy of « Nous », or only its creator?
