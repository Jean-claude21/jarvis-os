# 079 — One offer never blocks the others

## Why

Since 15 Nov the morning collection kept nothing. An offer found by its fingerprint (entry X) came
back on an address another entry (Y) already held; her model keeps `url` unique, so the save refused
it — and with it the whole batch of 50. On 16 Nov the reading of the kept offers also ran out of
time: 80 pages in 30 minutes.

## What changes

1. **A unique value held by another entry**: when the item is found (X), X keeps its own value of
   that field and the rest is updated; when the item is new, it is that other entry (Y), updated.
2. **Twice in the same answer**: a second new item with the same unique value is skipped.
3. **Never the whole batch for one item**: the batch is saved at once; if her model refuses one
   item, each is saved on its own and the refused ones come back as `problems` with their reason.
4. **Reading the offers**: 40 pages a morning, two hours to do it; the rest is read the next morning.

## Proof

A batch where X comes back on Y's address beside a new offer and its copy: X keeps its address, the
new offer is made once, nothing is refused (packages/core/tests/agents.test.ts).
