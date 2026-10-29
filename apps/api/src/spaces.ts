import type { Space } from '@jarvis-os/core';
import type pg from 'pg';

/** « Nous », « nous », « NOUS » are one name: case and accents aside. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/**
 * The space a call acts in (spec 004): the one named (its id, or its name) among those the door may
 * reach, else her own. Refused in words when it is not reachable.
 */
export function spaceFor(reachable: Space[], wanted?: string | null): Space {
  if (!wanted) {
    const own = reachable.find((one) => one.personal) ?? reachable[0];
    if (!own) throw new Error('No space is reachable here.');
    return own;
  }
  const found =
    reachable.find((one) => one.id === wanted) ??
    reachable.find((one) => fold(one.name) === fold(wanted));
  if (!found) {
    throw new Error(
      `No space « ${wanted} » reachable here. Reachable: ${reachable.map((one) => `« ${one.name} »`).join(', ')}. She can allow another space by connecting again.`,
    );
  }
  return found;
}

/** An invitation's link: the secret travels in the fragment, never sent to a server or logged. */
export const invitationLink = (publicUrl: string, token: string) =>
  `${publicUrl.replace(/\/$/, '')}/invitation#${token}`;

/** The names of accounts, for who belongs to a space: accounts are the doors' business. */
export async function namesOf(db: pg.Pool, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await db.query<{ id: string; name: string }>(
    'select id, name from "user" where id = any($1)',
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}
