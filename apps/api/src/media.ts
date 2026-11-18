import type { Blobs } from '@jarvis-os/core';

// Her media, understood (v3 médias): what a photo says of itself — when and where it was taken,
// its size — and a small thumbnail made once and kept beside it, so a gallery never loads the
// full images. Nothing leaves Jarvis: the photo is read here.

const PHOTO = /^image\/(jpeg|jpg|png|webp|heic|heif|tiff|gif|avif)$/;

/** What a photo says of itself, as her file's fields: « pris_le », « lieu », its size. */
export async function mediaFacts(
  bytes: Uint8Array,
  mediaType: string,
): Promise<Record<string, unknown>> {
  if (!PHOTO.test(mediaType)) return {};
  const out: Record<string, unknown> = {};
  try {
    const exifr = (await import('exifr')).default;
    const buffer = Buffer.from(bytes);
    // Its day and hour as the camera wrote them (her local time), not moved to another zone.
    const tags = (await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate'],
      reviveValues: false,
    })) as { DateTimeOriginal?: string; CreateDate?: string } | null;
    const taken = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
      String(tags?.DateTimeOriginal ?? tags?.CreateDate ?? ''),
    );
    if (taken && taken[1] !== '0000')
      out.pris_le = `${taken[1]}-${taken[2]}-${taken[3]}T${taken[4]}:${taken[5]}:${taken[6]}`;
    const gps = (await exifr.gps(buffer).catch(() => null)) as {
      latitude?: number;
      longitude?: number;
    } | null;
    if (
      typeof gps?.latitude === 'number' &&
      typeof gps?.longitude === 'number' &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    )
      out.lieu = {
        lat: Math.round(gps.latitude * 1e6) / 1e6,
        lng: Math.round(gps.longitude * 1e6) / 1e6,
      };
  } catch {
    // A photo without its tags says nothing more: it is kept as it is.
  }
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(Buffer.from(bytes)).metadata();
    if (meta.width && meta.height) {
      out.largeur = meta.width;
      out.hauteur = meta.height;
    }
  } catch {
    // Not an image sharp reads: no size.
  }
  return out;
}

/**
 * A file's thumbnail (480 px, WebP): made the first time it is asked for, then kept at
 * « <key>.thumb.webp ». Null when the file is not an image.
 */
export async function thumbnailOf(
  blobs: Blobs,
  key: string,
  mediaType: string,
): Promise<Uint8Array | null> {
  if (!PHOTO.test(mediaType)) return null;
  const at = `${key}.thumb.webp`;
  try {
    return await blobs.get(at);
  } catch {
    // Not made yet.
  }
  const original = await blobs.get(key);
  const sharp = (await import('sharp')).default;
  const thumb = new Uint8Array(
    await sharp(Buffer.from(original))
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  );
  await blobs.put(at, thumb, 'image/webp');
  return thumb;
}
