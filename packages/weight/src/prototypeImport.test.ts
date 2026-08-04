import type { IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';
import { describe, expect, it } from 'vitest';

import { planPrototypeWeightImport } from './prototypeImport';

describe('prototype weight import planning', () => {
  it('maps valid legacy records without writing and reports unsafe records', () => {
    const ownerId = '00000000-0000-0000-0000-000000000001' as UserId;
    const ids: IdGenerator = {
      create: () => '10000000-0000-4000-8000-000000000001',
    };
    const plan = planPrototypeWeightImport(
      [
        { id: 'not-a-uuid', date: '2026-08-01', weight: 108.4, note: 'Morning' },
        { id: 'duplicate', date: '2026-08-01', weight: 108.4, note: 'Morning' },
        { id: 'bad-date', date: '2026-02-30', weight: 105, note: '' },
        { id: 'bad-weight', date: '2026-08-03', weight: 5, note: '' },
      ],
      ownerId,
      ids,
    );

    expect(plan).toMatchObject({ sourceCount: 4, entries: [{ kilograms: 108.4 }] });
    expect(plan.issues).toEqual([
      { index: 1, code: 'duplicate' },
      { index: 2, code: 'invalid_date' },
      { index: 3, code: 'invalid_weight' },
    ]);
  });
});
