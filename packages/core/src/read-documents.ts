import type { Actor, Tx } from './db';
import { find, get, save } from './entries';
import { modelsOf } from './models';
import { propose } from './proposals';
import type { EntryInput } from './schemas';

// Documents that live (v3 V7): a file she drops is read (spec 026), then understood — what it is
// (its genre), what it says (an amount, its day, a due day, who sent it, a warranty) — each fact
// with the words it was read from. From an invoice Jarvis proposes, in « À valider », what it
// makes in her life: the bill (or the expense), the supplier recognised among hers, the warranty.
// Rules only, no AI: an assistant reads better through the same door, this is the floor.

export interface Fact {
  value: string | number;
  /** The words it was read from, so she can check it. */
  quote: string;
}

export interface DocumentFacts {
  genre: string | null;
  amount?: Fact;
  date?: Fact;
  due?: Fact;
  supplier?: Fact & { domain?: string };
  /** The warranty's length, in months. */
  warranty?: Fact;
  paid?: Fact;
}

/** The genres a document can have, and the words that say it — the first that matches wins. */
export const GENRES: { genre: string; label: string; words: RegExp }[] = [
  { genre: 'payslip', label: 'bulletin de paie', words: /bulletin de (paie|salaire)|salaire net/i },
  { genre: 'quote', label: 'devis', words: /\bdevis\b|proposition commerciale/i },
  {
    genre: 'invoice',
    label: 'facture',
    words: /\bfacture\b|\binvoice\b|ticket de caisse|\breçu\b/i,
  },
  {
    genre: 'notice',
    label: 'avis d’échéance',
    words: /avis d['’]échéance|échéancier|à payer avant/i,
  },
  {
    genre: 'contract',
    label: 'contrat',
    words: /\bcontrat\b|conditions (générales|particulières)/i,
  },
  { genre: 'prescription', label: 'ordonnance', words: /\bordonnance\b|posologie/i },
  { genre: 'statement', label: 'relevé', words: /relevé de (compte|situation)|\biban\b.*solde/i },
  { genre: 'certificate', label: 'attestation', words: /\battestation\b|\bcertificat\b/i },
  { genre: 'ticket', label: 'billet', words: /\bbillet\b|carte d['’]embarquement|e-ticket/i },
];

export const genreLabel = (genre: string) =>
  GENRES.find((one) => one.genre === genre)?.label ?? genre;

const MONTHS: Record<string, number> = {
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');

/** Every day written in a line, as « YYYY-MM-DD ». */
function daysIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
      out.push(`${year}-${pad(month)}-${pad(day)}`);
  }
  for (const m of line.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))
    out.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of line.matchAll(/\b(\d{1,2}) (\p{L}+) (\d{4})\b/gu)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (month) out.push(`${m[3]}-${pad(month)}-${pad(Number(m[1]))}`);
  }
  return out;
}

/** Amounts written in a line (« 1 249,90 € », « EUR 12.50 »), as numbers. */
function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(
    /(?:€|eur)\s*(\d{1,3}(?:[  .]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)|(\d{1,3}(?:[  .]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?)\s*(?:€|eur\b|euros?)/gi,
  )) {
    const raw = (m[1] ?? m[2])!.replace(/[  ]/g, '');
    const number = Number(
      /,\d{2}$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''),
    );
    if (Number.isFinite(number) && number > 0) out.push(number);
  }
  return out;
}

const PERSONAL_MAIL =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|orange|free|sfr|laposte|wanadoo|proton|protonmail)\./i;
const quoteOf = (line: string) => line.trim().replace(/\s+/g, ' ').slice(0, 160);

