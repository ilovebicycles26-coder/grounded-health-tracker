import type { JsonValue } from '@grounded/local-store';
export interface BackupRecord {
  readonly entityType: string;
  readonly id: string;
  readonly payload: JsonValue;
}
export interface BackupManifest {
  readonly product: 'grounded';
  readonly formatVersion: 1;
  readonly exportedAt: string;
  readonly recordCount: number;
  readonly recordsCrc32: string;
}
export interface BackupPreview {
  readonly manifest: BackupManifest;
  readonly records: readonly BackupRecord[];
  readonly counts: Readonly<Record<string, number>>;
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const hex = (value: number) => value.toString(16).padStart(8, '0');
function u16(value: number) {
  return [value & 255, (value >>> 8) & 255];
}
function u32(value: number) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}
function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function storedZip(files: Readonly<Record<string, Uint8Array>>): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    if (!/^[a-z0-9._-]+$/i.test(name)) throw new Error('invalid_backup_filename');
    const filename = encoder.encode(name);
    const checksum = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(checksum),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(filename.length),
      ...u16(0),
      ...filename,
    ]);
    locals.push(local, data);
    central.push(
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(checksum),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(filename.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...filename,
      ]),
    );
    offset += local.length + data.length;
  }
  const centralData = concat(central);
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(central.length),
    ...u16(central.length),
    ...u32(centralData.length),
    ...u32(offset),
    ...u16(0),
  ]);
  return concat([...locals, centralData, end]);
}
function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function unzipStored(bytes: Uint8Array): Readonly<Record<string, Uint8Array>> {
  if (bytes.length > 10_000_000) throw new Error('backup_too_large');
  const files: Record<string, Uint8Array> = {};
  const data = view(bytes);
  let offset = 0;
  while (offset + 4 <= bytes.length && data.getUint32(offset, true) === 0x04034b50) {
    const compression = data.getUint16(offset + 8, true);
    const expectedCrc = data.getUint32(offset + 14, true);
    const size = data.getUint32(offset + 18, true);
    const nameLength = data.getUint16(offset + 26, true);
    const extraLength = data.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    if (compression !== 0 || !/^[a-z0-9._-]+$/i.test(name))
      throw new Error('invalid_backup_archive');
    const start = offset + 30 + nameLength + extraLength;
    const content = bytes.slice(start, start + size);
    if (content.length !== size || crc32(content) !== expectedCrc)
      throw new Error('backup_checksum_failed');
    files[name] = content;
    offset = start + size;
  }
  return files;
}
function isRecord(value: unknown): value is BackupRecord {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.entityType === 'string' && typeof item.id === 'string' && 'payload' in item;
}
function isManifest(value: unknown): value is BackupManifest {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item.product === 'grounded' &&
    item.formatVersion === 1 &&
    typeof item.exportedAt === 'string' &&
    typeof item.recordCount === 'number' &&
    Number.isInteger(item.recordCount) &&
    item.recordCount >= 0 &&
    typeof item.recordsCrc32 === 'string'
  );
}
export function createBackup(
  records: readonly BackupRecord[],
  exportedAt = new Date().toISOString(),
): Uint8Array {
  const lines = records.map((record) => JSON.stringify(record)).join('\n');
  const recordBytes = encoder.encode(lines);
  const manifest: BackupManifest = {
    product: 'grounded',
    formatVersion: 1,
    exportedAt,
    recordCount: records.length,
    recordsCrc32: hex(crc32(recordBytes)),
  };
  return storedZip({
    'manifest.json': encoder.encode(JSON.stringify(manifest, null, 2)),
    'records.ndjson': recordBytes,
  });
}
export function previewBackup(bytes: Uint8Array): BackupPreview {
  const files = unzipStored(bytes);
  const manifestText = files['manifest.json'];
  const recordBytes = files['records.ndjson'];
  if (!manifestText || !recordBytes) throw new Error('backup_files_missing');
  const parsedManifest: unknown = JSON.parse(decoder.decode(manifestText));
  if (!isManifest(parsedManifest) || parsedManifest.recordsCrc32 !== hex(crc32(recordBytes)))
    throw new Error('invalid_backup_manifest');
  const manifest = parsedManifest;
  const records = decoder
    .decode(recordBytes)
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
  if (records.length !== manifest.recordCount || !records.every(isRecord))
    throw new Error('invalid_backup_records');
  const keys = new Set<string>();
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = `${record.entityType}:${record.id}`;
    if (keys.has(key)) throw new Error('duplicate_backup_record');
    keys.add(key);
    counts[record.entityType] = (counts[record.entityType] ?? 0) + 1;
  }
  return { manifest, records, counts };
}
