import { membersOf, type EntryInput, type Tx } from '@jarvis-os/core';
import type pg from 'pg';
import { namesOf } from './spaces';

// For whom (spec 038, plan v2 C5): an entry says `who` — a member of its space, by her name, her
// email, « moi », or the member's id. Jarvis keeps the member's id; the watcher tells only her, and
// « Maintenant » shows each what is hers. « personne » / « tous » leave it for nobody in particular.

const fold = (one: string) => one.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const SELF = new Set(['moi', 'me', 'a moi', 'myself', 'pour moi']);
const NOBODY = new Set(['personne', 'nobody', 'tous', 'tout le monde', 'everyone', 'all']);

/** The entries with their `who` turned into a member's id; a name that is no member says so. */
export async function withWho<T extends Pick<EntryInput, 'data'>>(
  db: pg.Pool,
  tx: Tx,
  spaceId: string,
  self: string,
  entries: T[],
): Promise<T[]> {
  if (!entries.some((one) => typeof one.data?.who === 'string')) return entries;
  const members = await membersOf(tx, spaceId);
  const ids = members.map((one) => one.person);
  const names = await namesOf(db, ids);
  const { rows } = await db.query<{ id: string; email: string }>(
    'select id, email from "user" where id = any($1)',
    [ids],
  );
  const emails = new Map(rows.map((row) => [row.id, row.email]));
  return entries.map((entry) => {
    const said = entry.data?.who;
    if (typeof said !== 'string') return entry;
    const wanted = fold(said);
    let who: string | null;
    if (!wanted || NOBODY.has(wanted)) who = null;
    else if (SELF.has(wanted)) who = self;
    else if (ids.includes(said.trim())) who = said.trim();
    else {
      const found = ids.filter((id) => {
        const name = fold(names.get(id) ?? '');
        return (
          fold(emails.get(id) ?? '') === wanted ||
          name === wanted ||
          name.split(/\s+/)[0] === wanted
        );
      });
      if (found.length !== 1) {
        const known = ids.map((id) => `« ${names.get(id) ?? emails.get(id) ?? id} »`).join(', ');
        throw new Error(
          found.length
            ? `« ${said} » names several members: say which (${known}).`
            : `« ${said} » is no member of this space. Its members: ${known}.`,
        );
      }
      who = found[0]!;
    }
    return { ...entry, data: { ...entry.data, who } };
  });
}
