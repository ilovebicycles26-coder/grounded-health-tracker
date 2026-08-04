import type { Clock, IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';
import { InMemoryLocalDatabase } from '@grounded/local-store';
import { WeightService } from '@grounded/weight';
import { describe, expect, it } from 'vitest';

import { LocalFirstWeightRepository } from './index';

const ownerId = '00000000-0000-0000-0000-000000000001' as UserId;
const clock: Clock = { now: () => new Date('2026-08-04T08:00:00.000Z') };
let sequence = 0;
const ids: IdGenerator = {
  create: () => `10000000-0000-0000-0000-${String(++sequence).padStart(12, '0')}`,
};

describe('LocalFirstWeightRepository', () => {
  it('persists entries and a goal while queuing sync operations', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    const repository = new LocalFirstWeightRepository(database, clock, ids);
    const service = new WeightService(repository, clock, ids);

    await service.saveGoal({ ownerId, targetKilograms: 90 });
    await service.saveEntry({ ownerId, measuredOn: '2026-08-04', kilograms: 108.4 });

    await expect(service.getGoal(ownerId)).resolves.toMatchObject({
      ok: true,
      value: { targetKilograms: 90 },
    });
    await expect(service.listEntries(ownerId)).resolves.toMatchObject({
      ok: true,
      value: [{ kilograms: 108.4 }],
    });
    await expect(database.listDueOperations('9999-12-31T23:59:59.999Z', 10)).resolves.toHaveLength(
      2,
    );
  });

  it('rejects reads from the wrong account boundary', async () => {
    const repository = new LocalFirstWeightRepository(
      new InMemoryLocalDatabase(ownerId),
      clock,
      ids,
    );
    const other = '00000000-0000-0000-0000-000000000002' as UserId;
    await expect(repository.listEntries(other)).resolves.toMatchObject({
      ok: false,
      error: { code: 'local_account_mismatch' },
    });
  });
});
