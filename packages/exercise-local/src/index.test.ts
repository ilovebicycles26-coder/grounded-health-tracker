import type { UserId } from '@grounded/domain';
import { ExerciseService } from '@grounded/exercise';
import { InMemoryLocalDatabase } from '@grounded/local-store';
import { expect, it } from 'vitest';
import { LocalFirstExerciseRepository } from './index';

it('stores editable routines in the account-scoped outbox', async () => {
  const ownerId = 'owner' as UserId;
  const database = new InMemoryLocalDatabase(ownerId);
  let id = 0;
  const ids = { create: () => `id-${++id}` };
  const clock = { now: () => new Date('2026-08-04T08:00:00Z') };
  const service = new ExerciseService(
    new LocalFirstExerciseRepository(database, clock, ids),
    clock,
    ids,
  );
  const result = await service.saveRoutine({
    ownerId,
    name: 'Band mobility',
    steps: [{ activityType: 'resistance_band', title: 'Pull apart', sets: 2, repetitions: 12 }],
  });
  expect(result.ok).toBe(true);
  expect(await database.listDueOperations(clock.now().toISOString(), 10)).toHaveLength(1);
});
