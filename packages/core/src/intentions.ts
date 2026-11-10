import type { Actor, Tx } from './db';
import { find, save, type Entry } from './entries';

// Intentions and what follows them (spec 040, plan v2 C11). Each « je vais… », « il faut que… »,
// « demain je… » she says becomes an « Intention » (open, done, dropped), kept with every time she
// said it. Said again, it is the same one, once more. It closes by itself when an entry that does
// it is saved (« Appel avec Paul » for « appeler Paul »), linked to it; else it comes back to her
// (« said 4 times since 20 Oct., nothing followed: plan it, hand it over, or drop it? »). Rules
// only, no AI.

export const INTENTION_KIND = 'Intention';
export type IntentionStatus = 'open' | 'done' | 'dropped';

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'");

// What opens an intention, her words before what she means to do.
const OPENERS = [
  /\b(?:demain|ce soir|ce matin|cet apres-midi|tout a l'heure|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|la semaine prochaine)\s*,?\s*je (?:vais |dois |)(?=\p{L})/u,
  /\bje vais\s+/,
  /\bil (?:faut|faudrait) (?:absolument |vraiment )?que j(?:e |')/,
  /\bil (?:faut|faudrait) (?:absolument |vraiment )?(?=\p{L}+er\b)/u,
  /\b(?:faut|faudrait) que j(?:e |')/,
  /\bje dois\s+/,
  /\bje compte\s+/,
  /\bje (?:veux|voudrais|aimerais)\s+(?=\p{L}+(?:er|ir|re)\b)/u,
  /\b(?:ne pas|n'oublie pas d[e'])\s*(?:oublier d[e'])?\s*/,
  /\bpenser a\s+/,
  /\b(?:tomorrow|tonight|this evening|next week) i(?:'ll| will| need to| have to| must)?\s+/,
  /\bi(?:'m going to| am going to|'ll| will| need to| have to| must| should)\s+/,
  /\bremember to\s+/,
];

const STOP = new Set(
  (
    'le la les l de du des d un une au aux a et en pour avec chez mon ma mes ton ta tes son sa ses ' +
    "notre nos leur leurs ce cet cette ces demain aujourd'hui soir matin ce ca cela que qui " +
    'the a an to of my your his her our their with for at on in tomorrow today tonight it this that ' +
    'bien enfin vraiment absolument encore aussi peut-etre'
  ).split(/\s+/),
);

/** The words that make an intention what it is: no small words, each by its first letters. */
export function stemsOf(text: string): string[] {
  return [
    ...new Set(
      fold(text)
        .split(/[^\p{L}\p{N}']+/u)
        .map((word) => word.replace(/^[a-z]'/, ''))
        .filter((word) => word.length >= 3 && !STOP.has(word))
        .map((word) => word.slice(0, 5)),
    ),
  ];
}

/** What she means to do, when her words say she means to: « appeler Paul ». */
export function intentionIn(text: string): string | null {
  const said = fold(text);
  for (const opener of OPENERS) {
    const match = opener.exec(said);
    if (!match) continue;
    const start = match.index + match[0].length;
    // Up to the end of the sentence, in her own letters.
    const rest = text
      .slice(start)
      .split(/[.!?;\n]|,\s*(?:et|mais|puis|then|but)\b/i)[0]!
      .trim();
    const action = rest.replace(/\s+/g, ' ').slice(0, 140);
    if (stemsOf(action).length) return action;
  }
  return null;
}

const same = (a: string[], b: string[]) => {
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  const shared = small.filter((one) => large.includes(one)).length;
  return small.length > 0 && shared === small.length && shared / large.length >= 0.5;
};

/** Her open intentions in a space. */
export async function openIntentions(tx: Tx, spaceId: string): Promise<Entry[]> {
  return (await find(tx, spaceId, { kind: INTENTION_KIND, limit: 200 })).filter(
    (one) => (one.data.status ?? 'open') === 'open',
  );
}

/**
 * What she said, kept as an intention when it is one: a new one, or the same said once more
 * (linked to the capture it came from). Null when her words hold none.
 */
export async function noteIntention(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  text: string,
  options: { at?: string; from?: string } = {},
): Promise<{ id: string; times: number } | null> {
  const action = intentionIn(text);
  if (!action) return null;
  const stems = stemsOf(action);
  const at = options.at ?? new Date().toISOString();
  const by = { ...actor, client: 'intentions', depth: (actor.depth ?? 0) + 1 };
  const known = (await openIntentions(tx, spaceId)).find((one) =>
    same(stemsOf(String(one.data.text ?? one.title)), stems),
  );
  const links = (id: string) =>
    options.from ? [{ from: id, to: options.from, role: 'from_capture' }] : [];
  if (known) {
    const said = [...(Array.isArray(known.data.said) ? known.data.said : []), at];
    await save(tx, by, spaceId, {
      entries: [{ id: known.id, data: { said } }],
      links: links(known.id),
    });
    return { id: known.id, times: said.length };
  }
  const title = action.charAt(0).toUpperCase() + action.slice(1);
  const saved = await save(tx, by, spaceId, {
    entries: [
      {
        ref: 'i',
        kind: INTENTION_KIND,
        title,
        data: { text: action, status: 'open', said: [at] },
        origin: 'said',
      },
    ],
    links: links('i'),
  });
  return { id: saved.entries[0]!.id, times: 1 };
}

// Kinds that never do an intention: Jarvis's own, and what she says rather than does.
const NOT_DOING = new Set([
  'intention',
  'capture',
  'reminder',
  'comment',
  'model',
  'rule',
  'script',
  'page',
  'view',
  'app',
  'channel',
  'share',
]);

/**
 * After a save: the open intentions an entry she made does — every word of the intention in its
 * title or kind — become done, linked to it (`done_by`). Returns their titles.
 */
export async function closeIntentions(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  made: { id: string; kind: string; title: string }[],
): Promise<string[]> {
  const doing = made.filter((one) => !NOT_DOING.has(fold(one.kind)));
  if (!doing.length) return [];
  const open = await openIntentions(tx, spaceId);
  if (!open.length) return [];
  const closed: string[] = [];
  const by = { ...actor, client: 'intentions', depth: (actor.depth ?? 0) + 1 };
  for (const intention of open) {
    const wanted = stemsOf(String(intention.data.text ?? intention.title));
    const doer = doing.find((one) => {
      const has = stemsOf(`${one.kind} ${one.title}`);
      return wanted.length > 0 && wanted.every((stem) => has.includes(stem));
    });
    if (!doer) continue;
    await save(tx, by, spaceId, {
      entries: [{ id: intention.id, data: { status: 'done', done_on: new Date().toISOString() } }],
      links: [{ from: intention.id, to: doer.id, role: 'done_by' }],
    });
    closed.push(intention.title);
  }
  return closed;
}

/** What she said and nothing followed: said twice or more, or three days ago and still open. */
export function lingering(intention: Entry, now: Date): { times: number; since: string } | null {
  const said = (Array.isArray(intention.data.said) ? intention.data.said : [])
    .filter((one): one is string => typeof one === 'string')
    .sort();
  if ((intention.data.status ?? 'open') !== 'open' || !said.length) return null;
  const since = said[0]!;
  const old = now.getTime() - new Date(since).getTime() >= 3 * 86_400_000;
  return said.length >= 2 || old ? { times: said.length, since } : null;
}
