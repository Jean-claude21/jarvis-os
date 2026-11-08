import { beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  allowSpaces,
  clientSpaces,
  createSharedSpace,
  find,
  history,
  invitationsOf,
  invite,
  kinds,
  leaveSpace,
  membersOf,
  previewInvitation,
  query,
  save,
  spacesOf,
  undo,
  withdrawInvitation,
} from '../src';
import { person, type Person } from './people';

// Spec 004: a space is a circle of people (decision 0005). Ama and Kossi share « Nous »; each keeps
// « Moi », where the other never reaches.
let ama: Person;
let kossi: Person;
let afi: Person;
let nous: string;
const kossiMail = 'kossi@jarvis.test';

beforeAll(async () => {
  ama = await person('Ama');
  kossi = await person('Kossi');
  afi = await person('Afi');
  nous = (await ama.as((tx) => createSharedSpace(tx, ama.actor, { name: 'Nous' }))).id;
  await ama.as((tx) =>
    save(tx, ama.actor, ama.space, { entries: [{ kind: 'Journal', title: 'Mon secret' }] }),
  );
});

describe('a shared space by invitation (story 1)', () => {
  it('makes her own space private and the shared one hers to own', async () => {
    const spaces = await ama.as((tx) => spacesOf(tx));
    expect(spaces.map((one) => [one.id, one.role, one.personal])).toEqual([
      [ama.space, 'owner', true],
      [nous, 'owner', false],
    ]);
  });

  it('never invites into her own space, and only an owner invites', async () => {
    await expect(
      ama.as((tx) => invite(tx, ama.actor, { spaceId: ama.space, email: kossiMail })),
    ).rejects.toThrow(/private/);
    await expect(
      kossi.as((tx) => invite(tx, kossi.actor, { spaceId: nous, email: 'x@jarvis.test' })),
    ).rejects.toThrow(/No space/);
  });

  it('lets the invited address join once, and refuses any other', async () => {
    const { token, expiresAt } = await ama.as((tx) =>
      invite(tx, ama.actor, { spaceId: nous, email: 'Kossi@Jarvis.test' }),
    );
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect(await afi.as((tx) => previewInvitation(tx, token))).toEqual({
      spaceName: 'Nous',
      email: kossiMail,
      state: 'open',
    });
    await expect(
      afi.as((tx) => acceptInvitation(tx, afi.actor, { token, email: 'afi@jarvis.test' })),
    ).rejects.toThrow(/another address/);
    const joined = await kossi.as((tx) =>
      acceptInvitation(tx, kossi.actor, { token, email: kossiMail }),
    );
    expect(joined).toMatchObject({ id: nous, role: 'member', personal: false });
    await expect(
      kossi.as((tx) => acceptInvitation(tx, kossi.actor, { token, email: kossiMail })),
    ).rejects.toThrow(/already used/);
    expect((await ama.as((tx) => membersOf(tx, nous))).map((one) => one.person)).toEqual([
      ama.id,
      kossi.id,
    ]);
  });

  it('withdraws an invitation, which then opens nothing', async () => {
    const { token, invitationId } = await ama.as((tx) =>
      invite(tx, ama.actor, { spaceId: nous, email: 'afi@jarvis.test' }),
    );
    await ama.as((tx) => withdrawInvitation(tx, ama.actor, { spaceId: nous, invitationId }));
    expect((await ama.as((tx) => invitationsOf(tx, nous)))[0]!.state).toBe('withdrawn');
    await expect(
      afi.as((tx) => acceptInvitation(tx, afi.actor, { token, email: 'afi@jarvis.test' })),
    ).rejects.toThrow(/withdrawn/);
  });

  it('shares « Nous » both ways, and never her « Moi »', async () => {
    await kossi.as((tx) =>
      save(tx, kossi.actor, nous, {
        entries: [{ kind: 'Dépense', title: 'Courses', data: { montant: 12000 } }],
      }),
    );
    expect((await ama.as((tx) => find(tx, nous, {}))).map((one) => one.title)).toEqual(['Courses']);
    expect(await kossi.as((tx) => find(tx, ama.space, {}))).toEqual([]);
    const sees = await kossi.as((tx) =>
      query(tx, { spaceIds: [kossi.space, nous, ama.space], sql: 'select title from my_entries' }),
    );
    expect(sees.rows).toEqual([{ title: 'Courses' }]);
  });

  it('journals who belongs, and does not undo it', async () => {
    const lines = await ama.as((tx) => history(tx, nous));
    expect(lines.map((line) => line.command)).toEqual(
      expect.arrayContaining(['space.create', 'space.invite', 'space.join', 'space.withdraw']),
    );
    const join = lines.find((line) => line.command === 'space.join')!;
    expect(join.actor).toBe(kossi.id);
    await expect(
      ama.as((tx) => undo(tx, ama.actor, { spaceId: nous, journalId: join.id })),
    ).rejects.toThrow(/not undone/);
  });
});

