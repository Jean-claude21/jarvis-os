# Roadmap

> Each spec ships something a person can use and ends with its **proof**. A spec is « built » when
> merged into `dev` with green CI, « proven » when its proof was obtained with a real life.

| Spec | What it ships                                                                                                           | Proof                                                                                                                                        | State   |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 001  | **The core**: spaces, entries of any kind, links, the journal and undo, read-only query, row-level security             | Tests on the Neon `test` branch: an entry saved, linked, changed and undone; one person never reads another's life; a query computes a total | built   |
| 002  | **Accounts and the REST API**: Better Auth accounts, `/api` over the core, files in Neon Object Storage                 | API tests: sign up, save, find, query, undo; a file uploaded, read back and linked                                                           | built   |
| 003  | **The MCP server and OAuth**: the tools over the core, sign-in and consent pages, server instructions and base routines | An MCP client signs in through OAuth and uses every tool; Claude Code connected and saving a life                                            | built   |
| 004  | **The watcher**: reminders, the morning brief, notifications                                                            | A reminder arrives on time, outside her silences                                                                                             | planned |
| 005  | **The Jarvis app**: desktop and mobile, real-time voice, charts and files                                               | « Hello Jarvis » answered by voice; a dashboard drawn                                                                                        | planned |

## Decisions waiting for the author

- The product name (« Jarvis » is a working name, close to a known brand), before the landing page.
- Prices, once the real cost per day of use is measured.
- The real-time voice provider.
