import { z } from 'zod';
import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { spacesOf } from './spaces';

// Her preferences of display (spec 017): how she shows her kinds, how each list opens — kept in the
// « Channel » of her own space, beside her time zone, so every device shows them the same way.

export const preferencesSchema = z.object({
  /** Her kinds flat, or in her groups. */
  kinds: z.enum(['flat', 'grouped']).optional(),
  /** How each kind's list opens: flat, by period, by folder. */
  modes: z.record(z.string().min(1).max(80), z.enum(['flat', 'period', 'folder'])).optional(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

async function channelOf(tx: Tx) {
  const own = (await spacesOf(tx)).find((one) => one.personal);
  if (!own) throw new Error('No space of her own.');
  const [channel] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
  return { space: own.id, channel };
}

/** Her preferences, as kept; none at first. */
export async function preferencesOf(tx: Tx): Promise<Preferences> {
  const { channel } = await channelOf(tx);
  const parsed = preferencesSchema.safeParse(channel?.data.preferences ?? {});
  return parsed.success ? parsed.data : {};
}

/** Changes some of her preferences; the others stay. */
export async function setPreferences(
  tx: Tx,
  actor: Actor,
  patch: Preferences,
): Promise<Preferences> {
  const given = preferencesSchema.parse(patch);
  const { space, channel } = await channelOf(tx);
  const now = preferencesSchema.safeParse(channel?.data.preferences ?? {});
  const before = now.success ? now.data : {};
  const next: Preferences = {
    ...before,
    ...given,
    ...(given.modes ? { modes: { ...before.modes, ...given.modes } } : {}),
  };
  await save(tx, actor, space, {
    entries: [
      channel
        ? { id: channel.id, data: { preferences: next } }
        : { kind: 'Channel', title: 'Jarvis', data: { preferences: next } },
    ],
  });
  return next;
}