describe('a query over every space she may reach (story 2)', () => {
  it('names the space of each row', async () => {
    const result = await ama.as((tx) =>
      query(tx, {
        spaceIds: [ama.space, nous],
        sql: 'select space, title from my_entries order by title',
      }),
    );
    expect(result.rows).toEqual([
      { space: 'Nous', title: 'Courses' },
      { space: 'Ama', title: 'Mon secret' },
    ]);
  });
});

describe('the spaces a client may reach (story 3)', () => {
  it('gives a client nothing but her own space until she allows more', async () => {
    expect((await ama.as((tx) => clientSpaces(tx, 'claude'))).map((one) => one.id)).toEqual([
      ama.space,
    ]);
    await ama.as((tx) => allowSpaces(tx, 'claude', [ama.space, nous]));
    expect((await ama.as((tx) => clientSpaces(tx, 'claude'))).map((one) => one.id)).toEqual([
      ama.space,
      nous,
    ]);
    await expect(ama.as((tx) => allowSpaces(tx, 'claude', [kossi.space]))).rejects.toThrow(
      /not hers/,
    );
  });
});

describe('one kind, case and accents aside (story 5)', () => {
  it('keeps the kind as first written', async () => {
    await ama.as((tx) =>
      save(tx, ama.actor, ama.space, {
        entries: [
          { kind: 'dépense', title: 'Pain' },
          { kind: 'Dépense', title: 'Lait' },
          { kind: 'DEPENSE', title: 'Oeufs' },
        ],
      }),
    );
    const all = await ama.as((tx) => kinds(tx, ama.space));
    expect(all.find((one) => one.kind === 'dépense')!.count).toBe(3);
    expect(all.some((one) => one.kind === 'Dépense')).toBe(false);
    expect(await ama.as((tx) => find(tx, ama.space, { kind: 'Depense' }))).toHaveLength(3);
  });
});

describe('leaving (story 1)', () => {
  it('lets Kossi leave without erasing anything, and hands an owner’s space on', async () => {
    await kossi.as((tx) => leaveSpace(tx, kossi.actor, { spaceId: nous }));
    expect(await kossi.as((tx) => find(tx, nous, {}))).toEqual([]);
    expect((await ama.as((tx) => find(tx, nous, {}))).map((one) => one.title)).toEqual(['Courses']);
    await expect(ama.as((tx) => leaveSpace(tx, ama.actor, { spaceId: nous }))).rejects.toThrow(
      /last member/,
    );
    await expect(ama.as((tx) => leaveSpace(tx, ama.actor, { spaceId: ama.space }))).rejects.toThrow(
      /cannot be left/,
    );

    const { token } = await ama.as((tx) =>
      invite(tx, ama.actor, { spaceId: nous, email: 'afi@jarvis.test' }),
    );
    await afi.as((tx) => acceptInvitation(tx, afi.actor, { token, email: 'afi@jarvis.test' }));
    await ama.as((tx) => leaveSpace(tx, ama.actor, { spaceId: nous }));
    expect(await afi.as((tx) => membersOf(tx, nous))).toMatchObject([
      { person: afi.id, role: 'owner' },
    ]);
  });
});
