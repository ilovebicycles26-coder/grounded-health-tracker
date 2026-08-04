import type { Clock, IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';
import { describe, expect, it } from 'vitest';

import { AccountScopedStoreManager, InMemoryLocalDatabase, LocalEntityRepository } from './index';

const clock: Clock = { now: () => new Date('2026-08-02T12:00:00.000Z') };
const ids: IdGenerator = { create: () => 'operation-1' };
const richard = 'user-richard' as UserId;
const zoe = 'user-zoe' as UserId;

describe('local-first repository', () => {
  it('writes the entity and idempotent outbox operation together', async () => {
    const database = new InMemoryLocalDatabase(richard);
    const repository = new LocalEntityRepository(database, clock, ids);

    await repository.save('weight-entry', 'entry-1', { kilograms: 112.4 });

    expect(await database.getEntity('weight-entry', 'entry-1')).toMatchObject({
      ownerId: richard,
      syncStatus: 'pending',
      localVersion: 1,
    });
    expect(await database.listDueOperations(clock.now().toISOString(), 10)).toEqual([
      expect.objectContaining({ operationId: 'operation-1', entityId: 'entry-1' }),
    ]);
  });

  it('closes the previous account store before switching users', async () => {
    const closed: UserId[] = [];
    const manager = new AccountScopedStoreManager((ownerId) => {
      const database = new InMemoryLocalDatabase(ownerId);
      database.close = () => {
        closed.push(ownerId);
        return Promise.resolve();
      };
      return Promise.resolve(database);
    });

    await manager.switchTo(richard);
    const active = await manager.switchTo(zoe);

    expect(closed).toEqual([richard]);
    expect(active.ownerId).toBe(zoe);
  });
});
