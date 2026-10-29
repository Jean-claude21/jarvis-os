# @jarvis-os/api

The doors of Jarvis OS over the core: accounts (`/auth`), the REST API (`/api`) and, from spec 003,
the MCP server (`/mcp`). A Hono server; the routes parse, call `@jarvis-os/core` and answer.

```mermaid
flowchart LR
  C[Client: app, tests] -->|Bearer token| API[/api/]
  C -->|sign up, sign in| AUTH[/auth — Better Auth/]
  API -->|asPerson| CORE[@jarvis-os/core]
  CORE --> PG[(Neon Postgres, RLS)]
  API -->|files| S3[(Neon Object Storage)]
```

## Run

```bash
pnpm db:migrate             # core and accounts tables on the dev branch
pnpm --filter @jarvis-os/api dev   # http://localhost:3700, dev branch
pnpm --filter @jarvis-os/api test  # Neon test branch and its storage
```

## Accounts

`POST /auth/sign-up/email` `{ email, name, password }` makes the account and its space and signs in;
`POST /auth/sign-in/email` signs in. Both answer with a `set-auth-token` header: send it as
`Authorization: Bearer <token>` (or keep the session cookie).

## Routes

| Method | Path                                                         | Core function                        |
| ------ | ------------------------------------------------------------ | ------------------------------------ |
| GET    | `/api/me`                                                    | her account and her space            |
| GET    | `/api/kinds`                                                 | `kinds`                              |
| GET    | `/api/entries?text&kind&from&to&archived&limit`              | `find`                               |
| GET    | `/api/entries/:id`                                           | `get`                                |
| POST   | `/api/save`                                                  | `save`                               |
| POST   | `/api/entries/:id/archive`                                   | `archive`                            |
| POST   | `/api/query` `{ sql }`                                       | `query`                              |
| GET    | `/api/history?target&limit`                                  | `history`                            |
| POST   | `/api/undo` `{ journalId }`                                  | `undo`                               |
| POST   | `/api/files` (multipart `file`, `title?`, `data?`, `links?`) | `addFile`                            |
| GET    | `/api/files/:id`                                             | the file's bytes                     |
| GET    | `/api/files/:id/link?seconds`                                | a link that opens it without a token |

Errors answer `{ error }` with 400 (what to fix), 401 (sign in), 404 (not in her space) or 500.
An `x-jarvis-client` header names the client in the journal.
