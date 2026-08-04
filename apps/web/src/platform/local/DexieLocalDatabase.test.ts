// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import type { Clock, IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';
import { LocalEntityRepository } from '@grounded/local-store';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { DexieLocalDatabase } from './DexieLocalDatabase';

const ownerId = 'web-user' as UserId;
const clock: Clock = { now: () => new Date('2026-08-02T12:00:00.000Z') };
const ids: IdGenerator = { create: () => 'web-operation' };

describe('DexieLocalDatabase', () => {
  afterEach(() => Dexie.delete('grounded-local-web-user'));
  it('persists the record and outbox operation across a reopen', async () => {
    const first = new DexieLocalDatabase(ownerId);
    await new LocalEntityRepository(first, clock, ids).save('weight-entry', 'entry-1', {
      kilograms: 109,
    });
    await first.close();
    const reopened = new DexieLocalDatabase(ownerId);
    expect(await reopened.getEntity('weight-entry', 'entry-1')).toMatchObject({
      ownerId,
      syncStatus: 'pending',
    });
    expect(await reopened.listDueOperations(clock.now().toISOString(), 10)).toHaveLength(1);
    await reopened.close();
  });
  it('rejects a write carrying another account id', async () => {
    const database = new DexieLocalDatabase(ownerId);
    await expect(
      database.writeAndEnqueue(
        {
          ownerId: 'other' as UserId,
          entityType: 'habit',
          id: '1',
          payload: {},
          revision: 0,
          localVersion: 1,
          updatedAt: clock.now().toISOString(),
          deletedAt: null,
          syncStatus: 'pending',
        },
        {
          operationId: 'bad',
          ownerId: 'other' as UserId,
          entityType: 'habit',
          entityId: '1',
          kind: 'upsert',
          payload: {},
          basePayload: null,
          baseRevision: 0,
          attempts: 0,
          nextAttemptAt: clock.now().toISOString(),
          createdAt: clock.now().toISOString(),
        },
      ),
    ).rejects.toThrow('owner mismatch');
    await database.close();
  });
});
