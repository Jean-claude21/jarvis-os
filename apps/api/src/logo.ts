import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

// A company's real logo (v3 V7, « vrais logos »): its own icon, fetched by Jarvis from its site and
// kept a while — her browser never calls a third party, and no name or address of hers leaves.
// Only public addresses are reached (never her network, never the server's), over HTTPS, a few
// kilobytes at most, within seconds.

export interface Logo {
  bytes: Uint8Array;
  type: string;
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const MAX_BYTES = 200_000;
const TIMEOUT_MS = 4000;
const cache = new Map<string, { logo: Logo | null; at: number }>();
const KEEP_MS = 7 * 86_400_000;

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
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPublic(v6.slice(7));
  return !(
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

/** One public address of a host, or null — the connection is made to it, so no second lookup. */
async function publicAddress(host: string): Promise<{ address: string; family: number } | null> {
  const all = await lookup(host, { all: true }).catch(() => []);
  if (!all.length || all.some((one) => !isPublic(one.address))) return null;
  return all[0]!;
}

/** An image (or, `page`, a home page's HTML) from a public HTTPS address. */
async function fetchImage(url: URL, hops = 0, page = false): Promise<Logo | null> {
  if (url.protocol !== 'https:' || !DOMAIN.test(url.hostname)) return null;
  const target = await publicAddress(url.hostname);
  if (!target) return null;
  return new Promise((resolve) => {
    const req = request(
      url,
      {
        method: 'GET',
        timeout: TIMEOUT_MS,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; JarvisOS-logo/1.0)',
          accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8',
        },
        // The address checked above, and no other.
        lookup: ((_host: string, options: { all?: boolean }, done: (...args: unknown[]) => void) =>
          options.all
            ? done(null, [{ address: target.address, family: target.family }])
            : done(null, target.address, target.family)) as never,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && hops < 2) {
          res.resume();
          let next: URL | null = null;
          try {
            next = new URL(res.headers.location, url);
          } catch {
            next = null;
          }
          resolve(next ? fetchImage(next, hops + 1, page) : null);
          return;
        }
        const type = String(res.headers['content-type'] ?? '')
          .split(';')[0]!
          .trim();
        const wanted = page
          ? type === 'text/html'
          : /^image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|jpeg|webp|gif)$/.test(type);
        if (status !== 200 || !wanted) {
          res.resume();
          resolve(null);
          return;
        }
        const parts: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            // A page is read up to its head: what came is enough.
            resolve(page ? { bytes: new Uint8Array(Buffer.concat(parts)), type } : null);
          } else parts.push(chunk);
        });
        res.on('end', () =>
          resolve(size > 0 ? { bytes: new Uint8Array(Buffer.concat(parts)), type } : null),
        );
        res.on('error', () => resolve(null));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/** The logo of a domain (« darty.com »): its touch icon, else its favicon; null when none. */
export async function logoFor(raw: string): Promise<Logo | null> {
  const domain = raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]!;
  if (!DOMAIN.test(domain)) return null;
  const kept = cache.get(domain);
  if (kept && Date.now() - kept.at < KEEP_MS) return kept.logo;
  let logo: Logo | null = null;
  for (const host of [domain, `www.${domain}`]) {
    for (const path of ['/apple-touch-icon.png', '/favicon.ico']) {
      logo = await fetchImage(new URL(`https://${host}${path}`)).catch(() => null);
      if (logo) break;
    }
    if (logo) break;
  }
  // Else the icon its home page declares (« <link rel="icon" href="…"> »), the largest first.
  if (!logo) {
    const home =
      (await fetchImage(new URL(`https://${domain}/`), 0, true).catch(() => null)) ??
      (await fetchImage(new URL(`https://www.${domain}/`), 0, true).catch(() => null));
    const html = home ? new TextDecoder().decode(home.bytes) : '';
    const icons = [...html.matchAll(/<link\b[^>]*>/gi)]
      .map((tag) => tag[0])
      .filter((tag) => /rel=["'][^"']*icon[^"']*["']/i.test(tag))
      .map((tag) => ({
        href: /href=["']([^"']+)["']/i.exec(tag)?.[1] ?? '',
        size: Number(/sizes=["'](\d+)/i.exec(tag)?.[1] ?? (/apple-touch/i.test(tag) ? 180 : 16)),
      }))
      .filter((one) => one.href && !one.href.startsWith('data:'))
      .sort((a, b) => b.size - a.size);
    for (const icon of icons.slice(0, 3)) {
      let url: URL | null = null;
      try {
        url = new URL(icon.href.replace(/&amp;/g, '&'), `https://${domain}/`);
      } catch {
        url = null;
      }
      if (url) logo = await fetchImage(url).catch(() => null);
      if (logo) break;
    }
  }
  if (cache.size > 1000) cache.delete(cache.keys().next().value!);
  cache.set(domain, { logo, at: Date.now() });
  return logo;
}
