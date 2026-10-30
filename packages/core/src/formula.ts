import { DEFAULT_ZONE } from './time';

// Formulas (spec 014): a small language a model writes and the core evaluates, never `eval`.
//   solde_initial + sum(mouvements.montant where nature = 'entrée') - sum(mouvements.montant where nature = 'sortie')
//   if(reste < 0, 'dépassé', 'ok')        streak(pointages.date)        last_days(date, 30)
// Names are fields of the entry, its relations (one entry or many) and their fields; a name with
// spaces is written between backticks. Text compares with `=` case and accents aside.

export type Node =
  | { t: 'value'; value: unknown }
  | { t: 'path'; parts: string[] }
  | { t: 'call'; name: string; args: Node[]; where?: Node }
  | { t: 'binary'; op: string; left: Node; right: Node }
  | { t: 'not'; arg: Node }
  | { t: 'neg'; arg: Node };

/** What a formula reads its names from: an entry, a line, a page. */
export interface Scope {
  get(name: string): Promise<unknown> | unknown;
}

/** A value that is itself read by name: an entry reached through a relation, or a line. */
export const isScope = (value: unknown): value is Scope =>
  typeof value === 'object' && value !== null && typeof (value as Scope).get === 'function';

export const FUNCTIONS = [
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'if',
  'coalesce',
  'round',
  'abs',
  'floor',
  'ceil',
  'today',
  'now',
  'month',
  'year',
  'this_month',
  'last_days',
  'days_between',
  'date_add',
  'since',
  'lower',
  'contains',
  'len',
  'streak',
] as const;
const AGGREGATES = new Set(['sum', 'avg', 'count', 'min', 'max']);

type Token = { k: 'num' | 'str' | 'name' | 'op'; v: string; at: number };

function tokens(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const fail = (what: string): never => {
    throw new Error(`Formula « ${text} »: ${what} at ${i + 1}.`);
  };
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    const at = i;
    if (/\d/.test(c) || (c === '.' && /\d/.test(text[i + 1] ?? ''))) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(text.slice(i))!;
      out.push({ k: 'num', v: m[0], at });
      i += m[0].length;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== c) {
        if (text[j] === '\\' && j + 1 < text.length) j += 1;
        value += text[j];
        j += 1;
      }
      if (j >= text.length) fail('a text is not closed');
      out.push({ k: 'str', v: value, at });
      i = j + 1;
    } else if (c === '`') {
      const j = text.indexOf('`', i + 1);
      if (j < 0) fail('a name is not closed');
      out.push({ k: 'name', v: text.slice(i + 1, j), at });
      i = j + 1;
    } else if (/[\p{L}_]/u.test(c)) {
      const m = /^[\p{L}\p{N}_]+/u.exec(text.slice(i))!;
      out.push({ k: 'name', v: m[0], at });
      i += m[0].length;
    } else {
      const two = text.slice(i, i + 2);
      if (['<=', '>=', '!=', '<>', '=='].includes(two)) {
        out.push({ k: 'op', v: two === '<>' ? '!=' : two === '==' ? '=' : two, at });
        i += 2;
      } else if ('+-*/%()<>=,.'.includes(c)) {
        out.push({ k: 'op', v: c, at });
        i += 1;
      } else fail(`« ${c} » is not understood`);
    }
  }
  return out;
}

