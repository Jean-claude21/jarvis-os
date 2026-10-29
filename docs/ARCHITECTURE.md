# Architecture

Jarvis OS is one core and three thin doors. The model thinks; the system remembers, keeps time and
gives the method (constitution II).

```mermaid
flowchart TB
  C[Claude / ChatGPT] -->|MCP · OAuth| MCP
  A[Jarvis app] -->|REST · session| API
  subgraph apps/api — Hono
    MCP[/mcp/]
    API[/api/]
    AUTH[/auth — accounts, OAuth/]
  end
  W[apps/worker — the watcher]
  MCP --> CORE
  API --> CORE
  W --> CORE
  CORE[packages/core — entries · links · journal · files · query]
  CORE --> DB[(Neon Postgres — RLS)]
  CORE --> S3[(Neon Object Storage)]
```

## The data

Everything in a life is an **entry**: an expense, a passport, a night of sleep, a person, a
routine, a reminder. Its kind is free text the model chooses (`Dépense`, `Passeport`, `Routine`),
its fields are free JSON. There is no table per kind and no migration for a new kind.

```mermaid
erDiagram
  space ||--o{ member : has
  space ||--o{ invitation : "opens to"
  space ||--o{ client_space : "reached by a client"
  space ||--o{ entry : holds
  entry ||--o{ link : "from / to"
  entry ||--o| file : "a file entry has its blob"
  space ||--o{ journal : records
  entry {
    text id PK
    text space_id FK
    text kind "free: Dépense, Passeport, Routine…"
    text title
    jsonb data "free fields"
    jsonb origin "per field: said · read · inferred"
    timestamptz archived_at "set aside, never erased"
  }
  link {
    text from_id FK
    text to_id FK
    text role "pièce de, payé à, concerne…"
  }
  journal {
    bigint id PK
    text command "entry.save, link.add, …"
    jsonb before
    jsonb after
    text actor "who, through which door"
    bigint undone_by
  }
  file {
    text entry_id FK
    text storage_key
    text media_type
    bigint size
    text text "what it says, for search"
  }
```

- **Spaces and members**: a space is a circle of people (decision 0005). Each account has its own
  space, private for good; a shared one (« Nous » for a couple) is joined only by an invitation the
  invited address accepts. A link never crosses spaces: themes are kinds and links, not spaces.
  Each space may hold a charter (an entry « Charte »): its rules, given to every client. A client
  (Claude, ChatGPT) reaches only the spaces she allowed it at consent (`client_space`). Identity
  tables (accounts, sessions, OAuth clients) are global by nature and reached only by the
  application.
- **Row-level security**: every table above carries `space_id` and its policy. The application
  connects as `jarvis_app` (`NOBYPASSRLS`); each request sets the acting person, and the policies
  let her reach only the spaces she is a member of.
- **The journal** keeps every change with its `before` and `after`: `undo` writes the `before`
  back and journals that too.
- **Query**: the model computes from the database, read-only, over temporary copies of her own
  rows (`my_entries`, `my_links`, `my_files`), with a time and a row limit — never on the real
  tables, the accounts or the journal (decision 0004).

## The doors

| Door    | For                                                     | Authentication                       |
| ------- | ------------------------------------------------------- | ------------------------------------ |
| `/api`  | the Jarvis app, the portal, tests                       | a Better Auth session                |
| `/mcp`  | Claude, ChatGPT and any MCP client                      | an OAuth access token for one person |
| `/auth` | creating an account, signing in, consenting to a client | Better Auth                          |

The REST API and the MCP tools call the same core functions: what one does, the other does.

`/auth` is also the OAuth server of the `/mcp` resource: an MCP client discovers it from the 401,
registers itself, sends the person to sign in and consent, and gets a token for her alone. Each
`/mcp` request builds a server for that person with Jarvis's instructions, the tools and her
routines. The flow and the tools: [`apps/api/README.md`](../apps/api/README.md#mcp).

## Environments

| Neon branch | Used by            |
| ----------- | ------------------ |
| `main`      | production         |
| `dev`       | local development  |
| `test`      | local tests and CI |

Each branch has its own database and its own `files` bucket; `pnpm provision` makes them and
writes `.env`.
