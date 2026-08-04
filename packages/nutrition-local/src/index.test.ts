import type { UserId } from '@grounded/domain';
import { InMemoryLocalDatabase } from '@grounded/local-store';
import { NutritionService } from '@grounded/nutrition';
import { describe, expect, it } from 'vitest';

import { LocalFirstNutritionRepository } from './index';

describe('LocalFirstNutritionRepository', () => {
  it('persists a private entry and queues it for sync', async () => {
    const ownerId = 'owner' as UserId;
    const database = new InMemoryLocalDatabase(ownerId);
    let id = 0;
    const ids = { create: () => `id-${++id}` };
    const clock = { now: () => new Date('2026-08-04T08:00:00Z') };
    const service = new NutritionService(
      new LocalFirstNutritionRepository(database, clock, ids),
      clock,
      ids,
    );
    const saved = await service.saveEntry({
      ownerId,
      consumedOn: '2026-08-04',
      mealType: 'dinner',
      name: 'Vegetable curry',
      quantity: 1,
      unit: 'bowl',
      caloriesKcal: 620,
    });
    expect(saved.ok).toBe(true);
    expect((await service.listEntries(ownerId)).ok).toBe(true);
    expect(await database.listDueOperations(clock.now().toISOString(), 10)).toHaveLength(1);
  });
});
