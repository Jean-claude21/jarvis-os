import { beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  addFile,
  collectionStats,
  collectionsOf,
  createSharedSpace,
  createShare,
  find,
  formulaValue,
  get,
  invite,
  press,
  runView,
  save,
  setRole,
  sharedPage,
  shareOf,
  submitShare,
  type Blobs,
} from '../src';
import { db, person, type Person } from './people';

// Spec 016: the types of every day, field options, distance and currencies, rules on a linked
// entry, buttons, collections and their statistics, map / gallery / timeline / tree, shares, viewers.
let ama: Person;
const ids: Record<string, string> = {};
const clock = { now: new Date('2026-10-30T10:00:00Z'), zone: 'Africa/Abidjan' };
const blobs: Blobs = {
  put: async () => undefined,
  get: async () => new Uint8Array(),
  link: async () => 'x',
  remove: async () => undefined,
} as unknown as Blobs;

const saving = (input: Parameters<typeof save>[3]) =>
  ama.as((tx) => save(tx, ama.actor, ama.space, input));

beforeAll(async () => {
  ama = await person('Ama');
  const saved = await saving({
    entries: [
      {
        kind: 'Model',
        title: 'Company',
        data: {
          fields: [
            { name: 'city', type: 'text' },
            { name: 'place', type: 'location' },
          ],
        },
      },
      {
        kind: 'Model',
        title: 'Application',
        data: {
          fields: [
            { name: 'offer', type: 'url', unique: true },
            { name: 'contact', type: 'email' },
            { name: 'phone', type: 'phone' },
            {
              name: 'state',
              type: 'choice',
              options: ['to_apply', 'applied', 'interview', 'offer', 'rejected'],
              optionLabels: { applied: { fr: 'postulé' } },
            },
            { name: 'tags', type: 'multi_choice', options: ['remote', 'data', 'urgent'] },
            { name: 'interest', type: 'rating' },
            { name: 'progress', type: 'progress' },
            { name: 'applied_on', type: 'date', default: '=today()' },
            { name: 'call_at', type: 'time' },
            { name: 'notes', type: 'long_text' },
            { name: 'salary', type: 'amount', unit: 'EUR', min: 0, max: 5000 },
            { name: 'company', type: 'link', target: 'Company', inverse: 'applications' },
            { name: 'cv', type: 'file' },
            {
              name: 'relaunch',
              type: 'button',
              action: { set: { state: 'applied', progress: '=progress + 10' } },
            },
            { name: 'distance', type: 'formula', formula: "distance(company.place, '') " },
          ],
        },
      },
      {
        ref: 'k',
        kind: 'Company',
        title: 'Kora Labs',
        data: { city: 'Abidjan', place: { address: 'Cocody', lat: 5.36, lng: -3.99 } },
      },
      {
        ref: 'n',
        kind: 'Company',
        title: 'Atelier Nova',
        data: { city: 'Dakar', place: { lat: 14.69, lng: -17.44 } },
      },
    ],
  });
  for (const one of saved.entries) ids[one.title] = one.id;
});

describe('the types of every day', () => {
  it('check each value and say what to write', async () => {
    await expect(
      saving({
        entries: [
          {
            kind: 'Application',
            title: 'Bad',
            data: {
              offer: 'kora',
              contact: 'nobody',
              phone: 'x',
              tags: ['remote', 'cooking'],
              interest: 7,
              progress: 120,
              call_at: '25:00',
              salary: -3,
            },
          },
        ],
      }),
    ).rejects.toThrow(
      /« offer » must be a link.*« contact » must be an address.*« phone » must be a number.*« tags » must be a list among.*« interest » must be a whole number from 0 to 5.*« progress » must be a percentage.*« call_at » must be a time of day.*« salary » must be at least 0/,
    );
    await expect(
      saving({ entries: [{ kind: 'Application', title: 'X', data: { relaunch: true } }] }),
    ).rejects.toThrow(/pressed, never written/);
  });

  it('take a default, keep a value unique, and want a real file', async () => {
    const saved = await saving({
      entries: [
        {
          kind: 'Application',
          title: 'Data intern',
          data: {
            offer: 'https://kora.example/jobs/42',
            contact: 'rh@kora.example',
            phone: '+225 07 00 00 00',
            state: 'to_apply',
            tags: ['data', 'remote'],
            interest: 5,
            progress: 20,
            call_at: '09:30',
            salary: 600,
            company: ids['Kora Labs'],
          },
        },
      ],
    });
    ids.intern = saved.entries[0]!.id;
    const entry = await ama.as((tx) => get(tx, ama.space, ids.intern!));
    expect(entry?.data.applied_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(
      saving({
        entries: [
          { kind: 'Application', title: 'Twice', data: { offer: 'HTTPS://KORA.EXAMPLE/JOBS/42' } },
        ],
      }),
    ).rejects.toThrow(/« offer » is unique, and « Data intern » already has it/);
    await expect(
      saving({ entries: [{ id: ids.intern, data: { cv: 'ent_nothing' } }] }),
    ).rejects.toThrow(/no file ent_nothing/);
    const file = await ama.as((tx) =>
      addFile(tx, ama.actor, blobs, {
        spaceId: ama.space,
        name: 'cv.pdf',
        mediaType: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3]),
      }),
    );
    await saving({ entries: [{ id: ids.intern, data: { cv: file.entryId } }] });
  });
});

