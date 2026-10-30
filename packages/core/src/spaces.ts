import { createHash, randomBytes } from 'node:crypto';
import type { Actor, Tx } from './db';
import { prefixedId } from './ids';
import { record } from './journal';

export interface Space {
  id: string;
  name: string;
  role: 'owner' | 'member' | 'viewer';
  /** Her own space: private for good, no one is ever invited into it. */
  personal: boolean;
}

export interface Member {
  person: string;
  role: 'owner' | 'member' | 'viewer';
  since: string;
}

export interface Invitation {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  state: 'open' | 'used' | 'expired' | 'withdrawn';
}

export const INVITATION_DAYS = 14;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

/** A space she owns: her own private one at sign-up, or a shared one she creates. */
export async function createSpace(
  tx: Tx,
  input: { person: string; name: string; personal?: boolean },
): Promise<string> {
  const id = prefixedId('spc');
  // No `returning`: she is not a member yet, so the space is not readable until the next insert.
  await tx.query('insert into space (id, name, created_by, personal) values ($1, $2, $3, $4)', [
    id,
    input.name.trim().slice(0, 120) || input.person,
    input.person,
    input.personal ?? true,
  ]);
  await tx.query("insert into member (space_id, person_id, role) values ($1, $2, 'owner')", [
    id,
    input.person,
  ]);
  return id;
}

/** The spaces the acting person belongs to: her own first, then the shared ones, oldest first. */
export async function spacesOf(tx: Tx): Promise<Space[]> {
  const { rows } = await tx.query<Space>(
    `select s.id, s.name, m.role, s.personal from space s join member m on m.space_id = s.id
      where m.person_id = jarvis_person()
      order by (s.personal and s.created_by = jarvis_person()) desc, s.created_at`,
  );
  return rows;
}

/** Who belongs to a space she belongs to. */
export async function membersOf(tx: Tx, spaceId: string): Promise<Member[]> {
  const { rows } = await tx.query<Member>(
    `select person_id as person, role,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as since
       from member where space_id = $1 order by created_at`,
    [spaceId],
  );
  return rows;
}

async function spaceOf(tx: Tx, spaceId: string): Promise<Space> {
  const space = (await spacesOf(tx)).find((one) => one.id === spaceId);
  if (!space) throw new Error(`No space ${spaceId} among hers.`);
  return space;
}

/** A shared space she creates and owns. */
export async function createSharedSpace(
  tx: Tx,
  actor: Actor,
  input: { name: string },
): Promise<Space> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('A shared space needs a name.');
  const id = await createSpace(tx, { person: actor.person, name, personal: false });
  await record(tx, actor, {
    spaceId: id,
    command: 'space.create',
    target: id,
    before: null,
    after: { name },
  });
  return { id, name, role: 'owner', personal: false };
}

/** Renames a space she owns. */
export async function renameSpace(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; name: string },
): Promise<void> {
  const space = await spaceOf(tx, input.spaceId);
  if (space.role !== 'owner') throw new Error('Only an owner renames a space.');
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('A space needs a name.');
  await tx.query('update space set name = $2 where id = $1', [input.spaceId, name]);
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'space.rename',
    target: input.spaceId,
    before: { name: space.name },
    after: { name },
  });
}

/**
 * Invites an address into a shared space she owns. The link's secret is returned once and only its
 * hash is kept; Jarvis does not send it — she does.
 */
export async function invite(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; email: string },
): Promise<{ invitationId: string; token: string; expiresAt: string }> {
  const space = await spaceOf(tx, input.spaceId);
  if (space.personal) {
    throw new Error('Her own space stays private: create a shared space to invite someone.');
  }
  if (space.role !== 'owner') throw new Error('Only an owner invites into a space.');
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(`« ${input.email} » is no e-mail address.`);
  const id = prefixedId('inv');
  const token = randomBytes(24).toString('base64url');
  const { rows } = await tx.query<{ expires_at: string }>(
    `insert into invitation (id, space_id, email, token_hash, invited_by, expires_at)
     values ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
     returning to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at`,
    [id, input.spaceId, email, hashOf(token), actor.person, INVITATION_DAYS],
  );
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'space.invite',
    target: id,
    before: null,
    after: { email, expires_at: rows[0]!.expires_at },
  });
  return { invitationId: id, token, expiresAt: rows[0]!.expires_at };
}

/** The invitations of a space she belongs to, newest first. */
export async function invitationsOf(tx: Tx, spaceId: string): Promise<Invitation[]> {
  const { rows } = await tx.query<Invitation>(
    `select id, email,
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
            to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiresAt",
            case when withdrawn_at is not null then 'withdrawn' when accepted_at is not null then 'used'
                 when expires_at < now() then 'expired' else 'open' end as state
       from invitation where space_id = $1 order by created_at desc`,
    [spaceId],
  );
  return rows;
}

/** Withdraws an open invitation of a space she owns. */
export async function withdrawInvitation(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; invitationId: string },
): Promise<void> {
  const { rowCount } = await tx.query(
    `update invitation set withdrawn_at = now()
      where id = $1 and space_id = $2 and withdrawn_at is null and accepted_at is null`,
    [input.invitationId, input.spaceId],
  );
  if (!rowCount) throw new Error(`No open invitation ${input.invitationId} she may withdraw.`);
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'space.withdraw',
    target: input.invitationId,
    before: null,
    after: { withdrawn: true },
  });
}

