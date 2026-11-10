import type pg from 'pg';
import type { Actor, Tx } from './db';
import { find, get, save, type Entry } from './entries';
import { noteIntention } from './intentions';
import { modelOf } from './models';
import type { EntryInput } from './schemas';

// Raw capture and filing later (spec 035, plan v2 A8). Whatever arrives — a Telegram message, a
// sentence to Claude, a line typed in the app — is kept at once, as it is, with its exact time and
// « said », even without any AI. A pre-sort by rules only (hashtags, the words her apps declare,
// an amount, an account) says what it looks like; she or an assistant files it later, one by one,
// or « everything sure » at once.

export const CAPTURE_KIND = 'Capture';
export type CaptureSource = 'telegram' | 'claude' | 'app';

export interface Guess {
  tags: string[];
  /** The apps whose words it holds. */
  apps: string[];
  amount?: number;
  currency?: string;
  account?: string;
  /** One app, and what it needs: filed without asking. */
  sure: boolean;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CURRENCIES: Record<string, string> = {
  f: 'XOF',
  fcfa: 'XOF',
  cfa: 'XOF',
  xof: 'XOF',
  '€': 'EUR',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  $: 'USD',
  usd: 'USD',
};
const ACCOUNTS: Record<string, string> = {
  cash: 'cash',
  especes: 'cash',
  liquide: 'cash',
  banque: 'bank',
  carte: 'bank',
  flooz: 'mobile_money',
  tmoney: 'mobile_money',
  'orange money': 'mobile_money',
  'mobile money': 'mobile_money',
  wave: 'mobile_money',
};

/**
 * What a capture looks like, by rules only: its hashtags, the apps whose words it holds, an amount
 * with its currency, an account. `words` are the apps' intents (their roles, spec 033).
 */
export function presort(text: string, words: Record<string, string[]>): Guess {
  const folded = ` ${fold(text).replace(/[^\p{L}\p{N}€$#.,]+/gu, ' ')} `;
  const tags = [...text.matchAll(/#([\p{L}\p{N}_-]{2,40})/gu)].map((match) =>
    match[1]!.toLowerCase(),
  );
  const apps = Object.entries(words)
    .filter(([, intents]) =>
      intents.some((word) => folded.includes(` ${fold(word)} `) || tags.includes(fold(word))),
    )
    .map(([app]) => app);
  const guess: Guess = { tags, apps, sure: false };
  const money =
    /(\d[\d\s.]*(?:,\d+)?)\s*(fcfa|cfa|xof|f|€|eur|euros?|\$|usd)(?![\p{L}])/iu.exec(text) ??
    /(€|\$)\s*(\d[\d\s.]*(?:,\d+)?)/u.exec(text);
  if (money) {
    const [number, unit] = /^\d/.test(money[1]!) ? [money[1]!, money[2]!] : [money[2]!, money[1]!];
    const amount = Number(number.replace(/[\s.]/g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0) {
      guess.amount = amount;
      guess.currency = CURRENCIES[fold(unit)] ?? CURRENCIES[unit] ?? unit.toUpperCase();
    }
  }
  const account = Object.keys(ACCOUNTS).find((word) => folded.includes(` ${word} `));
  if (account && ACCOUNTS[account]) guess.account = ACCOUNTS[account];
  guess.sure = apps.length === 1 && guess.amount !== undefined;
  return guess;
}

/** A capture kept at once, as it is: its words, its source, its exact time, « said ». */
export async function capture(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  input: { text: string; source: CaptureSource; at?: string; words?: Record<string, string[]> },
): Promise<Entry> {
  const text = input.text.trim();
  if (!text) throw new Error('A capture needs words.');
  const guess = presort(text, input.words ?? {});
  const saved = await save(tx, actor, spaceId, {
    entries: [
      {
        kind: CAPTURE_KIND,
        title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
        data: {
          text,
          source: input.source,
          at: input.at ?? new Date().toISOString(),
          status: 'to_file',
          guess,
        },
        origin: 'said',
      },
    ],
  });
  const id = saved.entries[0]!.id;
  // « Je vais appeler Paul »: an intention too, or the same one said once more (spec 040).
  await noteIntention(tx, actor, spaceId, text, {
    at: input.at ?? new Date().toISOString(),
    from: id,
  });
  return (await get(tx, spaceId, id))!;
}

/** Her captures still to file, the oldest first. */
export async function inboxOf(tx: Tx, spaceId: string): Promise<Entry[]> {
  const all = await find(tx, spaceId, { kind: CAPTURE_KIND, limit: 200 });
  return all
    .filter((one) => one.data.status === 'to_file')
    .sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)));
}

/**
 * A capture filed: the entries it becomes (written by her or an assistant), linked to it, and the
 * capture marked filed. One save: journaled, undone at once.
 */
