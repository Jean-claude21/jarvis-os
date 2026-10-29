import type { Tx } from './db';
import { prefixedId } from './ids';

export interface Space {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

/** A person's life: a space she owns. */
export async function createSpace(
  tx: Tx,
  input: { person: string; name: string },
): Promise<string> {
  const id = prefixedId('spc');
  // No `returning`: she is not a member yet, so the space is not readable until the next insert.
  await tx.query('insert into space (id, name, created_by) values ($1, $2, $3)', [
    id,
    input.name.trim().slice(0, 120) || input.person,
    input.person,
  ]);
  await tx.query("insert into member (space_id, person_id, role) values ($1, $2, 'owner')", [
    id,
    input.person,
  ]);
  return id;
}

/** The spaces the acting person belongs to, oldest first. */
export async function spacesOf(tx: Tx): Promise<Space[]> {
  const { rows } = await tx.query<Space>(
    `select s.id, s.name, m.role from space s join member m on m.space_id = s.id
      where m.person_id = jarvis_person() order by s.created_at`,
  );
  return rows;
}
