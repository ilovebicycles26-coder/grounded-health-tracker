import { createBackup, previewBackup } from './index';
import { expect, it } from 'vitest';
it('round trips a versioned stored ZIP with checksums', () => {
  const archive = createBackup(
    [{ entityType: 'weight-entry:v1', id: 'entry', payload: { kilograms: 100 } }],
    '2026-08-04T00:00:00Z',
  );
  expect(new DataView(archive.buffer).getUint32(0, true)).toBe(0x04034b50);
  const preview = previewBackup(archive);
  expect(preview.manifest.formatVersion).toBe(1);
  expect(preview.counts['weight-entry:v1']).toBe(1);
});
