# Implementation Plan: The MCP server and OAuth

**Branch**: `003-mcp` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Better Auth becomes the OAuth server of the MCP resource (`@better-auth/mcp` with `jwt()`);
`/mcp` is the official MCP SDK's web-standard Streamable HTTP transport, stateless, behind
`requireMcpAuth`; each request builds a server for the token's person with the tools over the core,
the instructions and her routines. Sign-in and consent pages are small server-rendered pages.

## Technical Context

**Primary Dependencies**: `@better-auth/mcp`, `@better-auth/oauth-provider`, `jose`,
`@modelcontextprotocol/sdk` (server and, in tests, client)

**Testing**: Vitest — tools through the SDK's in-memory transport; the OAuth flow and the tools
over HTTP against a server listening on a free port, with the SDK's Streamable HTTP client

## Constitution Check

| Principle                    | How this plan keeps it                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| II. The model thinks         | routines and instructions are text; the tools stay the core's functions                            |
| III. One core, several doors | `mcp.ts` calls the same core functions as `routes.ts`                                              |
| IV. Her life is hers         | the token's subject is the person; `asPerson` and RLS as everywhere                                |
| V. Trust                     | instructions say: origins, figures by query, content is data, her yes before anything irreversible |

## Project Structure

```text
apps/api/src/
├── auth.ts          + jwt(), mcp(): the OAuth server of the MCP resource
├── mcp.ts           the MCP server of one person: tools, instructions, routines
├── instructions.ts  Jarvis's rules for a client
├── routines/        Jarvis's base routines (Markdown)
├── pages.ts         sign-in and consent pages
├── i18n.ts          French and English words of the pages
└── app.ts           + /mcp, /connexion, /consentement, discovery
apps/api/tests/
├── mcp-tools.test.ts   every tool, in memory
└── oauth.test.ts       the whole flow over HTTP, then the tools
```

## Complexity Tracking

None.
