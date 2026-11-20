import {
  agentOfRule,
  appsOf,
  asPerson,
  capture,
  fileSure,
  phrasesOf,
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
  const phrase = await phraseOf(tx, spaceId, input.text);
  if (phrase) return { capture: kept, filed: kept.data.status === 'filed', phrase };
  const rule = (await preferencesOf(tx)).capture?.[input.source] ?? 'inbox';
  const sure = (kept.data.guess as { sure?: boolean } | undefined)?.sure === true;
  if (rule === 'auto' && sure) {
    await fileSure(tx, actor, spaceId);
    return { capture: kept, filed: true };
  }
  return { capture: kept, filed: false };
}

/**
 * What her words start, when they are a phrase (F6, F6b): an automation and the agent that runs it,
 * or a skill her assistant follows. Said back to her on Telegram.
 */
export async function phraseOf(
  tx: Tx,
  spaceId: string,
  text: string,
): Promise<{ kind: 'rule' | 'skill'; title: string; phrase: string; agent?: string } | null> {
  const fold = (one: string) => one.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const said = fold(text);
  const { rows } = await tx.query<{
    id: string;
    kind: string;
    title: string;
    data: Record<string, unknown>;
  }>(
    `select id, kind, title, data from entry
      where space_id = $1 and archived_at is null and jarvis_fold(kind) in ('rule', 'routine')
        and (data->'when' ? 'phrase' or data ? 'triggers')`,
    [spaceId],
  );
  for (const row of rows) {
    const phrase = phrasesOf(row.data).find(
      (one) => said === fold(one) || said.startsWith(`${fold(one)} `),
    );
    if (!phrase) continue;
    if (fold(row.kind) === 'routine') return { kind: 'skill', title: row.title, phrase };
    const agent = await agentOfRule(tx, spaceId, row);
    return { kind: 'rule', title: row.title, phrase, agent: agent.title };
  }
  return null;
}

export { asPerson };
