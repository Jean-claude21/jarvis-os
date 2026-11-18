import { api, spaceNow } from './api';

// Sending one file to Jarvis (v3 médias): a small one in one request; a large one (a video, a long
// scan, up to 500 Mo) in parts of 8 Mo straight to storage — first its fingerprint, so the same
// bytes she already keeps are never sent again.

export const SMALL_MAX = 15 * 1024 * 1024;
const PRINT_MAX = 200 * 1024 * 1024;

export interface Sent {
  entryId: string;
  /** She had these very bytes already: this is that file. */
  duplicate: boolean;
}

const withSpace = (path: string) => {
  const url = new URL(`/api${path}`, location.origin);
  if (spaceNow()) url.searchParams.set('space', spaceNow()!);
  return url;
};

/** The file's SHA-256, read in the browser (large files only: small ones are printed by Jarvis). */
async function fingerprint(file: File): Promise<string | undefined> {
  if (file.size > PRINT_MAX || !crypto.subtle) return undefined;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sendFile(
  file: File,
  options: { to?: string | null; replace?: string; onProgress?: (done: number) => void } = {},
): Promise<Sent> {
  const links = options.to ? [{ to: options.to, role: 'pièce de' }] : undefined;
  const type = file.type || 'application/octet-stream';
  if (file.size <= SMALL_MAX) {
    const form = new FormData();
    form.append('file', file);
    if (links && !options.replace) form.append('links', JSON.stringify(links));
    const response = await fetch(
      withSpace(options.replace ? `/files/${options.replace}/replace` : '/files'),
      { method: 'POST', body: form, credentials: 'same-origin' },
    );
    const body = (await response.json().catch(() => ({}))) as {
      entryId?: string;
      duplicate?: boolean;
      error?: string;
    };
    if (!response.ok || !body.entryId)
      throw new Error(body.error ?? `Envoi refusé (${response.status}).`);
    options.onProgress?.(1);
    return { entryId: body.entryId, duplicate: !!body.duplicate };
  }
  const empreinte = options.replace ? undefined : await fingerprint(file);
  const started = await api<{
    duplicate?: string;
    key?: string;
    uploadId?: string;
    partSize?: number;
  }>('/files/uploads', {
    method: 'POST',
    body: {
      name: file.name,
      type,
      size: file.size,
      ...(empreinte ? { empreinte } : {}),
      ...(links ? { links } : {}),
    },
  });
  if (started.duplicate) {
    options.onProgress?.(1);
    return { entryId: started.duplicate, duplicate: true };
  }
  const { key, uploadId } = started as { key: string; uploadId: string };
  const size = started.partSize ?? 8 * 1024 * 1024;
  const parts: { n: number; etag: string }[] = [];
  try {
    for (let n = 1, at = 0; at < file.size; n += 1, at += size) {
      const url = withSpace('/files/uploads/part');
      url.searchParams.set('key', key);
      url.searchParams.set('uploadId', uploadId);
      url.searchParams.set('n', String(n));
      const response = await fetch(url, {
        method: 'PUT',
        body: file.slice(at, at + size),
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`La partie ${n} n’est pas passée (${response.status}).`);
      parts.push((await response.json()) as { n: number; etag: string });
      options.onProgress?.(Math.min(1, (at + size) / file.size));
    }
  } catch (error) {
    await api('/files/uploads/abort', { method: 'POST', body: { key, uploadId } }).catch(
      () => undefined,
    );
    throw error;
  }
  const done = await api<{ entryId: string }>('/files/uploads/complete', {
    method: 'POST',
    body: {
      key,
      uploadId,
      parts,
      name: file.name,
      type,
      size: file.size,
      ...(empreinte ? { empreinte } : {}),
      ...(links ? { links } : {}),
      ...(options.replace ? { replace: options.replace } : {}),
    },
  });
  return { entryId: done.entryId, duplicate: false };
}
