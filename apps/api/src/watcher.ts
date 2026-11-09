import {
  asPerson,
  briefOnce,
  briefPeople,
  find,
  giveLease,
  pool,
  save,
  spacesOf,
  takeLease,
  watchOnce,
  runDueRules,
  useScriptRunner,
  type Brief,
  type Due,
  type PassReport,
} from '@jarvis-os/core';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { parseArgs } from 'node:util';
import type pg from 'pg';
import { backupOnce } from './backups';
import { readOnce } from './reading';
import {
  channelOf,
  deliverOutbox,
  deliveryFor,
  sendTelegram,
  tellThrough,
  type Delivery,
} from './channels';
import { wordsOf, type Lang } from './i18n';
import { quickjsRunner } from './scripts';
import { readTelegramLinks } from './telegram';
import { settingsFor, type Branch } from './settings';

/** Who this watcher is, for its lease (spec 021): the machine and this process. */
export const WATCHER_HOLDER = `${process.env.NETLIFY ? 'netlify' : hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;

/** How often the watcher looks: once a minute, the precision of a reminder. */
export const WATCH_EVERY_MS = 60_000;

// Her channels moved to `channels.ts` (spec 020); kept here for the doors that import them.
export { channelOf, sendTelegram } from './channels';

/** What she reads when a reminder is due. */
export function reminderText(due: Due): string {
  const words = wordsOf('fr');
  return (
    [`⏰ ${due.title}`, due.message ?? ''].filter(Boolean).join('\n\n') +
    (due.repeated ? '' : `\n\n${words.reminderDone}`)
  );
}

/** What she reads in the morning (spec 018): what to fix, what is late, today, her habits. */
export function briefText(brief: Brief, lang: Lang = 'fr'): string {
  const words = wordsOf(lang);
  const say = (text: string, values: Record<string, string>) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${brief.day}T12:00:00Z`));
  const hour = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: brief.zone,
    }).format(new Date(iso));
  const blocks = [say(words.briefHello, { day })];
  const list = (title: string, lines: string[]) => {
    if (lines.length) blocks.push([title, ...lines.map((line) => `• ${line}`)].join('\n'));
  };
  list(
    words.briefFix,
    brief.fix.map((one) => one.title),
  );
  list(
    words.briefLate,
    brief.late.slice(0, 8).map((one) => one.title),
  );
  list(
    words.briefAgenda,
    brief.agenda
      .slice(0, 12)
      .map((one) => `${one.allDay ? words.briefAllDay : hour(one.start)} — ${one.title}`),
  );
  list(
    words.briefHabits,
    brief.habits
      .slice(0, 10)
      .map(
        (one) =>
          `${one.today === 'done' ? '✓' : '○'} ${one.title} (${one.today === 'done' ? words.briefHabitDone : words.briefHabitTodo}${
            one.rate30 === null
              ? ''
              : ` · ${say(words.briefRate, { rate: new Intl.NumberFormat(locale).format(one.rate30) })}`
          })`,
      ),
  );
  if (blocks.length === 1) blocks.push(words.briefQuiet);
  blocks.push(words.briefEnd);
  return blocks.join('\n\n');
}

/**
 * Tells a person a reminder (spec 020): it enters the outbox on each of her channels, once per
 * occurrence; false when she has no channel.
 */
export function tellerFor(db: pg.Pool, delivery: Delivery) {
  return (due: Due) =>
    tellThrough(db, delivery, {
      person: due.person,
      spaceId: due.spaceId,
      kind: 'reminder',
      subject: due.title,
      body: due.message ?? (due.repeated ? '' : wordsOf('fr').reminderDone),
      entryId: due.entryId,
      key: `reminder:${due.entryId}:${due.at.toISOString()}`,
    });
}

/**
 * One pass of the watcher (specs 010, 020): the Telegram links, the reminders due and the morning
 * briefs entered in the outbox, the outbox delivered, the rules on a schedule. The local loop runs
 * it each minute; on Netlify, a scheduled function runs it each minute too. Its failures are
 * logged, never thrown. It runs only while it holds the database's lease (spec 021).
 */
