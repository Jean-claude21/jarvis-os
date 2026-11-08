import { randomBytes } from 'node:crypto';
import { afterAll } from 'vitest';
import { asPerson, createSpace, pool, type Actor, type Tx } from '../src';
import { required } from '../src/env';

/** The application's pool on the Neon `test` branch: `jarvis_app`, under row-level security. */
export const db = pool(required('JARVIS_TEST_APP_URL'));
afterAll(() => db.end());

export interface Person {
  id: string;
  space: string;
  actor: Actor;
  as: <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
}

/** A person of this test run, with her own space. */
export async function person(name: string): Promise<Person> {
  const id = `per_${name.toLowerCase()}_${randomBytes(4).toString('hex')}`;
  const as = <T>(work: (tx: Tx) => Promise<T>) => asPerson(db, id, work);
  const space = await as((tx) => createSpace(tx, { person: id, name }));
  return { id, space, actor: { person: id, door: 'test' }, as };
}
