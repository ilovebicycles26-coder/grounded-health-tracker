import type { UserId } from '@grounded/domain';
import { HabitService } from '@grounded/habits';
import { InMemoryLocalDatabase } from '@grounded/local-store';
import { expect, it } from 'vitest';
import { LocalFirstHabitRepository } from './index';
it('stores supplements as an editable account habit', async () => {
  const ownerId = 'owner' as UserId;
  const database = new InMemoryLocalDatabase(ownerId);
  let id = 0;
  const ids = { create: () => `id-${++id}` };
  const clock = { now: () => new Date('2026-08-04T08:00:00Z') };
  const service = new HabitService(new LocalFirstHabitRepository(database, clock, ids), clock, ids);
  const result = await service.saveDefinition({
    ownerId,
    name: 'Take supplements',
    category: 'supplements',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  expect(result.ok).toBe(true);
  expect(await database.listDueOperations(clock.now().toISOString(), 10)).toHaveLength(1);
});
