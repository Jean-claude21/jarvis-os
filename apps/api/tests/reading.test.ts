import { beforeAll, describe, expect, it } from 'vitest';
import { readOnce, readWords } from '../src/reading';
import { zip } from '../src/zip';
import { server, signUp, type Account } from './client';

// Spec 026: a PDF and a Word document she gives are read after the upload, and `find` then reaches
// their words; a file that cannot be read says why, once.

/** A one-page PDF saying `line`, its cross-references counted. */
function pdfSaying(line: string): Uint8Array {
  const stream = `BT /F1 14 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, at) => {
    offsets.push(body.length);
    body += `${at + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

/** A Word document saying `line`. */
function docxSaying(line: string): Uint8Array {
  return zip([
    {
      path: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      path: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      path: 'word/document.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${line}</w:t></w:r></w:p></w:body></w:document>`,
    },
  ]);
}

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let ama: Account;
const upload = async (bytes: Uint8Array, name: string, type: string) => {
  const form = new FormData();
  form.set('file', new File([bytes as Uint8Array<ArrayBuffer>], name, { type }));
  const response = await ama.call('/api/files', { method: 'POST', body: form });
  return ((await response.json()) as { entryId: string }).entryId;
};

beforeAll(async () => {
  ama = await signUp('Ama');
});

describe('reading her files', () => {
  it('reads the words of a PDF and of a Word document', async () => {
    expect(await readWords(pdfSaying('Facture EDF ABC-77821'), PDF)).toContain('ABC-77821');
    expect(await readWords(docxSaying('Contrat de bail BAIL-5531'), DOCX)).toBe(
      'Contrat de bail BAIL-5531',
    );
  });

  it('fails a broken photo alone, without stopping the process', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6]);
    await expect(readWords(png, 'image/png')).rejects.toThrow(/cannot be read/);
  });

  it('reads them after the upload, so that find reaches their words', async () => {
    const invoice = await upload(pdfSaying('Facture eau ZX-40917'), 'facture.pdf', PDF);
    const lease = await upload(docxSaying('Bail appartement QW-88120'), 'bail.docx', DOCX);
    const broken = await upload(new TextEncoder().encode('not a pdf'), 'casse.pdf', PDF);
    expect((await ama.json<unknown[]>('/api/entries?text=ZX-40917')).body).toEqual([]);

    for (let pass = 0; pass < 3; pass += 1) await readOnce(server.db, server.blobs);

    const found = async (words: string) =>
      (await ama.json<{ id: string }[]>(`/api/entries?text=${words}`)).body.map((one) => one.id);
    expect(await found('ZX-40917')).toEqual([invoice]);
    expect(await found('QW-88120')).toEqual([lease]);
    const owner = server.db;
    const { rows } = await owner.query<{ entry_id: string }>(
      'select entry_id from jarvis_files_to_read(100)',
    );
    expect(rows.map((row) => row.entry_id)).not.toContain(broken);
  });
});