export async function fileCapture(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  id: string,
  entries: EntryInput[],
) {
  if (!entries.length) throw new Error('Give what the capture becomes.');
  const refs = entries.map((one, at) => ({ ...one, ref: one.ref ?? `filed${at}` }));
  return save(tx, actor, spaceId, {
    entries: [...refs, { id, data: { status: 'filed' } }],
    links: refs.map((one) => ({ from: one.ref!, to: id, role: 'from_capture' })),
  });
}

/**
 * Everything sure filed at once: a capture that one app claims, with an amount, becomes a movement
 * of money of that app (`Transaction`, out unless it says « reçu »), linked to its capture. When her
 * model asks for a link (its account), Jarvis links the one she named (by its type or its name), or
 * her only one; when it cannot tell, the capture stays to file, and says what it waits for.
 */
export async function fileSure(tx: Tx, actor: Actor, spaceId: string) {
  const filed: string[] = [];
  const waiting: { title: string; needs: string }[] = [];
  // Its model, when her space has one: what it does not know goes into the note.
  const model = await modelOf(tx, spaceId, 'Transaction');
  const known = model ? new Set(model.fields.map((field) => field.name)) : null;
  const required = (model?.fields ?? []).filter(
    (field) => field.type === 'link' && field.required && 'target' in field && field.target,
  ) as { name: string; target: string }[];
  const targets = new Map<string, Entry[]>();
  for (const field of required)
    targets.set(field.name, await find(tx, spaceId, { kind: field.target, limit: 100 }));
  const fold2 = (text: unknown) => fold(String(text ?? ''));
  const pickOne = (field: string, hint: string | undefined): Entry | null => {
    const all = targets.get(field) ?? [];
    if (all.length === 1) return all[0]!;
    if (!hint) return null;
    const words =
      hint === 'mobile_money'
        ? ['mobile', 'money', 'flooz', 'tmoney', 'wave', 'momo']
        : hint === 'cash'
          ? ['cash', 'especes', 'liquide', 'caisse']
          : ['banque', 'bank', 'carte', 'compte'];
    const found = all.filter(
      (one) =>
        fold2(one.data.type) === hint ||
        words.some(
          (word) => fold2(one.title).includes(word) || fold2(one.data.type).includes(word),
        ),
    );
    return found.length === 1 ? found[0]! : null;
  };
  const fit = (data: Record<string, unknown>) => {
    if (!known) return data;
    const kept: Record<string, unknown> = {};
    const rest: string[] = [];
    for (const [field, value] of Object.entries(data)) {
      if (known.has(field)) kept[field] = value;
      else rest.push(`${field}: ${String(value)}`);
    }
    if (rest.length && known.has('note')) kept.note = rest.join(' · ');
    return kept;
  };
  for (const one of await inboxOf(tx, spaceId)) {
    const guess = one.data.guess as Guess | undefined;
    if (!guess?.sure || guess.amount === undefined) continue;
    const links: { field: string; to: string }[] = [];
    const missing: string[] = [];
    for (const field of required) {
      const target = pickOne(field.name, field.name === 'account' ? guess.account : undefined);
      if (target) links.push({ field: field.name, to: target.id });
      else missing.push(field.name);
    }
    if (missing.length) {
      waiting.push({ title: one.title, needs: missing.join(', ') });
      continue;
    }
    const text = String(one.data.text ?? one.title);
    const received = /\b(re[cç]u|salaire|rembours[ée] par|gagn[ée])\b/i.test(text);
    const ref = 'move';
    await save(tx, actor, spaceId, {
      entries: [
        {
          ref,
          kind: 'Transaction',
          title:
            text
              .replace(/#[\p{L}\p{N}_-]+/gu, '')
              .trim()
              .slice(0, 120) || one.title,
          data: fit({
            amount: guess.amount,
            ...(guess.currency ? { currency: guess.currency } : {}),
            direction: received ? 'in' : 'out',
            date: String(one.data.at ?? '').slice(0, 10),
            ...(guess.account && !links.some((link) => link.field === 'account')
              ? { account_hint: guess.account }
              : {}),
          }),
          origin: 'inferred',
        },
        { id: one.id, data: { status: 'filed' } },
      ],
      links: [
        { from: ref, to: one.id, role: 'from_capture' },
        ...links.map((link) => ({ from: ref, to: link.to, role: link.field })),
      ],
    });
    filed.push(one.title);
  }
  return { filed, left: (await inboxOf(tx, spaceId)).length, waiting };
}

/** Who a Telegram chat belongs to: her own space, to capture what she writes to the bot. */
export async function personByChat(
  db: pg.Pool,
  chat: string,
): Promise<{ person: string; spaceId: string } | null> {
  const { rows } = await db.query<{ person: string; space_id: string }>(
    'select person, space_id from jarvis_person_by_chat($1)',
    [chat],
  );
  return rows[0] ? { person: rows[0].person, spaceId: rows[0].space_id } : null;
}