/** The tree of a formula; throws a sentence saying where it goes wrong. */
export function parse(text: string): Node {
  const list = tokens(text);
  let i = 0;
  const peek = () => list[i];
  const fail = (what: string): never => {
    const at = peek()?.at ?? text.length;
    throw new Error(`Formula « ${text} »: ${what} at ${at + 1}.`);
  };
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v;
  const isWord = (v: string) => peek()?.k === 'name' && peek()!.v.toLowerCase() === v;
  const expect = (v: string) => {
    if (!isOp(v)) fail(`« ${v} » expected`);
    i += 1;
  };

  const or = (): Node => {
    let left = and();
    while (isWord('or')) {
      i += 1;
      left = { t: 'binary', op: 'or', left, right: and() };
    }
    return left;
  };
  const and = (): Node => {
    let left = not();
    while (isWord('and')) {
      i += 1;
      left = { t: 'binary', op: 'and', left, right: not() };
    }
    return left;
  };
  const not = (): Node => {
    if (isWord('not')) {
      i += 1;
      return { t: 'not', arg: not() };
    }
    return compare();
  };
  const compare = (): Node => {
    const left = add();
    const op = peek();
    if (op?.k === 'op' && ['=', '!=', '<', '<=', '>', '>='].includes(op.v)) {
      i += 1;
      return { t: 'binary', op: op.v, left, right: add() };
    }
    return left;
  };
  const add = (): Node => {
    let left = mul();
    while (isOp('+') || isOp('-')) {
      const op = list[i++]!.v;
      left = { t: 'binary', op, left, right: mul() };
    }
    return left;
  };
  const mul = (): Node => {
    let left = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = list[i++]!.v;
      left = { t: 'binary', op, left, right: unary() };
    }
    return left;
  };
  const unary = (): Node => {
    if (isOp('-')) {
      i += 1;
      return { t: 'neg', arg: unary() };
    }
    return primary();
  };
  const primary = (): Node => {
    const token = peek();
    if (!token) return fail('something expected');
    if (token.k === 'num') {
      i += 1;
      return { t: 'value', value: Number(token.v) };
    }
    if (token.k === 'str') {
      i += 1;
      return { t: 'value', value: token.v };
    }
    if (isOp('(')) {
      i += 1;
      const inner = or();
      expect(')');
      return inner;
    }
    if (token.k === 'name') {
      i += 1;
      const word = token.v.toLowerCase();
      if (word === 'true' || word === 'false') return { t: 'value', value: word === 'true' };
      if (word === 'null') return { t: 'value', value: null };
      if (isOp('(')) {
        if (!(FUNCTIONS as readonly string[]).includes(word)) {
          fail(`« ${token.v} » is not a function (${FUNCTIONS.join(', ')})`);
        }
        i += 1;
        const args: Node[] = [];
        let where: Node | undefined;
        if (!isOp(')')) {
          args.push(or());
          if (isWord('where')) {
            if (!AGGREGATES.has(word)) fail(`« where » belongs to ${[...AGGREGATES].join(', ')}`);
            i += 1;
            where = or();
          }
          while (isOp(',')) {
            i += 1;
            args.push(or());
          }
        }
        expect(')');
        return { t: 'call', name: word, args, ...(where ? { where } : {}) };
      }
      const parts = [token.v];
      while (isOp('.')) {
        i += 1;
        const next = peek();
        if (next?.k !== 'name') fail('a name expected after « . »');
        parts.push(next!.v);
        i += 1;
      }
      return { t: 'path', parts };
    }
    return fail(`« ${token.v} » unexpected`);
  };

  const tree = or();
  if (i < list.length) fail(`« ${peek()!.v} » unexpected`);
  return tree;
}

/** The names a formula starts from (the first part of each path), to check them. */
export function namesOf(node: Node, out = new Set<string>()): Set<string> {
  switch (node.t) {
    case 'path':
      out.add(node.parts[0]!);
      break;
    case 'call':
      node.args.forEach((arg) => namesOf(arg, out));
      break;
    case 'binary':
      namesOf(node.left, out);
      namesOf(node.right, out);
      break;
    case 'not':
    case 'neg':
      namesOf(node.arg, out);
      break;
  }
  return out;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : null;

const truthy = (value: unknown) =>
  !(value === null || value === undefined || value === false || value === 0 || value === '');

/** The day of a value (« 2026-10-30 »), or null. */
const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

const dayNumber = (day: string) =>
  Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;
const dayText = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** The clock a formula reads: today on her clock. */
export interface Clock {
  now: Date;
  zone?: string;
}

export function todayOf(clock: Clock): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: clock.zone ?? DEFAULT_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(clock.now);
}

const MAX_ITEMS = 20_000;

/** A path read from a scope: an entry's field, a relation, a relation's field — lists flattened. */
async function walk(start: unknown, parts: string[]): Promise<unknown> {
  let value = start;
  for (const part of parts) {
    if (Array.isArray(value)) {
      const next: unknown[] = [];
      for (const item of value) {
        const one = isScope(item) ? await item.get(part) : null;
        if (Array.isArray(one)) next.push(...one);
        else if (one !== null && one !== undefined) next.push(one);
      }
      value = next;
    } else if (isScope(value)) {
      value = await value.get(part);
    } else return null;
  }
  return value ?? null;
}

