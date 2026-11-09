import {
  asPerson,
  get,
  markActed,
  messageOf,
  messagePerson,
  save,
  type Actor,
} from '@jarvis-os/core';
import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { langOf, wordsOf, type Lang } from './i18n';
import { actionPage, donePage, messagePage } from './pages';

// Actions from an e-mail (spec 020): « Done », « In one hour », « Tomorrow », « Not for me ».
// A link carries the message and the action, signed with the branch's secret, valid seven days,
// used once. Opening it shows a page; only its button (a POST) acts, as her, door « email ».

export const ACTIONS = ['done', 'hour', 'tomorrow', 'not_for_me'] as const;
export type Action = (typeof ACTIONS)[number];
const VALID_MS = 7 * 86_400_000;

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(`act:${payload}`).digest('base64url');

/** A link's token: the message, the action, the end of its validity, signed. */
export function actionToken(secret: string, message: number, action: Action, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ o: message, a: action, x: now + VALID_MS }),
  ).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

/** The message and action a token names, or null when it is forged or expired. */
export function readActionToken(
  secret: string,
  token: string,
  now = Date.now(),
): { message: number; action: Action } | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      o: number;
      a: Action;
      x: number;
    };
    if (!ACTIONS.includes(value.a) || typeof value.o !== 'number' || value.x < now) return null;
    return { message: value.o, action: value.a };
  } catch {
    return null;
  }
}

export const actionWord = (lang: Lang, action: Action) => {
  const words = wordsOf(lang);
  return {
    done: words.actDone,
    hour: words.actHour,
    tomorrow: words.actTomorrow,
    not_for_me: words.actNotForMe,
  }[action];
};

/** What the action changes on the reminder: one occurrence only, never the repetition. */
function changeFor(action: Action, repeated: boolean, now: Date): Record<string, unknown> | null {
  const later = (ms: number) => new Date(now.getTime() + ms).toISOString().slice(0, 16) + 'Z';
  if (action === 'done') return repeated ? { last_done: now.toISOString() } : { status: 'done' };
  if (action === 'not_for_me') return repeated ? null : { status: 'cancelled' };
  const when = later(action === 'hour' ? 3_600_000 : 86_400_000);
  return repeated ? { next: when } : { at: when, status: 'planned' };
}

export function actRoutes(deps: { db: pg.Pool; secret: string }) {
  const act = new Hono();
  const read = async (token: string) => {
    const named = readActionToken(deps.secret, token);
    if (!named) return null;
    const person = await messagePerson(deps.db, named.message);
    if (!person) return null;
    const message = await asPerson(deps.db, person, (tx) => messageOf(tx, named.message));
    return message ? { ...named, person, message } : null;
  };

  act.get('/:token', async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    const found = await read(c.req.param('token'));
    if (!found) return c.html(messagePage(lang, wordsOf(lang).actInvalid), 410);
    if (found.message.action) return c.html(donePage(lang, wordsOf(lang).actUsed));
    const say = wordsOf(lang)
      .actAsk.replace('{action}', actionWord(lang, found.action))
      .replace('{title}', found.message.subject);
    return c.html(actionPage(lang, say, wordsOf(lang).actConfirm));
  });

  act.post('/:token', async (c) => {
    const lang = langOf(c.req.header('accept-language'));
    const found = await read(c.req.param('token'));
    if (!found) return c.html(messagePage(lang, wordsOf(lang).actInvalid), 410);
    const now = new Date();
    const actor: Actor = { person: found.person, door: 'email' };
    const first = await asPerson(deps.db, found.person, async (tx) => {
      if (!(await markActed(tx, found.message.id, found.action, now))) return false;
      const entryId = found.message.entryId;
      const entry = entryId ? await get(tx, found.message.spaceId, entryId) : null;
      if (entry) {
        const change = changeFor(found.action, typeof entry.data.repeat === 'string', now);
        if (change) {
          await save(tx, actor, found.message.spaceId, {
            entries: [{ id: entry.id, data: change, origin: 'said' }],
          });
        }
      }
      return true;
    });
    if (!first) return c.html(donePage(lang, wordsOf(lang).actUsed));
    const say = wordsOf(lang)
      .actTaken.replace('{action}', actionWord(lang, found.action))
      .replace('{title}', found.message.subject);
    return c.html(donePage(lang, say));
  });
  return act;
}
