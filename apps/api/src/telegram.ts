import { asPerson, fingerprintOf, find, save, spacesOf, type Actor } from '@jarvis-os/core';
import { randomBytes } from 'node:crypto';
import type pg from 'pg';

// Linking her Telegram from the app (spec 015): the app gives her a link to the bot with a code made
// for her (30 minutes, used once, only its fingerprint kept); she presses « Start »; the watcher
// reads what the bot received, finds whose code it is, and keeps her chat as her channel.

const API = 'https://api.telegram.org';
export const LINK_MINUTES = 30;

let botName: string | null = null;

/** The bot's name, asked once. */
async function nameOf(token: string): Promise<string> {
  if (botName) return botName;
  const response = await fetch(`${API}/bot${token}/getMe`);
  const body = (await response.json()) as { ok: boolean; result?: { username?: string } };
  if (!body.ok || !body.result?.username)
    throw new Error('Telegram did not answer: the bot is not set up.');
  botName = body.result.username;
  return botName;
}

/** A link that opens the bot with her code; the code's fingerprint waits in her « Channel ». */
export async function telegramLink(
  db: pg.Pool,
  actor: Actor,
  token: string | undefined,
): Promise<{ link: string; minutes: number }> {
  if (!token) throw new Error('Telegram is not set up on this server.');
  const name = await nameOf(token);
  const code = randomBytes(12).toString('base64url');
  await asPerson(db, actor.person, async (tx) => {
    const own = (await spacesOf(tx)).find((one) => one.personal);
    if (!own) throw new Error('No space of her own.');
    const [channel] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
    const data = {
      telegram_code: fingerprintOf(code),
      telegram_code_until: new Date(Date.now() + LINK_MINUTES * 60_000).toISOString(),
    };
    await save(tx, actor, own.id, {
      entries: [
        channel
          ? { id: channel.id, data, origin: 'inferred' }
          : { kind: 'Channel', title: 'Jarvis', data, origin: 'inferred' },
      ],
    });
  });
  return { link: `https://t.me/${name}?start=${code}`, minutes: LINK_MINUTES };
}

let offset = 0;

/** What the bot received: each « /start <code> » links that chat to whoever the code was made for. */
export async function readTelegramLinks(
  db: pg.Pool,
  token: string,
  linked: string,
): Promise<number> {
  const response = await fetch(
    `${API}/bot${token}/getUpdates?timeout=0&offset=${offset}&allowed_updates=%5B%22message%22%5D`,
  );
  if (!response.ok) return 0;
  const body = (await response.json()) as {
    ok: boolean;
    result?: { update_id: number; message?: { text?: string; chat?: { id: number } } }[];
  };
  let count = 0;
  for (const update of body.result ?? []) {
    offset = Math.max(offset, update.update_id + 1);
    const match = /^\/start\s+([A-Za-z0-9_-]{8,64})$/.exec(update.message?.text?.trim() ?? '');
    const chat = update.message?.chat?.id;
    if (!match || chat === undefined) continue;
    const { rows } = await db.query<{ person: string; space_id: string; entry_id: string }>(
      'select person, space_id, entry_id from jarvis_channel_by_code($1)',
      [fingerprintOf(match[1]!)],
    );
    const found = rows[0];
    if (!found) continue;
    await asPerson(db, found.person, (tx) =>
      save(tx, { person: found.person, door: 'watcher' }, found.space_id, {
        entries: [
          {
            id: found.entry_id,
            data: { telegram: String(chat), telegram_code: null, telegram_code_until: null },
            origin: 'inferred',
          },
        ],
      }),
    );
    await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: linked }),
    });
    count += 1;
  }
  return count;
}
