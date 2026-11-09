import { beforeAll, describe, expect, it } from 'vitest';
import {
  enterMessage,
  markActed,
  markFailed,
  markSent,
  messageOf,
  pendingMessages,
  recentMessages,
} from '../src';
import { db, person, type Person } from './people';

// Spec 020: every message enters the outbox once, is tried again after a failure, keeps its trace.
describe('the outbox', () => {
  let ama: Person;
  let kofi: Person;
  // A message is due from the moment it enters: « now » is a little after the real clock.
  const now = new Date(Date.now() + 5_000);
  const enter = (who: Person, dedupe: string) =>
    who.as((tx) =>
      enterMessage(tx, {
        person: who.actor.person,
        spaceId: who.space,
        channel: 'email',
        kind: 'reminder',
        subject: 'Renouveler le passeport',
        body: 'Il expire en mars.',
        dedupe,
      }),
    );

  beforeAll(async () => {
    ama = await person('Ama');
    kofi = await person('Kofi');
  });

  it('keeps a message once, whatever the number of times it is entered', async () => {
    const key = `reminder:${ama.actor.person}:passport:2026-11-09T08:00`;
    const first = await enter(ama, key);
    const second = await enter(ama, key);
    expect(first).toBeTypeOf('number');
    expect(second).toBeNull();
  });

  it('is due in the pass that entered it, even on a server clock behind the database', async () => {
    const id = (await enter(ama, `clock:${ama.actor.person}:${Date.now()}`))!;
    const behind = new Date(Date.now() - 30_000);
    expect((await pendingMessages(db, behind)).some((one) => one.id === id)).toBe(true);
  });

  it('tries again after a failure, then fails for good after the last try, with the reason', async () => {
    const id = (await enter(ama, `retry:${ama.actor.person}:${Date.now()}`))!;
    const due = async (at: Date) => (await pendingMessages(db, at)).some((one) => one.id === id);
    expect(await due(now)).toBe(true);
    await ama.as((tx) => markFailed(tx, id, 'connection refused', now));
    expect(await due(now)).toBe(false);
    expect(await due(new Date(now.getTime() + 61_000))).toBe(true);
    await ama.as((tx) => markFailed(tx, id, 'connection refused', now));
    await ama.as((tx) => markFailed(tx, id, 'connection refused', now));
    await ama.as((tx) => markFailed(tx, id, 'mailbox full', now));
    const failed = await ama.as((tx) => messageOf(tx, id));
    expect(failed).toMatchObject({ state: 'failed', attempts: 4, lastError: 'mailbox full' });
    expect(await due(new Date(now.getTime() + 86_400_000))).toBe(false);
  });

  it('delivers on a later try, and takes an action from it once only', async () => {
    const id = (await enter(ama, `later:${ama.actor.person}:${Date.now()}`))!;
    await ama.as((tx) => markFailed(tx, id, 'timeout', now));
    await ama.as((tx) => markSent(tx, id, new Date(now.getTime() + 61_000)));
    expect(await ama.as((tx) => messageOf(tx, id))).toMatchObject({ state: 'sent', attempts: 2 });
    expect(await ama.as((tx) => markActed(tx, id, 'done', now))).toBe(true);
    expect(await ama.as((tx) => markActed(tx, id, 'tomorrow', now))).toBe(false);
    expect(await ama.as((tx) => messageOf(tx, id))).toMatchObject({
      state: 'acted',
      action: 'done',
    });
  });

  it('shows a person her own messages, never another’s', async () => {
    await enter(kofi, `kofi:${kofi.actor.person}:${Date.now()}`);
    const hers = await ama.as((tx) => recentMessages(tx));
    expect(hers.length).toBeGreaterThan(0);
    expect(hers.every((one) => one.personId === ama.actor.person)).toBe(true);
  });
});
