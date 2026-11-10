import {
  appsOf,
  asPerson,
  capture,
  fileSure,
  preferencesOf,
  type Actor,
  type CaptureSource,
  type Tx,
} from '@jarvis-os/core';
import { shippedRoles } from './apps';

// Capture (spec 035): one door for Telegram, Claude and the app. Kept at once, pre-sorted by the
// words her apps declare; filed at once when sure and her rule for that source says so.

/** The words of her apps in a space (their roles), for the pre-sort. */
export async function appWords(tx: Tx, spaceId: string): Promise<Record<string, string[]>> {
  return Object.fromEntries(
    (await appsOf(tx, spaceId, shippedRoles)).map((one) => [one.app, one.role.intents]),
  );
}

export async function captureAs(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { text: string; source: CaptureSource; at?: string },
) {
  const kept = await capture(tx, actor, spaceId, { ...input, words: await appWords(tx, spaceId) });
  const rule = (await preferencesOf(tx)).capture?.[input.source] ?? 'inbox';
  const sure = (kept.data.guess as { sure?: boolean } | undefined)?.sure === true;
  if (rule === 'auto' && sure) {
    await fileSure(tx, actor, spaceId);
    return { capture: kept, filed: true };
  }
  return { capture: kept, filed: false };
}

export { asPerson };
