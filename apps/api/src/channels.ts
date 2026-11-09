import {
  asPerson,
  enterMessage,
  find,
  get,
  markFailed,
  markSent,
  messageOf,
  pendingMessages,
  save,
  personEmail,
  spacesOf,
  type Blobs,
  type Message,
} from '@jarvis-os/core';
import nodemailer from 'nodemailer';
import type pg from 'pg';
import { ACTIONS, actionToken, actionWord } from './act';
import { wordsOf, type Lang } from './i18n';
import type { Settings } from './settings';
import { objectStorage } from './storage';

// Her channels (spec 020): every message enters the outbox, then is delivered here — Telegram by its
// bot, e-mail by any SMTP server — and its delivery written back (sent, or tried again later).

export type Channel = 'telegram' | 'email';
export type Kind = 'reminder' | 'brief';

/** Sends an e-mail; throws with the server's reason when it refuses. */
export interface Mailer {
  send(mail: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

/** What delivering needs: the bot, the mailer, and what signs her action links. */
export interface Delivery {
  telegramToken?: string;
  mailer: Mailer | null;
  publicUrl: string;
  secret: string;
  lang?: Lang;
  /** Where the nightly backups go (spec 022); none, no backup. */
  blobs?: Blobs;
}

/** E-mail through SMTP (`JARVIS_SMTP_URL`, `JARVIS_EMAIL_FROM`); null when it is not configured. */
export function smtpMailer(url: string | undefined, from: string | undefined): Mailer | null {
  if (!url || !from) return null;
  const transport = nodemailer.createTransport(url);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}

/** The delivery of a server: its environment and its branch's settings. */
export function deliveryFor(settings: Settings, mailer?: Mailer | null): Delivery {
  const telegramToken = process.env.JARVIS_TELEGRAM_BOT_TOKEN;
  return {
    ...(telegramToken ? { telegramToken } : {}),
    mailer:
      mailer === undefined
        ? smtpMailer(process.env.JARVIS_SMTP_URL, process.env.JARVIS_EMAIL_FROM)
        : mailer,
    publicUrl: settings.publicUrl,
    secret: settings.authSecret,
    blobs: objectStorage(settings.storage),
  };
}

/** Where she is told: an entry « Channel » of her own space, `telegram` the chat of her bot. */
export async function channelOf(
  db: pg.Pool,
  person: string,
): Promise<{ telegram?: string; spaceId?: string; choices?: Partial<Record<Kind, Channel[]>> }> {
  return asPerson(db, person, async (tx) => {
    const own = (await spacesOf(tx)).find((one) => one.personal);
    if (!own) return {};
    const [canal] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
    const telegram = canal?.data.telegram;
    const preferences = canal?.data.preferences as { channels?: unknown } | undefined;
    const choices =
      preferences && typeof preferences.channels === 'object' && preferences.channels
        ? (preferences.channels as Partial<Record<Kind, Channel[]>>)
        : undefined;
    return {
      spaceId: own.id,
      ...(typeof telegram === 'string' || typeof telegram === 'number'
        ? { telegram: String(telegram) }
        : {}),
      ...(choices ? { choices } : {}),
    };
  });
}

/**
 * The channels a kind of message goes to: her choice in her « Channel » (`preferences.channels`),
 * among those that work; without a choice, Telegram when linked, else e-mail.
 */
export async function channelsFor(
  db: pg.Pool,
  person: string,
  kind: Kind,
  delivery: Delivery,
): Promise<Channel[]> {
  const channel = await channelOf(db, person);
  const working: Channel[] = [];
  if (channel.telegram && delivery.telegramToken) working.push('telegram');
  if (delivery.mailer && (await personEmail(db, person))) working.push('email');
  const chosen = channel.choices?.[kind];
  if (Array.isArray(chosen) && chosen.length) return working.filter((one) => chosen.includes(one));
  return working.slice(0, 1);
}

/** Enters a message for a person on each of her channels for its kind; false when she has none. */
export async function tellThrough(
  db: pg.Pool,
  delivery: Delivery,
  message: {
    person: string;
    spaceId: string;
    kind: Kind;
    subject: string;
    body: string;
    entryId?: string | null;
    key: string;
  },
): Promise<boolean> {
  const channels = await channelsFor(db, message.person, message.kind, delivery);
  for (const channel of channels) {
    await asPerson(db, message.person, (tx) =>
      enterMessage(tx, {
        person: message.person,
        spaceId: message.spaceId,
        channel,
        kind: message.kind,
        subject: message.subject,
        body: message.body,
        entryId: message.entryId ?? null,
        dedupe: `${message.key}:${message.person}:${channel}`,
      }),
    );
  }
  return channels.length > 0;
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

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The e-mail of a message: its words, and for a reminder the four actions as links. */
export function emailOf(message: Message, delivery: Delivery) {
  const lang = delivery.lang ?? 'fr';
  const words = wordsOf(lang);
  const links =
    message.kind === 'reminder' && message.entryId
      ? ACTIONS.map((action) => ({
          label: actionWord(lang, action),
          url: `${delivery.publicUrl}/act/${actionToken(delivery.secret, message.id, action)}`,
        }))
      : [];
  const text = [
    message.kind === 'reminder' ? words.emailReminderLead : '',
    message.subject,
    message.body,
    links.map((link) => `${link.label} : ${link.url}`).join('\n'),
    words.emailFooter,
  ]
    .filter(Boolean)
    .join('\n\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#2a1610;max-width:560px">
${message.kind === 'reminder' ? `<p style="color:#6b4e43;margin:0 0 6px">${escape(words.emailReminderLead)}</p>` : ''}
<h2 style="margin:0 0 12px;font-size:20px">${escape(message.subject)}</h2>
<p style="white-space:pre-line;margin:0 0 18px">${escape(message.body)}</p>
${links.map((link) => `<a href="${escape(link.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:1px solid #c9b3a4;border-radius:6px;color:#2a1610;text-decoration:none">${escape(link.label)}</a>`).join('')}
<p style="color:#9a8276;font-size:12px;margin-top:22px">${escape(words.emailFooter)}</p></div>`;
  return { subject: message.subject, text, html };
}

/** Delivers what is due in the outbox, as each person; how many sent and how many failed. */
export async function deliverOutbox(
  db: pg.Pool,
  now: Date,
  delivery: Delivery,
): Promise<{ sent: number; failed: number }> {
  const report = { sent: 0, failed: 0 };
  for (const pending of await pendingMessages(db, now)) {
    const message = await asPerson(db, pending.person, (tx) => messageOf(tx, pending.id));
    if (!message) continue;
    let error: string | null = null;
    try {
      if (message.channel === 'telegram') {
        const chat = (await channelOf(db, message.personId)).telegram;
        if (!chat || !delivery.telegramToken) error = 'no Telegram channel';
        else if (
          !(await sendTelegram(
            delivery.telegramToken,
            chat,
            [message.kind === 'reminder' ? `⏰ ${message.subject}` : message.subject, message.body]
              .filter(Boolean)
              .join('\n\n'),
          ))
        )
          error = 'Telegram refused the message';
      } else if (message.channel === 'email') {
        const to = await personEmail(db, message.personId);
        if (!to || !delivery.mailer) error = 'no e-mail channel';
        else await delivery.mailer.send({ to, ...emailOf(message, delivery) });
      } else {
        error = `unknown channel « ${message.channel} »`;
      }
    } catch (failure) {
      error = (failure as Error).message;
    }
    const reason = error;
    await asPerson(db, message.personId, async (tx) => {
      if (!reason) return markSent(tx, message.id, now);
      // A reminder that failed for good is « to fix » with its reason (spec 023): she sees it in
      // « Maintenant », and « Retry » asks for it again.
      if (!(await markFailed(tx, message.id, reason, now))) return;
      if (message.kind !== 'reminder' || !message.entryId) return;
      if (!(await get(tx, message.spaceId, message.entryId))) return;
      await save(tx, { person: message.personId, door: 'watcher' }, message.spaceId, {
        entries: [
          {
            id: message.entryId,
            data: {
              status: 'failed',
              error: wordsOf(delivery.lang ?? 'fr')
                .notSent.replace('{channel}', message.channel)
                .replace('{reason}', reason),
            },
          },
        ],
      });
    });
    if (error) report.failed += 1;
    else report.sent += 1;
  }
  return report;
}
