import { crc32 } from 'node:zlib';

/**
 * A zip archive of files kept as they are (no compression): what every system opens, made without a
 * library. Names are UTF-8 (general purpose flag bit 11). Under 4 GB, under 65 535 files.
 */
export function zip(files: { path: string; content: string | Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const bytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(bytes);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, bytes.byteLength, true);
    head.setUint32(22, bytes.byteLength, true);
    head.setUint16(26, name.byteLength, true);
    local.push(new Uint8Array(head.buffer), name, bytes);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, bytes.byteLength, true);
    entry.setUint32(24, bytes.byteLength, true);
    entry.setUint16(28, name.byteLength, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.byteLength + bytes.byteLength;
  }
  const size = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}
