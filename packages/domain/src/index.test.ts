import { describe, expect, it } from 'vitest';

import { asIsoDate } from './index';

describe('asIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(asIsoDate('2026-08-02')).toEqual({ ok: true, value: '2026-08-02' });
  });

  it('rejects an impossible calendar date', () => {
    expect(asIsoDate('2026-02-31')).toEqual({
      ok: false,
      error: { kind: 'validation', code: 'invalid_iso_date', field: 'date' },
    });
  });
});
