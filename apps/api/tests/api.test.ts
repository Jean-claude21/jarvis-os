import { beforeAll, describe, expect, it } from 'vitest';
import { PUBLIC_URL, server, signUp, type Account } from './client';

// Spec 002, stories 1, 2 and 4: an account and a life; her life over HTTP; one account never
// reaches another.
let ama: Account;
let kossi: Account;

beforeAll(async () => {
  ama = await signUp('Ama');
  kossi = await signUp('Kossi');
});

interface Saved {
  entries: { ref: string; id: string }[];
  links: { id: string }[];
}

describe('an account and a life (story 1)', () => {
  it('makes her space with her account', async () => {
    const { status, body } = await ama.json<{ person: { email: string }; space: { id: string } }>(
      '/api/me',
    );
    expect(status).toBe(200);
    expect(body.person.email).toBe(ama.email);
    expect(body.space.id).toMatch(/^spc_/);
  });

  it('answers 401 without a token, and to a wrong password', async () => {
    expect((await server.app.request('/api/me')).status).toBe(401);
    const wrong = await server.app.request('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: PUBLIC_URL },
      body: JSON.stringify({ email: ama.email, password: 'not-her-password' }),
    });
    expect(wrong.status).toBe(401);
  });
});

describe('her life over HTTP (story 2)', () => {
  it('saves, reads, finds, sums, corrects and undoes', async () => {
    const saved = await ama.json<Saved>('/api/save', {
      entries: [
        {
          ref: 'taxi',
          kind: 'Dépense',
          title: 'Taxi',
          data: { montant: 2000, poste: 'Transport' },
        },
        { ref: 'cash', kind: 'Compte', title: 'Espèces', data: { solde: 15000 } },
      ],
      links: [{ from: 'taxi', to: 'cash', role: 'payé avec' }],
    });
    expect(saved.status).toBe(200);
    const taxi = saved.body.entries[0]!.id;

    const read = await ama.json<{ links: { out: { role: string }[] } }>(`/api/entries/${taxi}`);
    expect(read.body.links.out.map((link) => link.role)).toEqual(['payé avec']);

    const found = await ama.json<{ title: string }[]>('/api/entries?text=transport');
    expect(found.body.map((one) => one.title)).toEqual(['Taxi']);
    const all = await ama.json<{ kind: string }[]>('/api/kinds');
    expect(all.body.map((one) => one.kind).sort()).toEqual(['Compte', 'Dépense']);

    const sum = await ama.json<{ rows: { total: string }[] }>('/api/query', {
      sql: `select sum((data->>'montant')::int) as total from my_entries where kind = 'Dépense'`,
    });
    expect(sum.body.rows).toEqual([{ total: '2000' }]);

    await ama.json('/api/save', { entries: [{ id: taxi, data: { montant: 2500 } }] });
    const lines = await ama.json<{ id: number; command: string }[]>(`/api/history?target=${taxi}`);
    expect(lines.body.map((line) => line.command)).toEqual(['entry.update', 'entry.create']);
    const undone = await ama.json('/api/undo', { journalId: lines.body[0]!.id });
    expect(undone.status).toBe(200);
    const back = await ama.json<{ data: { montant: number } }>(`/api/entries/${taxi}`);
    expect(back.body.data.montant).toBe(2000);

    const archived = await ama.json(`/api/entries/${taxi}/archive`, {});
    expect(archived.status).toBe(200);
    expect((await ama.json<unknown[]>('/api/entries?text=taxi')).body).toEqual([]);
  });

  it('says what is wrong: a malformed body, an unknown entry, a failing query', async () => {
    const malformed = await ama.json<{ error: string }>('/api/save', { entries: [{ kind: '' }] });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toMatch(/entries\.0\.kind/);
    const unknown = await ama.json<{ error: string }>('/api/entries/ent_nowhere');
    expect(unknown.status).toBe(404);
    const wrongSql = await ama.json<{ error: string }>('/api/query', {
      sql: 'select * from entry',
    });
    expect(wrongSql.status).toBe(400);
    expect(wrongSql.body.error).toMatch(/permission denied/);
  });
});

describe('one account never reaches another (story 4)', () => {
  it('shows and changes nothing of Ama’s to Kossi', async () => {
    const saved = await ama.json<Saved>('/api/save', {
      entries: [{ kind: 'Passeport', title: 'Passeport togolais', data: { numero: 'TG1234567' } }],
    });
    const passport = saved.body.entries[0]!.id;
    expect((await kossi.json(`/api/entries/${passport}`)).status).toBe(404);
    expect((await kossi.json<unknown[]>('/api/entries?text=passeport')).body).toEqual([]);
    const query = await kossi.json<{ rows: unknown[] }>('/api/query', {
      sql: 'select * from my_entries',
    });
    expect(query.body.rows).toEqual([]);
    expect(
      (await kossi.json('/api/save', { entries: [{ id: passport, data: { numero: 'X' } }] }))
        .status,
    ).toBe(404);
    const amaLine = (await ama.json<{ id: number }[]>('/api/history?limit=1')).body[0]!;
    expect((await kossi.json('/api/undo', { journalId: amaLine.id })).status).toBe(404);
  });
});
