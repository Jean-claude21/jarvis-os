# Feature Specification: Her apps, linked

**Feature Branch**: `035-apps-linked` (spec 033, plan v2 A1–A4)

**Created**: 2026-11-10

## User Story 1 — Each app says its role (A1, Priority: P1)

An app's bundle carries its role, in data: what it covers (her languages), her words that concern
it (« acheté », « payé », « FCFA »), the kinds it watches, reads and writes, what to ask when
something is missing (« Sur quel compte ? »), its own instructions (read only when concerned), and
its bridges. Installing it keeps an entry « App » (a system kind); an app installed before roles
gets one deduced from its models (or the shipped role of the same name).

## User Story 2 — Every assistant knows her apps (A2, P1)

The MCP instructions and `context` hold one line per app of her spaces, computed when read: an app
installed or removed shows at once.

## User Story 3 — Which apps does this touch? (A3, P1)

`which_apps` takes what she said and gives the apps it touches — by her words and the kinds they
watch, without any AI — with why, their instructions, what to ask, and the fields of the kinds to
write. One sentence may touch several apps.

## User Story 4 — Bridges (A4, P1)

A bridge is a rule of the app that owns it (« SubscriptionPayment → Transaction »): when an entry of
one kind is saved, the other app receives its own entry, linked — even if the assistant forgot.
Declared in a role (made at install, undone with it) or made on demand (`apps`, action `bridge`);
visible among her rules, journaled, undoable.

**Proof**: `packages/core/tests/roles.test.ts` (roles kept and deduced, the lines, the apps a
sentence touches and none for « Il fait beau », a payment saved becoming a movement of money, a
bridge on demand); `apps/api/tests/apps-linked.test.ts` (the shipped Finances installed with its
role, seen in `context`, found by `which_apps` with what to ask and its fields).