/** A scope seen from an item of a list: its own names first, then the outer scope's. */
const within = (item: unknown, outer: Scope): Scope => ({
  get: async (name) => {
    if (isScope(item)) {
      const own = await item.get(name);
      if (own !== null && own !== undefined) return own;
    }
    return outer.get(name);
  },
});

/** Evaluates a formula's tree in a scope. */
export async function evaluate(node: Node, scope: Scope, clock: Clock): Promise<unknown> {
  const run = (one: Node, at: Scope = scope) => evaluate(one, at, clock);
  switch (node.t) {
    case 'value':
      return node.value;
    case 'path':
      return walk(scope, node.parts);
    case 'neg': {
      const value = num(await run(node.arg));
      return value === null ? null : -value;
    }
    case 'not':
      return !truthy(await run(node.arg));
    case 'binary': {
      if (node.op === 'and') return truthy(await run(node.left)) && truthy(await run(node.right));
      if (node.op === 'or') return truthy(await run(node.left)) || truthy(await run(node.right));
      const left = await run(node.left);
      const right = await run(node.right);
      switch (node.op) {
        case '=':
        case '!=': {
          const same =
            typeof left === 'string' && typeof right === 'string'
              ? fold(left) === fold(right)
              : num(left) !== null && num(right) !== null
                ? num(left) === num(right)
                : (left ?? null) === (right ?? null);
          return node.op === '=' ? same : !same;
        }
        case '<':
        case '<=':
        case '>':
        case '>=': {
          if (left === null || right === null || left === undefined || right === undefined)
            return false;
          const a = num(left) ?? String(left);
          const b = num(right) ?? String(right);
          if (typeof a !== typeof b) return false;
          return node.op === '<'
            ? a < b
            : node.op === '<='
              ? a <= b
              : node.op === '>'
                ? a > b
                : a >= b;
        }
        case '+':
          if (typeof left === 'string' && num(left) === null) return left + String(right ?? '');
          if (typeof right === 'string' && num(right) === null) return String(left ?? '') + right;
          return (num(left) ?? 0) + (num(right) ?? 0);
        case '-':
          return (num(left) ?? 0) - (num(right) ?? 0);
        case '*':
          return (num(left) ?? 0) * (num(right) ?? 0);
        case '/':
        case '%': {
          const divisor = num(right);
          if (!divisor) return null;
          return node.op === '/' ? (num(left) ?? 0) / divisor : (num(left) ?? 0) % divisor;
        }
      }
      return null;
    }
    case 'call':
      return call(node, scope, clock);
  }
}

/** The items an aggregate goes over, and what it reads from each. */
async function itemsOf(node: Node, where: Node | undefined, scope: Scope, clock: Clock) {
  if (node.t !== 'path') {
    const value = await evaluate(node, scope, clock);
    return Array.isArray(value) ? value : [value];
  }
  // Walk while the value is one entry; the first list is what the aggregate goes over.
  let value: unknown = scope;
  let index = 0;
  while (index < node.parts.length && !Array.isArray(value)) {
    value = isScope(value) ? await value.get(node.parts[index]!) : null;
    index += 1;
  }
  if (!Array.isArray(value)) {
    if (!where) return value === null || value === undefined ? [] : [value];
    return value !== null && truthy(await evaluate(where, within(value, scope), clock))
      ? [value]
      : [];
  }
  const rest = node.parts.slice(index);
  const out: unknown[] = [];
  for (const item of value.slice(0, MAX_ITEMS)) {
    if (where && !truthy(await evaluate(where, within(item, scope), clock))) continue;
    const read = rest.length ? await walk(item, rest) : item;
    if (Array.isArray(read)) out.push(...read);
    else out.push(read);
  }
  return out;
}

