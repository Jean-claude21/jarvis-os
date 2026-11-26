# 110 — Connections that connect, with their logos, in a grid

_26 Nov 2026, asked by the author: « Assure-toi que les connexions marchent et mets les logos,
adopte une structure en grille pour lister les collections. »_

## Step back

Not a new module: the v3 screen of Réglages › Connexions (D16, spec 025), which had lost gestures
the v2 client had. Nothing changes in the domain; one field is added to an answer of the API.

## What was broken

- **A server that asks for a sign-in** (Gmail, Notion, Todoist, Dropbox…): « Relier » added it and
  stopped. The page waited for a `signIn` field that `POST /connectors` never sends; it answers the
  connection, in `needs_sign_in`. Its sign-in page was never opened.
- **A connection left « à connecter »** had no gesture to sign in: « Se reconnecter » was offered
  to the providers' APIs only.
- **A server with no address in the catalogue** (Zapier) was sent with an empty address, refused.
- **A server reached with a key** (Stripe, GitHub) was sent without its key.
- **The logos** the API already sends (simple-icons, inside the page) were not drawn.

## What changes

- `GET /connections/providers` gives each provider its `logo`, as `GET /connectors/catalog` does
  (Google Agenda, Google Drive; the ICS calendar its initial on its colour).
- « Relier » on a server that asks for a sign-in opens its sign-in page at once
  (`POST /connectors/:id/sign-in`), as the v2 client did. A connection « à connecter » offers
  « Se connecter », a server of tools as a provider.
- A server with no address asks for it on its card; one reached with a key asks for the key, with
  the link to where it is made.
- Each collection — her connections, the services, the servers of tools by group (au quotidien,
  fichiers, travail, argent, création) — is a grid of cards: one, two or three across.
- « Vérifier », « Relire » and every failure say their result (a toast).

## What Jarvis calls on her behalf: the public internet only

Found while checking the connections: a server of tools, an agent's address or an ICS calendar was
reached at any address she gave — `https://169.254.169.254/…` (the cloud's metadata), the server's
own network — when it was added, checked, called or read again. Only a rule's `call` was guarded,
by what the address said.

```
her address ──► refusalOf (https, no private or reserved IP, no .internal/.local, no name:password)
                    │ refused → 400 « … is not an address Jarvis calls: … », nothing saved
                    ▼
            outboundFetch ── the name resolved; every answer public, else no connection
                    │        (checked at the connection: a name changing its answer gains nothing)
                    ▼
               a redirection? ── checked again from the top; to another site, none of her keys
```

- `apps/api/src/outbound.ts`: `refusalOf`, `assertCallable`, `outboundFetch` (undici, its own
  resolution), `localAllowed` (her own `http://localhost`, on a developer's Jarvis only — as before).
- Used by: adding or changing a connector, every MCP connection (tools, resources, its sign-in's
  discovery), an HTTP agent's check and calls, the relay (an ICS calendar), the logos.

## Proof

Checked by hand on a local server (`JARVIS_BRANCH=test`): Notion opens its sign-in page, then shows
« à connecter » with « Se connecter »; Zapier asks for its address; an ICS calendar is related,
read again (12 events) and checked; the page fits a phone's width; no error in the console.
`apps/api/tests/{catalog,connectors,connectors-oauth}.test.ts` pass.
`apps/api/tests/outbound.test.ts`: private, reserved and non-https addresses refused in every
spelling; a name resolving to the metadata address refused at the connection; a redirection to the
server's network refused; one to another site followed without her keys. On the local server:
`https://169.254.169.254`, `https://10.0.0.5` and an ICS at `https://192.168.1.10` answer 400 and
are not saved; a public ICS and Notion still connect.