/** What a document's words say, each fact with the line it was read from. */
export function readFacts(text: string): DocumentFacts {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const head = lines.slice(0, 40).join('\n');
  const facts: DocumentFacts = {
    genre:
      GENRES.find((one) => one.words.test(head) || one.words.test(text.slice(0, 4000)))?.genre ??
      null,
  };
  // The amount: on the line of the total, else the largest written.
  const totalLine = [...lines]
    .reverse()
    .find(
      (line) =>
        /net à payer|total\s*t\.?t\.?c|montant\s*t\.?t\.?c|total à payer|\btotal\b|montant/i.test(
          line,
        ) && amountsIn(line).length,
    );
  if (totalLine)
    facts.amount = { value: Math.max(...amountsIn(totalLine)), quote: quoteOf(totalLine) };
  else {
    let best: { value: number; line: string } | null = null;
    for (const line of lines)
      for (const value of amountsIn(line)) if (!best || value > best.value) best = { value, line };
    if (best) facts.amount = { value: best.value, quote: quoteOf(best.line) };
  }
  // The due day, then the document's own day.
  const dueLine = lines.find(
    (line) =>
      /échéance|à payer avant|date limite|payable (avant|le)|due date/i.test(line) &&
      daysIn(line).length,
  );
  if (dueLine) facts.due = { value: daysIn(dueLine)[0]!, quote: quoteOf(dueLine) };
  const dateLine =
    lines.find(
      (line) =>
        /\bdate\b|\bdu\b|\bémis|\ble \d/i.test(line) && daysIn(line).length && line !== dueLine,
    ) ?? lines.find((line) => daysIn(line).length && line !== dueLine);
  if (dateLine) facts.date = { value: daysIn(dateLine)[0]!, quote: quoteOf(dateLine) };
  // A warranty: « garantie 2 ans », « garantie de 24 mois ».
  const warrantyLine = lines.find((line) => /garantie[^.\n]{0,20}?\d+\s*(ans?|mois)/i.test(line));
  if (warrantyLine) {
    const m = /(\d+)\s*(ans?|mois)/i.exec(warrantyLine.slice(warrantyLine.search(/garantie/i)))!;
    const months = Number(m[1]) * (/^an/i.test(m[2]!) ? 12 : 1);
    if (months > 0 && months <= 240)
      facts.warranty = { value: months, quote: quoteOf(warrantyLine) };
  }
  const paidLine = lines.find((line) => /\b(payée|acquittée|réglée|paid)\b/i.test(line));
  if (paidLine) facts.paid = { value: 'yes', quote: quoteOf(paidLine) };
  // Who sent it: a company's web or mail address (not a personal mailbox), else the first line.
  const site = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/i;
  for (const line of lines.slice(0, 30)) {
    const mail = /[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/.exec(line);
    const domain =
      mail?.[1] ?? (/www\.|https?:\/\//i.test(line) ? site.exec(line)?.[1] : undefined);
    if (domain && !PERSONAL_MAIL.test(domain)) {
      const name = domain.split('.').slice(-2, -1)[0] ?? domain;
      facts.supplier = {
        value: name.charAt(0).toUpperCase() + name.slice(1),
        quote: quoteOf(line),
        domain: domain.toLowerCase(),
      };
      break;
    }
  }
  if (
    !facts.supplier &&
    lines[0] &&
    lines[0].length <= 60 &&
    !/facture|invoice|devis/i.test(lines[0])
  )
    facts.supplier = { value: lines[0].replace(/\s+/g, ' '), quote: quoteOf(lines[0]) };
  return facts;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const addMonths = (day: string, months: number) => {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() + months);
  return at.toISOString().slice(0, 10);
};

/**
 * A file read: its genre and its facts kept on it (« lu », with the words), and — when it is an
 * invoice — a proposal of what it makes, waiting for her yes. Read once: a file already
 * understood, or with a proposal already made, is left as it is.
 */
export async function understandFile(
  tx: Tx,
  actor: Actor,
  spaceId: string,
  entryId: string,
  text: string,
): Promise<{ genre: string | null; proposal: string | null }> {
  const file = await get(tx, spaceId, entryId);
  if (!file || (file.data.genre !== undefined && file.data.genre !== null))
    return { genre: null, proposal: null };
  const facts = readFacts(text);
  const kept: Record<string, unknown> = { genre: facts.genre ?? 'other' };
  const said = (fact?: Fact) => (fact ? { value: fact.value, quote: fact.quote } : undefined);
  const read = Object.fromEntries(
    (['amount', 'date', 'due', 'supplier', 'warranty'] as const)
      .filter((key) => facts[key])
      .map((key) => [key, said(facts[key])]),
  );
  if (Object.keys(read).length) kept.facts = read;
  await save(tx, actor, spaceId, {
    entries: [{ id: entryId, data: kept, origin: 'read' }],
  });
  if (facts.genre !== 'invoice' || !facts.amount) return { genre: facts.genre, proposal: null };

  // What her space can hold: her own kinds first (an app's Bill, Warranty), else the common one.
  const models = new Set((await modelsOf(tx, spaceId)).map((model) => model.kind));
  const day = String(facts.date?.value ?? new Date().toISOString().slice(0, 10));
  const amount = Number(facts.amount.value);
  // The supplier, recognised among hers: by its web address, else by its name in the words.
  let supplierId: string | null = null;
  const supplierName = facts.supplier ? String(facts.supplier.value) : null;
  if (facts.supplier) {
    const orgs = await find(tx, spaceId, { kind: 'Organization', limit: 200 });
    const words = fold(text.slice(0, 4000));
    const known =
      orgs.find(
        (one) =>
          facts.supplier!.domain &&
          typeof one.data.website === 'string' &&
          fold(one.data.website).includes(facts.supplier!.domain.replace(/^www\./, '')),
      ) ??
      orgs.find(
        (one) =>
          one.title.length >= 3 &&
          new RegExp(`\\b${fold(one.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(words),
      );
    supplierId = known?.id ?? null;
  }
  const name = supplierId ? null : supplierName;
  const entries: EntryInput[] = [];
  const links: { from: string; to: string; role: string }[] = [];
  const by = supplierId ?? (name ? 'org' : null);
  if (name)
    entries.push({
      ref: 'org',
      kind: 'Organization',
      title: name,
      data: facts.supplier?.domain ? { website: facts.supplier.domain } : {},
      origin: 'read',
    });
  const paid = !!facts.paid;
  const titleFor = (what: string) => `${what}${supplierName ? ` ${supplierName}` : ''}`;
  if (models.has('Bill')) {
    entries.push({
      ref: 'money',
      kind: 'Bill',
      title: titleFor('Facture'),
      data: {
        amount,
        due: String(facts.due?.value ?? day),
        state: paid ? 'paid' : 'to_pay',
      },
      origin: 'read',
    });
  } else {
    entries.push({
      ref: 'money',
      kind: 'Transaction',
      title: titleFor('Achat'),
      data: { amount, date: day, direction: 'out' },
      origin: 'read',
    });
  }
  links.push({ from: entryId, to: 'money', role: 'pièce de' });
  if (by) links.push({ from: 'money', to: by, role: 'chez' });
  let warrantyNote = '';
  if (facts.warranty) {
    const ends = addMonths(day, Number(facts.warranty.value));
    if (models.has('Warranty')) {
      entries.push({
        ref: 'warranty',
        kind: 'Warranty',
        title: titleFor('Garantie'),
        data: { item: file.title, ...(supplierName ? { store: supplierName } : {}), ends },
        origin: 'read',
      });
      links.push({ from: entryId, to: 'warranty', role: 'pièce de' });
      if (by) links.push({ from: 'warranty', to: by, role: 'chez' });
    } else warrantyNote = ` Garantie lue jusqu’au ${ends} : l’app Garanties la suivrait.`;
  }
  const made = await propose(tx, actor, spaceId, {
    title: `${file.title} : ${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €${supplierName ? ` chez ${supplierName}` : ''}`,
    why: `Lu dans le fichier « ${file.title} » (${facts.amount.quote}).${supplierId ? ` ${supplierName} est déjà dans tes organisations.` : ''}${warrantyNote}`,
    entries,
    links,
  });
  return { genre: facts.genre, proposal: made.entries[0]!.id };
}
