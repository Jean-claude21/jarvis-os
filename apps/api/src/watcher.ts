import {
  asPerson,
  find,
  pool,
  save,
  spacesOf,
  watchOnce,
  type Due,
  type PassReport,
} from '@jarvis-os/core';
import { parseArgs } from 'node:util';
import type pg from 'pg';
import { wordsOf } from './i18n';
import { settingsFor, type Branch } from './settings';

/** How often the watcher looks: once a minute, the precision of a reminder. */
export const WATCH_EVERY_MS = 60_000;

/** Where she is told: an entry « Canal » of her own space, `telegram` the chat of her bot. */
export async function channelOf(db: pg.Pool, person: string): Promise<{ telegram?: string }> {
  return asPerson(db, person, async (tx) => {
    const own = (await spacesOf(tx)).find((one) => one.personal);
    if (!own) return {};
    const [canal] = await find(tx, own.id, { kind: 'Canal', limit: 1 });
    const telegram = canal?.data.telegram;
    return typeof telegram === 'string' || typeof telegram === 'number'
      ? { telegram: String(telegram) }
      : {};
  });
}

/** A message through the Telegram bot; true when Telegram took it. */
export async function sendTelegram(token: string, chat: string, text: string): Promise<boolean> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!response.ok) console.warn(`[watcher] Telegram answered ${response.status}`);
  return response.ok;
}

/** What she reads when a reminder is due. */
export function reminderText(due: Due): string {
  const words = wordsOf('fr');
  return (
    [`⏰ ${due.title}`, due.message ?? ''].filter(Boolean).join('\n\n') +
    (due.repeated ? '' : `\n\n${words.reminderDone}`)
  );
}

/** Tells a person through her channel; false when she has none. */
export function tellerFor(db: pg.Pool, telegramToken: string | undefined) {
  return async (due: Due) => {
    const channel = await channelOf(db, due.person);
    if (!channel.telegram || !telegramToken) return false;
    return sendTelegram(telegramToken, channel.telegram, reminderText(due));
  };
}

/** The watcher's loop: a pass each minute, never two at once; it stops when `signal` aborts. */
export function watch(
  db: pg.Pool,
  telegramToken: string | undefined,
  onPass: (report: PassReport) => void = () => undefined,
  signal?: AbortSignal,
) {
  const tell = tellerFor(db, telegramToken);
  let running = false;
  const pass = async () => {
    if (running || signal?.aborted) return;
    running = true;
    try {
      onPass(await watchOnce(db, new Date(), tell));
    } catch (error) {
      console.error('[watcher]', (error as Error).message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(pass, WATCH_EVERY_MS);
  signal?.addEventListener('abort', () => clearInterval(timer));
  void pass();
}

// `pnpm --filter @jarvis-os/api watcher` — the watcher alone, on the dev branch (or JARVIS_BRANCH).
// `… watcher link --email <address>` — her Telegram chat (JARVIS_TELEGRAM_CHAT_ID) as her channel.
if (process.argv[1]?.endsWith('watcher.ts')) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { email: { type: 'string' } },
  });
  const branch = (process.env.JARVIS_BRANCH ?? 'dev') as Branch;
  const db = pool(settingsFor(branch).appUrl);
  const token = process.env.JARVIS_TELEGRAM_BOT_TOKEN;
  if (positionals[0] === 'link') {
    const chat = process.env.JARVIS_TELEGRAM_CHAT_ID;
    const { rows } = await db.query<{ id: string }>('select id from "user" where email = $1', [
      values.email,
    ]);
    const person = rows[0]?.id;
    if (!person || !chat) {
      console.error('watcher link --email <address>, with JARVIS_TELEGRAM_CHAT_ID set.');
      process.exit(2);
    }
    await asPerson(db, person, async (tx) => {
      const own = (await spacesOf(tx)).find((one) => one.personal)!;
      const [canal] = await find(tx, own.id, { kind: 'Canal', limit: 1 });
      await save(tx, { person, door: 'cli' }, own.id, {
        entries: [
          canal
            ? { id: canal.id, data: { telegram: chat } }
            : { kind: 'Canal', title: 'Telegram', data: { telegram: chat } },
        ],
      });
    });
    const sent = token && (await sendTelegram(token, chat, wordsOf('fr').channelLinked));
    console.info(sent ? 'linked, and a message sent' : 'linked; no message sent');
    await db.end();
  } else {
    console.info(`[watcher] ${branch}: a pass every ${WATCH_EVERY_MS / 1000} s`);
    watch(db, token, (report) => {
      if (report.sent || report.scheduled || report.skipped || report.failed) {
        console.info('[watcher]', report);
      }
    });
  }
}
