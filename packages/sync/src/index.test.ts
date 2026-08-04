import type { Clock, IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';
import { InMemoryLocalDatabase, LocalEntityRepository } from '@grounded/local-store';
import { describe, expect, it } from 'vitest';

import { mergeThreeWay, ObservableSyncState, SyncCoordinator, type SyncTransport } from './index';

const ownerId = 'user-richard' as UserId;
const clock: Clock = { now: () => new Date('2026-08-02T12:00:00.000Z') };
let nextId = 0;
const ids: IdGenerator = { create: () => `id-${++nextId}` };

describe('sync kernel', () => {
  it('acknowledges a mutation once by its operation id', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    await new LocalEntityRepository(database, clock, ids).save('weight-entry', 'entry-1', {
      kilograms: 110,
    });
    const transport: SyncTransport = {
      push: (operations) =>
        Promise.resolve(
          operations.map((operation) => ({
            kind: 'ack' as const,
            operationId: operation.operationId,
            revision: 1,
            updatedAt: clock.now().toISOString(),
          })),
        ),
    };

    const snapshot = await new SyncCoordinator(
      database,
      transport,
      new ObservableSyncState(),
      clock,
      ids,
    ).run(true);

    expect(snapshot.phase).toBe('synced');
    expect(snapshot.pendingCount).toBe(0);
    expect(await database.getEntity('weight-entry', 'entry-1')).toMatchObject({
      revision: 1,
      syncStatus: 'synced',
    });
  });

  it('backs off without losing a mutation when the network fails', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    await new LocalEntityRepository(database, clock, ids).save('habit-entry', 'entry-1', {
      complete: true,
    });
    const transport: SyncTransport = { push: () => Promise.reject(new Error('offline')) };

    const snapshot = await new SyncCoordinator(
      database,
      transport,
      new ObservableSyncState(),
      clock,
      ids,
    ).run(true);
    const queued = await database.listDueOperations('9999-12-31T23:59:59.999Z', 10);

    expect(snapshot.phase).toBe('offline');
    expect(queued[0]).toMatchObject({ attempts: 1, nextAttemptAt: '2026-08-02T12:00:01.000Z' });
  });

  it('hydrates remote records even when there are no local changes to push', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    const transport: SyncTransport = {
      push: () => Promise.resolve([]),
      pull: () =>
        Promise.resolve({
          entities: [
            {
              ownerId,
              entityType: 'weight-entry:v1',
              id: 'remote-entry',
              payload: { kilograms: 105 },
              revision: 3,
              updatedAt: '2026-08-02T11:00:00.000Z',
              deletedAt: null,
            },
          ],
          nextCursor: '2026-08-02T11:00:00.000Z',
        }),
    };

    const snapshot = await new SyncCoordinator(
      database,
      transport,
      new ObservableSyncState(),
      clock,
      ids,
    ).run(true);

    expect(snapshot.phase).toBe('synced');
    expect(await database.getEntity('weight-entry:v1', 'remote-entry')).toMatchObject({
      revision: 3,
      syncStatus: 'synced',
    });
  });

  it('retries any operation omitted from a partial transport response', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    const repository = new LocalEntityRepository(database, clock, ids);
    await repository.save('habit-entry', 'entry-1', { complete: true });
    await repository.save('habit-entry', 'entry-2', { complete: false });
    const transport: SyncTransport = {
      push: (operations) => {
        const first = operations[0];
        if (!first) return Promise.resolve([]);
        return Promise.resolve([
          {
            kind: 'ack',
            operationId: first.operationId,
            revision: 1,
            updatedAt: clock.now().toISOString(),
          },
        ]);
      },
    };

    const snapshot = await new SyncCoordinator(
      database,
      transport,
      new ObservableSyncState(),
      clock,
      ids,
    ).run(true);
    const queued = await database.listDueOperations('9999-12-31T23:59:59.999Z', 10);

    expect(snapshot.phase).toBe('offline');
    expect(queued).toEqual([expect.objectContaining({ entityId: 'entry-2', attempts: 1 })]);
  });

  it('auto-merges changes to different fields and flags overlapping edits', () => {
    expect(
      mergeThreeWay(
        { note: 'base', complete: false },
        { note: 'local', complete: false },
        { note: 'base', complete: true },
      ),
    ).toEqual({ kind: 'merged', payload: { note: 'local', complete: true } });
    expect(mergeThreeWay({ note: 'base' }, { note: 'local' }, { note: 'remote' })).toEqual({
      kind: 'manual',
    });
  });

  it('retains overlapping remote edits for an explicit user decision', async () => {
    const database = new InMemoryLocalDatabase(ownerId);
    const repository = new LocalEntityRepository(database, clock, ids);
    await repository.save('routine', 'routine-1', { title: 'Original' });
    const initial = await database.listDueOperations(clock.now().toISOString(), 1);
    const initialOperation = initial[0];
    if (!initialOperation) throw new Error('Expected an initial operation.');
    await database.acknowledge(
      initialOperation.operationId,
      'routine-1',
      1,
      clock.now().toISOString(),
    );
    await repository.save('routine', 'routine-1', { title: 'Local title' });
    const transport: SyncTransport = {
      push: (operations) =>
        Promise.resolve(
          operations.map((operation) => ({
            kind: 'conflict' as const,
            operationId: operation.operationId,
            remotePayload: { title: 'Remote title' },
            remoteRevision: 2,
            remoteUpdatedAt: clock.now().toISOString(),
          })),
        ),
    };

    const snapshot = await new SyncCoordinator(
      database,
      transport,
      new ObservableSyncState(),
      clock,
      ids,
    ).run(true);

    expect(snapshot.phase).toBe('action_required');
    expect(await database.listConflicts()).toHaveLength(1);
  });
});