describe('formulas', () => {
  it('measure a distance and convert a currency', async () => {
    const scope = {
      get: (name: string) =>
        ({ home: { lat: 5.36, lng: -3.99 }, work: { lat: 5.32, lng: -4.02 } })[name] ?? null,
    };
    expect(await formulaValue('distance(home, work)', scope, clock)).toBeCloseTo(5.5, 0);
    expect(await formulaValue("convert(100, 'EUR', 'XOF')", scope, clock)).toBe(65595.7);
    expect(await formulaValue("convert(65595.7, 'XOF', 'EUR')", scope, clock)).toBe(100);
    expect(
      await formulaValue("convert(100, 'EUR', 'USD')", scope, { ...clock, rates: { USD: 1.08 } }),
    ).toBe(108);
    expect(await formulaValue("convert(100, 'EUR', 'GHS')", scope, clock)).toBeNull();
  });
});

describe('a button and a rule on a linked entry', () => {
  it('press sets fields from formulas, journaled', async () => {
    await ama.as((tx) =>
      press(tx, ama.actor, ama.space, { entryId: ids.intern!, field: 'relaunch' }),
    );
    const entry = await ama.as((tx) => get(tx, ama.space, ids.intern!));
    expect(entry?.data).toMatchObject({ state: 'applied', progress: 30 });
    await expect(
      ama.as((tx) => press(tx, ama.actor, ama.space, { entryId: ids.intern!, field: 'state' })),
    ).rejects.toThrow(/not a button/);
  });

  it('a rule updates the entry it links to', async () => {
    await saving({
      entries: [
        { kind: 'Model', title: 'Product', data: { fields: [{ name: 'stock', type: 'number' }] } },
        {
          kind: 'Model',
          title: 'Order',
          data: {
            fields: [
              { name: 'quantity', type: 'number' },
              { name: 'product', type: 'link', target: 'Product' },
            ],
          },
        },
        { ref: 'p', kind: 'Product', title: 'Savon', data: { stock: 10 } },
        {
          kind: 'Rule',
          title: 'Stock',
          data: {
            when: { saved: 'Order' },
            then: [{ update: { on: 'product', set: { stock: '=stock - quantity' } } }],
          },
        },
      ],
    });
    const [savon] = await ama.as((tx) => find(tx, ama.space, { kind: 'Product' }));
    await saving({
      entries: [{ kind: 'Order', title: 'Commande 1', data: { quantity: 3, product: savon!.id } }],
    });
    expect((await ama.as((tx) => get(tx, ama.space, savon!.id)))?.data.stock).toBe(7);
  });
});

describe('a collection', () => {
  it('opens on its own, with its statistics from its model', async () => {
    await saving({
      entries: [
        {
          kind: 'Application',
          title: 'Product assistant',
          data: {
            offer: 'https://nova.example/careers',
            state: 'interview',
            tags: ['remote'],
            interest: 3,
            salary: 400,
            company: ids['Atelier Nova'],
            applied_on: '2026-10-20',
          },
        },
        {
          kind: 'Application',
          title: 'Analyst',
          data: { state: 'rejected', interest: 4, salary: 500, applied_on: '2026-09-01' },
        },
      ],
    });
    const list = await ama.as((tx) => collectionsOf(tx, ama.space));
    expect(list.find((one) => one.kind === 'Application')).toMatchObject({ count: 3 });
    const stats = await ama.as((tx) => collectionStats(tx, ama.space, 'application', clock));
    expect(stats.total).toBe(3);
    expect(
      stats.splits.find((one) => one.field === 'state')?.counts.filter((one) => one.n),
    ).toEqual([
      { option: 'applied', label: { fr: 'postulé' }, n: 1 },
      { option: 'interview', label: null, n: 1 },
      { option: 'rejected', label: null, n: 1 },
    ]);
    expect(
      stats.splits
        .find((one) => one.field === 'tags')
        ?.counts.find((one) => one.option === 'remote')?.n,
    ).toBe(2);
    expect(stats.figures).toEqual(
      expect.arrayContaining([
        { field: 'interest', label: null, kind: 'avg', value: 4, unit: null },
        { field: 'salary', label: null, kind: 'sum', value: 1500, unit: 'EUR' },
      ]),
    );
    expect(stats.weeks?.field).toBe('applied_on');
    expect(stats.weeks?.points).toHaveLength(8);
  });

  it('shows on a map, in a gallery, on a timeline, as a tree', async () => {
    const map = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Company', type: 'map' }, clock),
    );
    expect(map.types).toContain('map');
    expect(map.map?.items.map((one) => one.title).sort()).toEqual(['Atelier Nova', 'Kora Labs']);
    const gallery = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Application', type: 'gallery' }, clock),
    );
    expect(gallery.gallery?.items.find((one) => one.title === 'Data intern')?.file).toMatch(
      /^ent_/,
    );
    const timeline = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Application', type: 'timeline' }, clock),
    );
    expect(timeline.timeline?.items[0]).toMatchObject({
      title: 'Analyst',
      start: '2026-09-01',
      end: '2026-09-01',
    });
    await saving({
      entries: [
        {
          kind: 'Model',
          title: 'Task',
          data: {
            fields: [
              { name: 'parent', type: 'link', target: 'Task' },
              { name: 'start', type: 'date' },
              { name: 'end', type: 'date' },
            ],
          },
        },
        {
          ref: 'h',
          kind: 'Task',
          title: 'House',
          data: { start: '2026-11-01', end: '2026-12-15' },
        },
        {
          ref: 'r',
          kind: 'Task',
          title: 'Roof',
          data: { parent: 'h', start: '2026-11-03', end: '2026-11-20' },
        },
        { kind: 'Task', title: 'Tiles', data: { parent: 'r' } },
      ],
    });
    const tree = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Task', type: 'tree' }, clock),
    );
    expect(tree.tree?.rows.map((row) => [row.title, row.depth])).toEqual([
      ['House', 0],
      ['Roof', 1],
      ['Tiles', 2],
    ]);
    const gantt = await ama.as((tx) =>
      runView(tx, ama.space, { kind: 'Task', type: 'timeline' }, clock),
    );
    expect(gantt.timeline?.items[0]).toMatchObject({
      title: 'House',
      start: '2026-11-01',
      end: '2026-12-15',
    });
  });
});

