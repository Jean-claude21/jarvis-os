import { randomBytes } from 'node:crypto';

/** « ent_X3k9… »: a prefix that says what it names, 16 random characters. */
export const prefixedId = (prefix: 'spc' | 'ent' | 'lnk' | 'inv' | 'imp' | 'key') =>
  `${prefix}_${randomBytes(12).toString('base64url')}`;
