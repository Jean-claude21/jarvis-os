# 086 — Connections: one relay for every call outside (v3 D16)

## What changes

1. **A connection may be an `api`**: a provider Jarvis knows, reached through its relay —
   `google-calendar` (read-only), `google-drive` (`drive.file`: only the files she shares with
   Jarvis or that it creates), `ics` (any published calendar: timetable, club, school).
   `GET /api/connections/providers`, `POST /api/connections { provider, name?, url? }`.
2. **Google's sign-in is Jarvis's own** (not Google's MCP preview): Jarvis sends her to Google's
   consent page and comes back to `/api/connections/oauth/callback`; the tokens are sealed in the
   connection. A token is renewed under a lock on the connection (never twice at once).
3. **The relay** (`relay.ts`): opens her key or tokens only there; https only; 20 s per try; waits
   and tries again on 429 and 5xx (honouring `Retry-After`), renews once on 401; measures each call
   and journals it (`connector.call` with method, path, status, ms — never content nor secret).
   `POST /api/connections/:id/request` to try one.
4. **Health**: every check keeps the failures in a row and the last time it answered; every hour
   the server checks the connections not checked for a day (`jarvis_connections_due`). A connection
   refused, unreachable or waiting for her sign-in shows in « À régler ».
5. **ICS sources**: every hour (or `POST /api/connections/:id/sync`) a followed calendar is read
   again; its events from two weeks ago to six months ahead become « Event » entries known by
   their uid — a class moved is updated, never doubled. Written as read, by the source.

## Proof

A public calendar connected, read twice (13 created, then 0), shown in the agenda; a broken address
refused with one failure and shown in « À régler »; a call through the relay journaled (200, 147 ms);
Google's consent page reached with the callback address.

## Needs the author

Add the callback addresses to the Google OAuth client (Google Cloud console):
`https://next.jarvis.kete.digital/api/connections/oauth/callback` and
`https://jarvis.kete.digital/api/connections/oauth/callback`.