/** What a link shows before it is accepted: the space's name, the address, its state. */
export async function previewInvitation(
  tx: Tx,
  token: string,
): Promise<{ spaceName: string; email: string; state: Invitation['state'] } | null> {
  const { rows } = await tx.query<{
    space_name: string;
    email: string;
    state: Invitation['state'];
  }>('select space_name, email, state from jarvis_invitation_preview($1)', [hashOf(token)]);
  const row = rows[0];
  return row ? { spaceName: row.space_name, email: row.email, state: row.state } : null;
}

/** She accepts an invitation sent to the address she is signed in with, and joins the space. */
export async function acceptInvitation(
  tx: Tx,
  actor: Actor,
  input: { token: string; email: string },
): Promise<Space> {
  const { rows } = await tx.query<{ space_id: string }>(
    'select jarvis_accept_invitation($1, $2) as space_id',
    [hashOf(input.token), input.email.trim().toLowerCase()],
  );
  const spaceId = rows[0]!.space_id;
  await record(tx, actor, {
    spaceId,
    command: 'space.join',
    target: actor.person,
    before: null,
    after: { person: actor.person, role: 'member' },
  });
  return spaceOf(tx, spaceId);
}

/**
 * She leaves a shared space, or an owner removes someone from it. Nothing in it is erased. An owner
 * who leaves while others stay hands the space to its oldest member; the last member cannot leave.
 */
export async function leaveSpace(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; person?: string },
): Promise<void> {
  const space = await spaceOf(tx, input.spaceId);
  if (space.personal) throw new Error('Her own space cannot be left.');
  const person = input.person ?? actor.person;
  const members = await membersOf(tx, input.spaceId);
  const leaving = members.find((one) => one.person === person);
  if (!leaving) throw new Error(`No member ${person} in this space.`);
  if (person !== actor.person && space.role !== 'owner') {
    throw new Error('Only an owner removes someone from a space.');
  }
  const staying = members.filter((one) => one.person !== person);
  if (staying.length === 0) {
    throw new Error(
      'She is its last member: nothing would reach it any more. Keep it, or export it.',
    );
  }
  if (leaving.role === 'owner' && !staying.some((one) => one.role === 'owner')) {
    await tx.query("update member set role = 'owner' where space_id = $1 and person_id = $2", [
      input.spaceId,
      staying[0]!.person,
    ]);
  }
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'space.leave',
    target: person,
    before: { person, role: leaving.role },
    after: null,
  });
  await tx.query('delete from member where space_id = $1 and person_id = $2', [
    input.spaceId,
    person,
  ]);
}

/**
 * What a member may do in a shared space (spec 016): `owner`, `member` (reads and writes) or
 * `viewer` (reads only). Only an owner changes it; a space keeps at least one owner.
 */
export async function setRole(
  tx: Tx,
  actor: Actor,
  input: { spaceId: string; person: string; role: 'owner' | 'member' | 'viewer' },
): Promise<void> {
  const space = await spaceOf(tx, input.spaceId);
  if (space.personal) throw new Error('Her own space has her alone.');
  if (space.role !== 'owner') throw new Error('Only an owner changes what a member may do.');
  const members = await membersOf(tx, input.spaceId);
  const one = members.find((member) => member.person === input.person);
  if (!one) throw new Error(`No member ${input.person} in this space.`);
  if (
    one.role === 'owner' &&
    input.role !== 'owner' &&
    !members.some((member) => member.person !== input.person && member.role === 'owner')
  ) {
    throw new Error('A space keeps at least one owner.');
  }
  await tx.query('update member set role = $3 where space_id = $1 and person_id = $2', [
    input.spaceId,
    input.person,
    input.role,
  ]);
  await record(tx, actor, {
    spaceId: input.spaceId,
    command: 'space.role',
    target: input.person,
    before: { person: input.person, role: one.role },
    after: { person: input.person, role: input.role },
  });
}

/**
 * The spaces a client may reach for her: those she allowed it, still hers. A client with no
 * allowance recorded (connected before spaces were shared) reaches her own space only.
 */
export async function clientSpaces(tx: Tx, clientId: string): Promise<Space[]> {
  const all = await spacesOf(tx);
  const { rows } = await tx.query<{ space_id: string }>(
    'select space_id from client_space where person_id = jarvis_person() and client_id = $1',
    [clientId],
  );
  if (rows.length === 0) return all.filter((one) => one.personal).slice(0, 1);
  const allowed = new Set(rows.map((row) => row.space_id));
  return all.filter((one) => allowed.has(one.id));
}

/** Sets the spaces a client may reach for her (at consent, or from her account). */
export async function allowSpaces(tx: Tx, clientId: string, spaceIds: string[]): Promise<Space[]> {
  const all = await spacesOf(tx);
  const wanted = all.filter((one) => spaceIds.includes(one.id));
  if (wanted.length !== new Set(spaceIds).size)
    throw new Error('Some of these spaces are not hers.');
  await tx.query('delete from client_space where person_id = jarvis_person() and client_id = $1', [
    clientId,
  ]);
  for (const space of wanted) {
    await tx.query(
      'insert into client_space (person_id, client_id, space_id) values (jarvis_person(), $1, $2)',
      [clientId, space.id],
    );
  }
  return wanted;
}

/** Adds one space to what a client may reach (a space that client just created). */
export async function allowSpace(tx: Tx, clientId: string, spaceId: string): Promise<void> {
  const current = await tx.query<{ space_id: string }>(
    'select space_id from client_space where person_id = jarvis_person() and client_id = $1',
    [clientId],
  );
  // Before any allowance, the client reached her own space: keep it so.
  const base = current.rows.length
    ? current.rows.map((row) => row.space_id)
    : (await clientSpaces(tx, clientId)).map((one) => one.id);
  await allowSpaces(tx, clientId, [...new Set([...base, spaceId])]);
}
