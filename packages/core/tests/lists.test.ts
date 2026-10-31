import { beforeAll, describe, expect, it } from 'vitest';
import {
  changeEntries,
  dayOf,
  folderOf,
  get,
  groupKind,
  history,
  kinds,
  listEntries,
  listStats,
  renameKind,
  save,
  undo,
  weekdaysOf,
} from '../src';
import { person, type Person } from './people';

// Spec 017: the day and folder of any entry, lists filtered and sorted, statistics without a
// model (a streak of prayers), groups of kinds, a kind renamed and entries filed at once.
let ama: Person;
const clock = { now: new Date('2026-10-30T10:00:00Z'), zone: 'Africa/Abidjan' };
const saving = (input: Parameters<typeof save>[3]) =>
  ama.as((tx) => save(tx, ama.actor, ama.space, input));

beforeAll(async () => {
  ama = await person('Ama');
  const prayers = ['2026-10-30', '2026-10-29', '2026-10-28', '2026-10-25', '2026-10-24'];
  await saving({
    entries: [
      ...prayers.map((date, index) => ({
        kind: 'Prière',
        title: `Prière ${date}`,
        data: { date, at: `${date}T05:${10 + index}`, moment: index % 2 ? 'soir' : 'matin' },
      })),
      {
        kind: 'Bilan',
        title: 'Bilan Mensuel — Mai 2026',
        data: { source: 'vie/2026/2026-05/bilans/bilan-mai.md', text: 'Mai.' },
      },
      {
        kind: 'Bilan',
        title: 'Bilan W33',
        data: { source: 'vie/2026/2026-08/bilans/W33.md' },
      },
      { kind: 'document', title: 'Notions', data: { source: 'cultures/permis/notions.md' } },
    ],
  });
});

describe('the day and folder of an entry', () => {
  it('reads its own field, then its path, then its title', () => {
    const made = '2026-10-29T00:00:00Z';
    expect(dayOf({ title: 'x', data: { date: '2026-10-01' }, createdAt: made })).toEqual({
      day: '2026-10-01',
      from: 'field',
    });
    expect(dayOf({ title: '2026 10 01', data: {}, createdAt: made }).day).toBe('2026-10-01');
    expect(
      dayOf({
        title: 'Bilan W33',
        data: { source: 'vie/2026/2026-08/bilans/W33.md' },
        createdAt: made,
      }).day,
    ).toBe('2026-08-10');
    expect(dayOf({ title: 'Bilan Mensuel — Mai 2026', data: {}, createdAt: made })).toEqual({
      day: '2026-05',
      from: 'title',
    });
    expect(dayOf({ title: 'Rien', data: {}, createdAt: made })).toEqual({
      day: '2026-10-29',
      from: 'made',
    });
    expect(folderOf({ source: 'vie/2026/2026-05/bilans/bilan-mai.md' })).toBe(
      'vie/2026/2026-05/bilans',
    );
    expect(folderOf({ folder: '/Bilans/Mensuels/', source: 'a/b.md' })).toBe('Bilans/Mensuels');
  });
});

describe('a list', () => {
  it('is sorted by its own day and filtered by period and folder', async () => {
    const list = await ama.as((tx) => listEntries(tx, ama.space, { kind: 'bilan' }, clock));
    expect(list.rows.map((one) => one.title)).toEqual(['Bilan W33', 'Bilan Mensuel — Mai 2026']);
    const may = await ama.as((tx) =>
      listEntries(tx, ama.space, { from: '2026-05-01', to: '2026-05-31' }, clock),
    );
    expect(may.rows.map((one) => one.title)).toEqual(['Bilan Mensuel — Mai 2026']);
    const folder = await ama.as((tx) =>
      listEntries(tx, ama.space, { folder: 'vie/2026/2026-08' }, clock),
    );
    expect(folder.rows.map((one) => one.title)).toEqual(['Bilan W33']);
  });

  it('counts a streak, the hours and the repeated values, without a model', async () => {
    const stats = await ama.as((tx) => listStats(tx, ama.space, { kind: 'Prière' }, clock));
    expect(stats.total).toBe(5);
    expect(stats.thisMonth).toBe(5);
    expect(stats.streak).toEqual({ current: 3, best: 3 });
    expect(stats.active30).toBe(5);
    expect(stats.hours?.[5]).toBe(5);
    expect(stats.days).toHaveLength(82);
    expect(stats.splits).toEqual([
      {
        field: 'moment',
        label: null,
        counts: [
          { option: 'matin', label: null, n: 3 },
          { option: 'soir', label: null, n: 2 },
        ],
      },
    ]);
  });
});

