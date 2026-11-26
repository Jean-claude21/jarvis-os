import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

// What Jarvis calls on her behalf (spec 110): her servers of tools, an agent's address, a calendar
// she follows. Only the public internet, over HTTPS — never the server's own network, its cloud's
// metadata, nor hers. Checked at each connection, not once before it: the address a name resolves
// to is the one checked and the one reached (a name that changes its answer in between gains
// nothing), and each redirection is checked again. On a developer's Jarvis (`local`), her own
// machine (http://localhost) is allowed too, for an agent she runs.

/** Whether an address is one of the public internet (not private, loopback, link-local…). */
export function isPublic(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number];
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6.startsWith('::ffff:')) {
    const tail = v6.slice(7);
    // « ::ffff:7f00:1 » is 127.0.0.1 written in hexadecimal.
    if (isIP(tail) === 4) return isPublic(tail);
    const [high, low] = tail.split(':').map((part) => parseInt(part, 16));
    if (high === undefined || low === undefined || Number.isNaN(high) || Number.isNaN(low))
      return false;
    return isPublic([high >> 8, high & 255, low >> 8, low & 255].join('.'));
  }
  return !(
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('64:ff9b:') ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

/** Her own machine (http://localhost) is reached from a developer's Jarvis, never production. */
export const localAllowed = () => (process.env.JARVIS_BRANCH ?? 'dev') !== 'main';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);
const hostOf = (url: URL) => url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

/** Why Jarvis will not call this address, or null when it may. Checks what the address says. */
export function refusalOf(raw: string | URL, local = false): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not an address';
  }
  const host = hostOf(url);
  if (local && LOOPBACK.has(host) && (url.protocol === 'http:' || url.protocol === 'https:'))
    return null;
  if (url.protocol !== 'https:') return 'only https addresses are called';
  if (url.username || url.password) return 'no name or password in the address';
  if (isIP(host) && !isPublic(host)) return 'a private or reserved address';
  if (host === 'localhost' || host.endsWith('.localhost')) return 'a private or reserved address';
  if (host.endsWith('.internal') || host.endsWith('.local') || !host.includes('.'))
    return 'a private or reserved address';
  return null;
}

/** The error an address refused throws: said the same way everywhere. */
export class AddressRefused extends Error {
  constructor(url: string | URL, why: string) {
    let origin = String(url);
    try {
      origin = new URL(url).origin;
    } catch {
      /* the address as given */
    }
    super(`${origin} is not an address Jarvis calls: ${why}.`);
    this.name = 'AddressRefused';
  }
}

/** Throws when Jarvis will not call this address (what it says; its resolution is checked later). */
export function assertCallable(url: string | URL, local = false) {
  const why = refusalOf(url, local);
  if (why) throw new AddressRefused(url, why);
}

type LookupDone = (
  error: NodeJS.ErrnoException | null,
  address: string | { address: string; family: number }[],
  family?: number,
) => void;

/** A resolution that refuses a name answering with a private address (every answer is checked). */
function publicLookup(local: boolean) {
  return (host: string, options: { all?: boolean }, done: LookupDone) => {
    dnsLookup(host, { all: true }, (error, all) => {
      if (error) return done(error, []);
      const loopbackAllowed = local && LOOPBACK.has(host.toLowerCase());
      const refused = all.find((one) => !isPublic(one.address));
      if (!all.length || (refused && !loopbackAllowed)) {
        const said = new Error(`${host} resolves to a private or reserved address.`);
        (said as NodeJS.ErrnoException).code = 'EADDRNOTALLOWED';
        return done(said, []);
      }
      if (options.all) done(null, all);
      else done(null, all[0]!.address, all[0]!.family);
    });
  };
}

const agents = new Map<boolean, Agent>();
const agentFor = (local: boolean) => {
  let agent = agents.get(local);
  if (!agent) {
    agent = new Agent({ connect: { lookup: publicLookup(local) as never } });
    agents.set(local, agent);
  }
  return agent;
};

const MAX_HOPS = 5;
/** The headers a redirection to another site keeps: none that could hold a key. */
const NEUTRAL = new Set(['accept', 'accept-language', 'content-type', 'user-agent']);

/**
 * `fetch` for what Jarvis calls on her behalf: the address checked, its resolution checked at the
 * connection, each redirection followed by hand and checked again.
 */
export function outboundFetch(local = false): typeof fetch {
  const dispatcher = agentFor(local);
  const guarded = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    let url = new URL(request ? request.url : String(input));
    let method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    let body = init?.body ?? (request ? await request.clone().arrayBuffer() : undefined);
    const headers = new Headers(request?.headers);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    const follow = (init?.redirect ?? request?.redirect ?? 'follow') === 'follow';
    for (let hop = 0; ; hop += 1) {
      assertCallable(url, local);
      const answer = (await undiciFetch(url, {
        ...(init as object),
        method,
        headers: headers as never,
        body: body as never,
        redirect: 'manual',
        dispatcher,
      })) as unknown as Response;
      const location = answer.headers.get('location');
      if (!follow || answer.status < 300 || answer.status >= 400 || !location) return answer;
      if (hop >= MAX_HOPS) throw new Error(`${url.origin}: too many redirections.`);
      const next = new URL(location, url);
      // A redirection to another site carries none of her keys, whatever header holds them.
      if (next.origin !== url.origin) {
        const names: string[] = [];
        headers.forEach((_value, name) => names.push(name));
        for (const name of names) if (!NEUTRAL.has(name.toLowerCase())) headers.delete(name);
      }
      if (
        answer.status === 303 ||
        ((answer.status === 301 || answer.status === 302) && method === 'POST')
      ) {
        method = 'GET';
        body = undefined;
        headers.delete('content-type');
      }
      await answer.body?.cancel().catch(() => undefined);
      url = next;
    }
  };
  return guarded as typeof fetch;
}