describe('a share', () => {
  it('opens a public form that adds what someone sends, from outside, waiting for her', async () => {
    const made = await ama.as((tx) =>
      createShare(tx, ama.actor, ama.space, {
        name: 'Candidature spontanée',
        data: { mode: 'form', kind: 'Application', fields: ['contact', 'phone', 'notes'] },
      }),
    );
    const found = await shareOf(db, made.key);
    expect(found).toMatchObject({ person: ama.id, spaceId: ama.space, entryId: made.id });
    expect(await shareOf(db, 'x'.repeat(24))).toBeNull();
    const page = await ama.as((tx) => sharedPage(tx, ama.space, made.id));
    expect(page.fields?.map((one) => one.name)).toEqual(['contact', 'phone', 'notes']);
    await expect(
      ama.as((tx) =>
        submitShare(tx, ama.space, ama.id, made.id, { title: 'Kofi', data: { salary: 9 } }),
      ),
    ).rejects.toThrow(/not asked by this form/);
    const sent = await ama.as((tx) =>
      submitShare(tx, ama.space, ama.id, made.id, {
        title: 'Kofi',
        data: { contact: 'kofi@example.org', notes: 'Bonjour' },
      }),
    );
    const entry = await ama.as((tx) => get(tx, ama.space, sent.id));
    expect(entry?.data).toMatchObject({ contact: 'kofi@example.org', status: 'proposed' });
    expect(entry?.origin.contact).toBe('read');
    await saving({ entries: [{ id: made.id, data: { active: false } }] });
    expect(await shareOf(db, made.key)).toBeNull();
  });

  it('shows a view, read-only', async () => {
    const made = await ama.as((tx) =>
      createShare(tx, ama.actor, ama.space, {
        name: 'Mes candidatures',
        data: { mode: 'view', view: { kind: 'Application', columns: ['state'] } },
      }),
    );
    const page = await ama.as((tx) => sharedPage(tx, ama.space, made.id));
    expect(page.view?.rows.length).toBeGreaterThan(2);
  });
});

describe('a viewer', () => {
  it('reads a shared space and writes nothing', async () => {
    const kofi = await person('Kofi');
    const nous = await ama.as((tx) => createSharedSpace(tx, ama.actor, { name: 'Nous' }));
    await ama.as((tx) =>
      save(tx, ama.actor, nous.id, { entries: [{ kind: 'Note', title: 'Courses' }] }),
    );
    const made = await ama.as((tx) =>
      invite(tx, ama.actor, { spaceId: nous.id, email: 'kofi@example.org' }),
    );
    await kofi.as((tx) =>
      acceptInvitation(tx, kofi.actor, { token: made.token, email: 'kofi@example.org' }),
    );
    await ama.as((tx) =>
      setRole(tx, ama.actor, { spaceId: nous.id, person: kofi.id, role: 'viewer' }),
    );
    expect(await kofi.as((tx) => find(tx, nous.id, {}))).toHaveLength(1);
    await expect(
      kofi.as((tx) =>
        save(tx, kofi.actor, nous.id, { entries: [{ kind: 'Note', title: 'Pirate' }] }),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      kofi.as((tx) =>
        setRole(tx, kofi.actor, { spaceId: nous.id, person: kofi.id, role: 'owner' }),
      ),
    ).rejects.toThrow(/Only an owner/);
  });
});
