import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// The secrets of her connectors (spec 025), sealed with AES-256-GCM before they reach the database:
// `v1.<iv>.<tag>.<ciphertext>`, base64url. The key is `JARVIS_<BRANCH>_SECRETS_KEY` (32 bytes,
// base64) when set, else derived from the branch's auth secret (HKDF): the database alone never
// opens them.

const PREFIX = 'v1';

/** The 32-byte key of a branch. */
export function secretsKey(authSecret: string, given = process.env.JARVIS_SECRETS_KEY): Buffer {
  if (given) {
    const key = Buffer.from(given, 'base64');
    if (key.length !== 32) throw new Error('JARVIS_SECRETS_KEY must be 32 bytes, in base64.');
    return key;
  }
  return Buffer.from(hkdfSync('sha256', authSecret, 'jarvis-os', 'connector secrets', 32));
}

export function seal(key: Buffer, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [PREFIX, iv, cipher.getAuthTag(), sealed]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** The secret, or an error when the sealed text was changed or sealed with another key. */
export function open(key: Buffer, sealed: string): string {
  const [prefix, iv, tag, text] = sealed.split('.');
  if (prefix !== PREFIX || !iv || !tag || text === undefined)
    throw new Error('Not a sealed secret.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(text, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
