# 0009 — The real-time app: each person brings her own model keys

- Status: accepted (to build after the platform is finished)
- Date: 2026-10-30

## Context

After the platform, Jarvis gets a real-time app (desktop, and a PWA on a phone): she speaks, Jarvis
answers aloud and shows blocks on screen. Voice models are billed by the minute of audio. Estimates
read in October 2026 (third-party articles, to check against the providers' pages before building):
OpenAI `gpt-realtime-2.1` about 3 to 9 $ per hour of conversation, its `mini` about 1.2 to 3 $,
Google Gemini Live about 0.7 to 2 $. A Claude or ChatGPT subscription gives no API key: through
Claude or Codex, Jarvis is already paid by her subscription; a voice app needs an API account.

## Decision

- **Bring your own key (BYOK).** In her settings she adds the key of her voice provider (one is
  enough: a real-time model calls Jarvis's tools itself) and, optionally, a key for a stronger model
  the voice delegates heavy analysis to.
- **Keys are kept by the server, encrypted, never shown again, revocable.** The app never holds
  them: the server gives it a short-lived token for the provider's real-time session.
- **The app reaches Jarvis with a personal key** (spec 015, migration 0010), made and revoked in her
  settings — nothing to buy.
- The provider is chosen when the app is built, by measuring cost and quality then.

## Consequences

- Jarvis pays for no voice minute; a person sees her own usage at her provider.
- A platform key (Jarvis paying, a subscription covering it) stays possible later, as an option.