async function call(
  node: Extract<Node, { t: 'call' }>,
  scope: Scope,
  clock: Clock,
): Promise<unknown> {
  const arg = (index: number) =>
    node.args[index] ? evaluate(node.args[index]!, scope, clock) : null;
  const today = todayOf(clock);
  switch (node.name) {
    case 'sum':
    case 'avg':
    case 'count':
    case 'min':
    case 'max': {
      let values: unknown[];
      if (node.args.length > 1) {
        values = [];
        for (let i = 0; i < node.args.length; i += 1) values.push(await arg(i));
      } else if (node.args.length === 1)
        values = await itemsOf(node.args[0]!, node.where, scope, clock);
      else values = [];
      if (node.name === 'count')
        return values.filter((one) => one !== null && one !== undefined).length;
      if (node.name === 'min' || node.name === 'max') {
        const present = values.filter((one) => one !== null && one !== undefined && !isScope(one));
        if (!present.length) return null;
        const numbers = present.map(num);
        if (numbers.every((one) => one !== null)) {
          return node.name === 'min'
            ? Math.min(...(numbers as number[]))
            : Math.max(...(numbers as number[]));
        }
        const texts = present.map(String).sort();
        return node.name === 'min' ? texts[0] : texts[texts.length - 1];
      }
      const numbers = values.map(num).filter((one): one is number => one !== null);
      const total = numbers.reduce((sum, one) => sum + one, 0);
      if (node.name === 'sum') return Math.round(total * 1e9) / 1e9;
      return numbers.length ? total / numbers.length : null;
    }
    case 'if':
      return truthy(await arg(0)) ? arg(1) : arg(2);
    case 'coalesce':
      for (let i = 0; i < node.args.length; i += 1) {
        const value = await arg(i);
        if (value !== null && value !== undefined && value !== '') return value;
      }
      return null;
    case 'round': {
      const value = num(await arg(0));
      const digits = num(await arg(1)) ?? 0;
      return value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
    }
    case 'abs':
    case 'floor':
    case 'ceil': {
      const value = num(await arg(0));
      return value === null ? null : Math[node.name](value);
    }
    case 'today':
      return today;
    case 'now':
      return clock.now.toISOString();
    case 'month': {
      const day = dayOf(await arg(0));
      return day ? day.slice(0, 7) : null;
    }
    case 'year': {
      const day = dayOf(await arg(0));
      return day ? Number(day.slice(0, 4)) : null;
    }
    case 'this_month': {
      const day = dayOf(await arg(0));
      return day !== null && day.slice(0, 7) === today.slice(0, 7);
    }
    case 'last_days': {
      const day = dayOf(await arg(0));
      const days = num(await arg(1)) ?? 30;
      if (!day) return false;
      const gap = dayNumber(today) - dayNumber(day);
      return gap >= 0 && gap < days;
    }
    case 'days_between': {
      const a = dayOf(await arg(0));
      const b = dayOf(await arg(1)) ?? today;
      return a ? dayNumber(b) - dayNumber(a) : null;
    }
    case 'date_add': {
      const day = dayOf(await arg(0));
      const days = num(await arg(1)) ?? 0;
      return day ? dayText(dayNumber(day) + days) : null;
    }
    case 'since': {
      const day = dayOf(await arg(0));
      const from = dayOf(await arg(1));
      return day !== null && from !== null && day >= from;
    }
    case 'lower': {
      const value = await arg(0);
      return typeof value === 'string' ? value.toLowerCase() : value;
    }
    case 'contains': {
      const where = await arg(0);
      const what = await arg(1);
      if (Array.isArray(where))
        return where.some((one) =>
          typeof one === 'string' && typeof what === 'string'
            ? fold(one) === fold(what)
            : one === what,
        );
      return (
        typeof where === 'string' && typeof what === 'string' && fold(where).includes(fold(what))
      );
    }
    case 'len': {
      const value = await arg(0);
      return Array.isArray(value) ? value.length : typeof value === 'string' ? value.length : 0;
    }
    case 'streak': {
      // Days in a row up to today (or yesterday, when today is not done yet).
      const values = node.args[0] ? await itemsOf(node.args[0], node.where, scope, clock) : [];
      const days = new Set(values.map(dayOf).filter((one): one is string => one !== null));
      let cursor = dayNumber(today);
      if (!days.has(today)) cursor -= 1;
      let count = 0;
      while (days.has(dayText(cursor))) {
        count += 1;
        cursor -= 1;
      }
      return count;
    }
  }
  return null;
}

/** Parses once, evaluates in a scope: the formula's value. */
export async function formulaValue(text: string, scope: Scope, clock: Clock): Promise<unknown> {
  return evaluate(parse(text), scope, clock);
}