export async function watcherPass(
  db: pg.Pool,
  delivery: Delivery,
  now: Date = new Date(),
  holder: string = WATCHER_HOLDER,
): Promise<PassReport | null> {
  useScriptRunner(quickjsRunner);
  // One watcher at a time on a database (spec 021): another holding the lease, this pass is skipped.
  try {
    if (!(await takeLease(db, 'watcher', holder))) {
      console.info('[watcher] another watcher holds the lease: pass skipped');
      return null;
    }
  } catch (error) {
    console.error('[watcher] lease', (error as Error).message);
    return null;
  }
  let report: PassReport | null = null;
  let failure: string | undefined;
  // What the pass did, kept with the lease (spec 023): `/health` reads its failures.
  const done: Record<string, unknown> = {};
  try {
    // Who pressed « Start » with her code (spec 015), before telling anyone.
    if (delivery.telegramToken) {
      await readTelegramLinks(db, delivery.telegramToken, wordsOf('fr').channelLinked).catch(
        (error) => console.warn('[watcher] telegram', (error as Error).message),
      );
    }
    report = await watchOnce(db, now, tellerFor(db, delivery));
    done.reminders = report;
    // Her morning brief (spec 018), at the hour she chose, once a day.
    for (const person of await briefPeople(db)) {
      await briefOnce(db, person, now, async (brief) => {
        const own = (await channelOf(db, person)).spaceId;
        if (!own) return false;
        const [subject, ...rest] = briefText(brief).split('\n\n');
        return tellThrough(db, delivery, {
          person,
          spaceId: own,
          kind: 'brief',
          subject: subject ?? '',
          body: rest.join('\n\n'),
          key: `brief:${brief.day}`,
        });
      }).catch((error) => console.warn('[watcher] brief', (error as Error).message));
    }
    // What entered the outbox (now or before, waiting for another try), delivered (spec 020).
    const delivered = await deliverOutbox(db, now, delivery);
    done.outbox = delivered;
    if (delivered.failed) console.warn('[watcher] outbox', delivered);
    // Each space's backup of the day (spec 022), a few each pass.
    if (delivery.blobs) {
      const backups = await backupOnce(db, delivery.blobs, now);
      done.backups = backups;
      if (backups.failed) console.warn('[watcher] backups', backups);
    }
    // Her files read (spec 026): PDF, Word, photos, a few each pass.
    if (delivery.blobs) {
      const reading = await readOnce(db, delivery.blobs);
      done.reading = reading;
      if (reading.failed) console.warn('[watcher] reading', reading);
    }
    // Her scheduled rules and « before » rules (spec 014), on the same clock.
    const rules = await runDueRules(db, now);
    done.rules = rules;
    if (rules.failed) console.warn('[watcher] rules', rules);
    return report;
  } catch (error) {
    failure = (error as Error).message;
    console.error('[watcher]', failure);
    return null;
  } finally {
    await giveLease(
      db,
      'watcher',
      holder,
      failure ? { error: failure, report: done } : { report: done },
    ).catch((error) => console.warn('[watcher] lease', (error as Error).message));
  }
}

/** The watcher's loop: a pass each minute, never two at once; it stops when `signal` aborts. */
export function watch(
  db: pg.Pool,
  delivery: Delivery,
  onPass: (report: PassReport) => void = () => undefined,
  signal?: AbortSignal,
) {
  let running = false;
  const pass = async () => {
    if (running || signal?.aborted) return;
    running = true;
    try {
      const report = await watcherPass(db, delivery);
      if (report) onPass(report);
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
      const [canal] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
      await save(tx, { person, door: 'cli' }, own.id, {
        entries: [
          canal
            ? { id: canal.id, data: { telegram: chat } }
            : { kind: 'Channel', title: 'Telegram', data: { telegram: chat } },
        ],
      });
    });
    const sent = token && (await sendTelegram(token, chat, wordsOf('fr').channelLinked));
    console.info(sent ? 'linked, and a message sent' : 'linked; no message sent');
    await db.end();
  } else {
    console.info(`[watcher] ${branch}: a pass every ${WATCH_EVERY_MS / 1000} s`);
    watch(db, deliveryFor(settingsFor(branch, process.env.JARVIS_PUBLIC_URL)), (report) => {
      if (report.sent || report.scheduled || report.skipped || report.failed) {
        console.info('[watcher]', report);
      }
    });
  }
}
