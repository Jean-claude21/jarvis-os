import { beforeAll, describe, expect, it } from 'vitest';
import { backupsDue, backupsOf, forgetOldBackups, recordBackup } from '../src';
import { db, person, type Person } from './people';

// Spec 022: a space without its backup of the day is due; once made, it is not; a backup past
// thirty days is forgotten; a space's backups are read by its members only.
describe('the nightly backups', () => {
  let ama: Person;
  let kofi: Person;
  const day = '2026-11-09';

  beforeAll(async () => {
    ama = await person('Ama');
    kofi = await person('Kofi');
  });

  const due = async () =>
    (await backupsDue(db, day, 1_000_000)).find((one) => one.spaceId === ama.space);

  it('finds a space without its backup of the day, with the member who makes it', async () => {
    expect(await due()).toEqual({ spaceId: ama.space, person: ama.id });
    await ama.as((tx) =>
      recordBackup(tx, {
        spaceId: ama.space,
        day,
        storageKey: `backups/${ama.space}/${day}.zip`,
        size: 10,
        files: 1,
      }),
    );
    expect(await due()).toBeUndefined();
  });

  it('forgets a backup past thirty days, and gives its key to remove', async () => {
    const old = '2026-10-09';
    await ama.as((tx) =>
      recordBackup(tx, {
        spaceId: ama.space,
        day: old,
        storageKey: `backups/${ama.space}/${old}.zip`,
        size: 10,
        files: 1,
      }),
    );
    const removed = await ama.as((tx) => forgetOldBackups(tx, ama.space, day));
    expect(removed).toEqual([`backups/${ama.space}/${old}.zip`]);
    expect((await ama.as((tx) => backupsOf(tx, ama.space))).map((one) => one.day)).toEqual([day]);
  });

  it('shows a space’s backups to its members only', async () => {
    expect(await kofi.as((tx) => backupsOf(tx, ama.space))).toEqual([]);
    await expect(
      kofi.as((tx) =>
        recordBackup(tx, {
          spaceId: ama.space,
          day: '2026-11-08',
          storageKey: 'x',
          size: 1,
          files: 1,
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
