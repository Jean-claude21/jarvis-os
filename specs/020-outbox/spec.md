# Feature Specification: Every message, on her channel, and its trace

**Feature Branch**: `020-outbox`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Plan v2, items S3 (one sending service) and S4 (reminders by e-mail), chosen by the author
in the plan's order. « Les rappels pourront être par mail aussi. »

## What is missing

The watcher calls Telegram directly: a message that fails is lost (no second try), nothing keeps a
trace of what was sent, and Telegram is the only way to reach her. Everyone has an e-mail address;
not everyone has Telegram.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Nothing sent twice, nothing lost (Priority: P1)

1. Every message Jarvis sends (a reminder, the morning brief) first enters an outbox: who, which
   channel, what, and a key that makes the same message impossible to enter twice.
2. The watcher delivers the outbox each minute. A failed delivery is tried again (after 1, then 5,
   then 30 minutes); after three failures the message is « failed » with the reason.
3. She can read what was sent to her these last days: when, on which channel, delivered or not.

**Proof**: a message entered twice is kept once; a channel that fails twice then works delivers on
the third try; a channel that always fails ends « failed » with its reason after three tries.

### User Story 2 — Reminders and briefs by e-mail (Priority: P1)

1. In her « Channel », she chooses where each kind of message goes: Telegram, e-mail, or both;
   without a choice, Telegram when linked, else e-mail.
2. An e-mail is sent to her account's address, from the address Jarvis is configured with (any SMTP
   server: Gmail, Brevo, her own server later).
3. A reminder's e-mail carries four actions: « Done », « In one hour », « Tomorrow », « Not for
   me ». Each opens a short page that confirms; confirming acts as her, once, journaled with the
   door « email ». A link opened by a mail scanner changes nothing.

**Proof**: a reminder due is sent by e-mail (captured, not delivered, in the tests); its « Done » link
shows a page, confirming marks the reminder done and journals it; the same link a second time says
it was already used; a link changed by one character is refused.

### Edge Cases

- No SMTP configured: e-mail is not offered; Telegram stays the channel; nothing fails.
- Her address bounces: the message ends « failed » with the server's reason; the next one is still
  tried.
- A repeated reminder snoozed: only this occurrence moves; the repetition keeps its rhythm.

## Requirements _(mandatory)_

- **FR-001**: Table `outbox` (migration `0013_outbox.sql`): person, space, channel, kind, subject,
  body, the entry it concerns, a unique key, state (`queued`, `sent`, `failed`, `acted`), attempts,
  next try, last error, times. Its row-level security lets a person read only her own messages; the
  watcher reaches the pending ones through a `security definer` function that returns ids only.
- **FR-002**: `packages/core/src/outbox.ts`: enter (deduplicated), the pending ones, mark sent, mark
  failed (with the next try), her recent messages. No channel or vendor name in the core.
- **FR-003**: `apps/api`: the Telegram and e-mail channels; the watcher's pass enters reminders and
  briefs in the outbox, then delivers it.
- **FR-004**: E-mail through SMTP (`JARVIS_SMTP_URL`, `JARVIS_EMAIL_FROM`); disabled when absent.
- **FR-005**: Action links signed with the branch's secret, one use, valid 7 days; `GET /act/:token`
  shows the confirmation page, `POST /act/:token` acts.
- **FR-006**: `GET /api/outbox`: her messages of the last 7 days.
- **FR-007**: Every visible word in the catalogs, French and English.

## Success Criteria _(mandatory)_

- **SC-001**: No message is sent twice; none is lost silently.
- **SC-002**: A person without Telegram receives her reminders and brief by e-mail.
- **SC-003**: Marking a reminder done from an e-mail takes two clicks and is journaled.

## Assumptions

- WhatsApp and phone notifications come later, as further channels of the same outbox.
- Quiet hours and grouping (plan v2, S3) follow once the outbox is in place.