describe('her kinds', () => {
  it('are grouped as she says, Jarvis’s own apart', async () => {
    await ama.as((tx) =>
      groupKind(tx, ama.actor, ama.space, { kind: 'Prière', group: 'Spirituel' }),
    );
    await ama.as((tx) => groupKind(tx, ama.actor, ama.space, { kind: 'Bilan', group: 'Pilotage' }));
    await ama.as((tx) =>
      groupKind(tx, ama.actor, ama.space, { kind: 'Prière', group: 'Pilotage' }),
    );
    const all = await ama.as((tx) => kinds(tx, ama.space));
    const of = (kind: string) => all.find((one) => one.kind === kind);
    expect(of('Prière')?.group).toBe('Pilotage');
    expect(of('Bilan')?.group).toBe('Pilotage');
    expect(of('Area')?.system).toBe(true);
    await expect(
      saving({ entries: [{ kind: 'Area', title: 'Bad', data: { kinds: 'Prière' } }] }),
    ).rejects.toThrow(/Area/);
  });

  it('is renamed with all its entries, undone at once', async () => {
    const renamed = await ama.as((tx) =>
      renameKind(tx, ama.actor, ama.space, { from: 'document', to: 'Document' }),
    );
    expect(renamed).toEqual({ kind: 'Document', entries: 1 });
    const all = await ama.as((tx) => kinds(tx, ama.space));
    expect(all.map((one) => one.kind)).toContain('Document');
    const [line] = await ama.as((tx) => history(tx, ama.space, { limit: 1 }));
    expect(line?.command).toBe('kind.rename');
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: line!.id }));
    expect((await ama.as((tx) => kinds(tx, ama.space))).map((one) => one.kind)).toContain(
      'document',
    );
  });

  it('files many entries in a folder at once, undone at once', async () => {
    const list = await ama.as((tx) => listEntries(tx, ama.space, { kind: 'Bilan' }, clock));
    const ids = list.rows.map((one) => one.id);
    await ama.as((tx) =>
      changeEntries(tx, ama.actor, ama.space, { ids, folder: 'Bilans/Mensuels' }),
    );
    const filed = await ama.as((tx) => listEntries(tx, ama.space, { folder: 'Bilans' }, clock));
    expect(filed.total).toBe(2);
    const [line] = await ama.as((tx) => history(tx, ama.space, { limit: 1 }));
    expect(line?.command).toBe('entries.change');
    await ama.as((tx) => undo(tx, ama.actor, { spaceId: ama.space, journalId: line!.id }));
    const back = await ama.as((tx) => get(tx, ama.space, ids[0]!));
    expect(back?.data.folder).toBeUndefined();
  });
});

describe('a habit', () => {
  it('reads its days in her words, or gives none', () => {
    expect(weekdaysOf('7/7')).toHaveLength(7);
    expect(weekdaysOf('lun-ven')).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(weekdaysOf('mar,mer,sam')).toEqual(['tue', 'wed', 'sat']);
    expect(weekdaysOf(['mon', 'sun'])).toEqual(['mon', 'sun']);
    expect(weekdaysOf('quotidien')).toHaveLength(7);
    expect(weekdaysOf('5/7')).toBeNull();
    expect(weekdaysOf('coucher 22:00')).toBeNull();
  });

  it('is kept as planned against the entries linked to it', async () => {
    const saved = await saving({
      entries: [
        {
          kind: 'Habitude',
          title: 'Prière',
          data: { jours: '7/7', depuis: '2026-10-24', text: 'Chaque matin.' },
        },
      ],
    });
    const habit = saved.entries[0]!.id;
    const prayers = await ama.as((tx) => listEntries(tx, ama.space, { kind: 'Prière' }, clock));
    await ama.as((tx) =>
      changeEntries(tx, ama.actor, ama.space, {
        ids: prayers.rows.map((one) => one.id),
        link: { to: habit, role: 'for' },
      }),
    );
    // From 24 Oct to today (30 Oct, done): seven days planned; done 24, 25, 28, 29, 30.
    const stats = await ama.as((tx) => listStats(tx, ama.space, { kind: 'Prière' }, clock));
    expect(stats.habits).toEqual([
      expect.objectContaining({
        title: 'Prière',
        planned: 7,
        done: 5,
        rate: 71.4,
        missed: ['2026-10-27', '2026-10-26'],
      }),
    ]);
    const ofHabits = await ama.as((tx) => listStats(tx, ama.space, { kind: 'Habitude' }, clock));
    expect(ofHabits.habits[0]).toEqual(expect.objectContaining({ done: 5, planned: 7 }));
  });
});
