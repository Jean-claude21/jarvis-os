# Roadmap

> Each spec ships something a person can use and ends with its **proof**. A spec is « built » when
> merged into `dev` with green CI, « proven » when its proof was obtained with a real life.

| Spec | What it ships                                                                                                                                                                         | Proof                                                                                                                                        | State   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 001  | **The core**: spaces, entries of any kind, links, the journal and undo, read-only query, row-level security                                                                           | Tests on the Neon `test` branch: an entry saved, linked, changed and undone; one person never reads another's life; a query computes a total | built   |
| 002  | **Accounts and the REST API**: Better Auth accounts, `/api` over the core, files in Neon Object Storage                                                                               | API tests: sign up, save, find, query, undo; a file uploaded, read back and linked                                                           | built   |
| 003  | **The MCP server and OAuth**: the tools over the core, sign-in and consent pages, server instructions and base routines                                                               | An MCP client signs in through OAuth and uses every tool; Claude connected and saving a life                                                 | proven  |
| 004  | **Shared spaces and charters**: a space per circle of people, invitations, the space of every tool, consent per space, a charter per space; kinds kept consistent                     | Two people share « Nous », each keeps « Moi » private; a client sees only the spaces she allowed; the charter reaches the client             | built   |
| 005  | **Files by link, MCP Apps and dashboards**: an upload link that keeps bytes away from the model; Jarvis's views inside Claude and ChatGPT; saved dashboards recomputed on each open   | A photo sent by link; a dashboard drawn inside Claude, with a text fallback elsewhere                                                        | built   |
| 006  | **The watcher**: reminders once or repeated (five fields, `L` the last day), on her clock, told on Telegram; the anticipation in every connection                                     | A reminder said in Claude arrives on Telegram on time                                                                                        | built   |
| 007  | **Her data, hers**: export as Markdown, import of a Markdown life (the author's Life OS first)                                                                                        | The author's Life OS imported, then exported back as readable Markdown                                                                       | proven  |
| 008  | **Her method and her documents**: skills imported as routines, rule files as the charter; documents written and read section by section, a reading view, versions, print and download | The parity checklist with the author's Life OS passed in Claude                                                                              | built   |
| 009  | **The platform**: the web account — profile, spaces, connections, her life, journal, dashboards, routines, data                                                                       | She manages her spaces and connections and reads her life without a model                                                                    | built   |
| 011  | **The calendar**: time as a field of any entry; her week in Claude (`agenda`), in the app, and in her phone's calendar (iCalendar, repetitions as RRULE)                              | Her week right in the three; her phone subscribed to her address                                                                             | built   |
| 012  | **Type models**: the shape of a kind said once — fields, natures, required, choices, rangement of the export, display; every save follows it                                          | Her Finances modelled in Claude, one shape for months                                                                                        | built   |
| 010  | **Production**: hosting, domain, the `main` branch deployed, backups, monitoring, the cost of a day of use                                                                            | Claude connected to the production URL; a restore tested                                                                                     | planned |

Later, once a real need asks: search by meaning, capture by Telegram, a voice for documents,
a nightly export to her git repository, linking any person's Telegram, imports
(bank CSV, ICS, mail), methods shared between people, the Jarvis app (voice, mobile).

## Decisions waiting for the author

- The product name (« Jarvis » is a working name, close to a known brand), before the landing page.
- Prices, once the real cost per day of use is measured.
- The real-time voice provider.
- Hosting and domain for production (spec 010).
- When a couple parts: does each keep a copy of « Nous », or only its creator?
