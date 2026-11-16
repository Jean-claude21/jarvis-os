# 074 — Telegram keeps photos and documents

## Why

Her Telegram already reaches Jarvis (specs 015, 020, 035): she links her chat with a code, her
messages and voice notes are kept in « À ranger », her reminders come back there. A photo of a
receipt or a PDF she forwards is dropped without a word. On a phone, that is half of what one sends.

## What changes

1. A photo (the largest size Telegram gives) or a document she sends from her linked chat is
   fetched from Telegram and kept as a `Fichier` of her own space, with its name and type.
2. A capture is kept with it, in « À ranger »: her caption when she wrote one, else « Photo » or
   « Document : <name> ». The file is linked to the capture (role « pièce de »), so filing the
   capture later keeps its proof.
3. A photo or PDF is read later by the watcher like any uploaded file (spec 026): its words become
   searchable.
4. The bot answers as for a message (« Gardé ✓ — à ranger. »). A file Telegram will not give (over
   20 MB) or that the space cannot store gets a short answer saying so; nothing else is kept.
5. Nothing changes for a chat that is not linked: it is ignored.

## Out of scope

- Several bots, one per person: the bot stays the one of the server (`JARVIS_TELEGRAM_BOT_TOKEN`).
- The connector model of plan item S6 (fiches, health, fresh tokens): its own spec.

## Proof

- A linked chat sending a photo with a caption: one `Fichier` (its bytes stored), one `Capture`
  with the caption, the link between them, and the bot's answer.
- A document without caption: the capture says « Document : <name> ».
- An unlinked chat: nothing kept.
