import { beforeAll, describe, expect, it } from 'vitest';
import { signUp, type Account } from './client';

// Spec 002, story 3: her files — stored, linked, read back byte for byte, searched, shared for a
// while; and never reached by another account.
let ama: Account;
let kossi: Account;
let demarche: string;

/** A real one-page PDF, written by hand: what a scan or a form would be. */
function pdf(text: string): Uint8Array<ArrayBuffer> {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

async function upload(who: Account, file: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set('file', file);
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  const response = await who.call('/api/files', { method: 'POST', body: form });
  return {
    status: response.status,
    body: (await response.json()) as { entryId: string; size: number; error?: string },
  };
}

beforeAll(async () => {
  ama = await signUp('Ama');
  kossi = await signUp('Kossi');
  const saved = await ama.json<{ entries: { id: string }[] }>('/api/save', {
    entries: [{ kind: 'Démarche', title: 'Titre de séjour', data: { statut: 'à faire' } }],
  });
  demarche = saved.body.entries[0]!.id;
});

describe('her files (story 3)', () => {
  it('stores a PDF linked to its démarche and gives back the same bytes', async () => {
    const bytes = pdf('Passeport togolais TG1234567');
    const stored = await upload(
      ama,
      new File([bytes], 'passeport.pdf', { type: 'application/pdf' }),
      {
        title: 'Passeport — page photo',
        links: JSON.stringify([{ to: demarche, role: 'pièce de' }]),
      },
    );
    expect(stored.status).toBe(201);
    expect(stored.body.size).toBe(bytes.byteLength);

    const entry = await ama.json<{
      kind: string;
      title: string;
      data: Record<string, unknown>;
      links: { out: { role: string; entry: { id: string } }[] };
    }>(`/api/entries/${stored.body.entryId}`);
    expect(entry.body).toMatchObject({
      kind: 'Fichier',
      title: 'Passeport — page photo',
      data: { nom: 'passeport.pdf', type: 'application/pdf', taille: bytes.byteLength },
    });
    expect(entry.body.links.out).toEqual([
      expect.objectContaining({
        role: 'pièce de',
        entry: expect.objectContaining({ id: demarche }),
      }),
    ]);

    const download = await ama.call(`/api/files/${stored.body.entryId}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
  });

  it('makes a text file’s words findable', async () => {
    const text =
      'Récépissé de demande de visa — référence TGO-2026-48213, rendez-vous le 12 novembre.';
    const stored = await upload(ama, new File([text], 'recepisse.txt', { type: 'text/plain' }));
    expect(stored.status).toBe(201);
    const found = await ama.json<{ id: string }[]>('/api/entries?text=TGO-2026-48213');
    expect(found.body.map((one) => one.id)).toEqual([stored.body.entryId]);
  });

  it('opens a file through a link that needs no token, for a while', async () => {
    const bytes = pdf('Attestation');
    const stored = await upload(
      ama,
      new File([bytes], 'attestation.pdf', { type: 'application/pdf' }),
    );
    const { body } = await ama.json<{ url: string; seconds: number }>(
      `/api/files/${stored.body.entryId}/link?seconds=120`,
    );
    expect(body.seconds).toBe(120);
    const opened = await fetch(body.url);
    expect(opened.status).toBe(200);
    expect(new Uint8Array(await opened.arrayBuffer())).toEqual(bytes);
  });

  it('refuses an empty file and one over 20 MB', async () => {
    const empty = await upload(ama, new File([], 'vide.txt', { type: 'text/plain' }));
    expect(empty.status).toBe(400);
    const huge = await upload(ama, new File([new Uint8Array(21 * 1024 * 1024)], 'gros.bin'));
    expect(huge.status).toBe(400);
    expect(huge.body.error).toMatch(/larger than 20 MB/);
  });

  it('never gives Ama’s file to Kossi', async () => {
    const stored = await upload(
      ama,
      new File([pdf('Diplôme')], 'diplome.pdf', { type: 'application/pdf' }),
    );
    expect((await kossi.call(`/api/files/${stored.body.entryId}`)).status).toBe(404);
    expect((await kossi.call(`/api/files/${stored.body.entryId}/link`)).status).toBe(404);
  });
});
