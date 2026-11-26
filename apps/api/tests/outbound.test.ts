import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Spec 110: what Jarvis calls on her behalf reaches the public internet only — never the server's
// own network nor its cloud's metadata, whether the address says so, its name resolves to it, or a
// redirection leads there; and a redirection to another site carries none of her keys.

// A name that resolves to the cloud's metadata address, as an attacker's name would.
vi.mock('node:dns', async (original) => {
  const real = await original<typeof import('node:dns')>();
  const lookup = ((host: string, options: unknown, done: (...args: unknown[]) => void) =>
    host === 'metadata.example.com'
      ? done(null, [{ address: '169.254.169.254', family: 4 }])
      : (real.lookup as (...args: unknown[]) => void)(host, options, done)) as typeof real.lookup;
  return { ...real, default: { ...real, lookup }, lookup };
});

const { isPublic, outboundFetch, refusalOf } = await import('../src/outbound');

describe('the addresses Jarvis calls', () => {
  it('refuses what the address itself says is private, reserved or not https', () => {
    for (const inside of [
      'https://10.0.0.4/x',
      'https://192.168.1.2/x',
      'https://172.20.0.1/x',
      'https://169.254.169.254/latest/meta-data',
      'https://127.0.0.1/x',
      'https://0.0.0.0/x',
      'https://[::1]/x',
      'https://[::ffff:7f00:1]/x',
      'https://[fd00::1]/x',
      'https://box.internal/x',
      'https://printer.local/x',
      'https://intranet/x',
      'https://localhost/x',
      'http://agent.example.com/x',
      'https://name:secret@agent.example.com/x',
      'file:///etc/passwd',
    ])
      expect(refusalOf(inside), inside).not.toBeNull();
    expect(refusalOf('https://mcp.notion.com/mcp')).toBeNull();
  });

  it('allows her own machine only on a developer’s Jarvis', () => {
    expect(refusalOf('http://localhost:8000/x', true)).toBeNull();
    expect(refusalOf('http://127.0.0.1:8000/x', true)).toBeNull();
    expect(refusalOf('http://localhost:8000/x', false)).not.toBeNull();
    expect(refusalOf('http://10.0.0.4/x', true)).not.toBeNull();
  });

  it('reads private addresses in every spelling', () => {
    expect(isPublic('8.8.8.8')).toBe(true);
    expect(isPublic('2001:4860:4860::8888')).toBe(true);
    for (const inside of ['100.64.0.1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', 'fe80::1', '::'])
      expect(isPublic(inside), inside).toBe(false);
  });

  it('refuses a name that resolves to a private address, at the connection', async () => {
    await expect(outboundFetch(false)('https://metadata.example.com/latest')).rejects.toThrow();
    const cause = await outboundFetch(false)('https://metadata.example.com/latest').catch(
      (error: Error & { cause?: Error }) => error.cause?.message ?? error.message,
    );
    expect(String(cause)).toMatch(/private or reserved/);
  });
});

describe('a redirection', () => {
  let first: Server;
  let second: Server;
  let firstAt = '';
  let secondAt = '';
  let seen: IncomingHttpHeaders | null = null;

  beforeAll(async () => {
    second = createServer((req, res) => {
      seen = req.headers;
      res.end('here');
    });
    await new Promise<void>((done) => second.listen(0, '127.0.0.1', done));
    secondAt = `http://localhost:${(second.address() as AddressInfo).port}`;
    first = createServer((req, res) => {
      const to = req.url === '/inside' ? 'https://169.254.169.254/latest' : `${secondAt}/landing`;
      res.writeHead(302, { location: to }).end();
    });
    await new Promise<void>((done) => first.listen(0, '127.0.0.1', done));
    firstAt = `http://127.0.0.1:${(first.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    first.close();
    second.close();
  });

  it('to the server’s network is refused', async () => {
    await expect(outboundFetch(true)(`${firstAt}/inside`)).rejects.toThrow(
      /not an address Jarvis calls/,
    );
  });

  it('to another site is followed without her keys', async () => {
    const answer = await outboundFetch(true)(`${firstAt}/away`, {
      headers: { authorization: 'Bearer hers', 'x-api-key': 'hers too', accept: 'text/plain' },
    });
    expect(await answer.text()).toBe('here');
    expect(seen?.authorization).toBeUndefined();
    expect(seen?.['x-api-key']).toBeUndefined();
    expect(seen?.accept).toBe('text/plain');
  });

  it('is left to the caller when asked', async () => {
    const answer = await outboundFetch(true)(`${firstAt}/inside`, { redirect: 'manual' });
    expect(answer.status).toBe(302);
  });
});
