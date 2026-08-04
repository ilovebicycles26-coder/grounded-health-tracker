import type { UserId } from '@grounded/domain';
import type {
  LocalDatabase,
  LocalEntity,
  OutboxOperation,
  RemoteEntity,
  SyncConflict,
} from '@grounded/local-store';
import Dexie, { type Table } from 'dexie';

interface StoredEntity extends LocalEntity {
  readonly key: string;
}

class GroundedDexie extends Dexie {
  public records!: Table<StoredEntity, string>;
  public outbox!: Table<OutboxOperation, string>;
  public conflicts!: Table<SyncConflict, string>;
  public constructor(name: string) {
    super(name);
    this.version(1).stores({
      records: '&key, [ownerId+entityType], entityType, updatedAt, syncStatus',
      outbox: '&operationId, [ownerId+nextAttemptAt], ownerId, createdAt',
      conflicts: '&id, [ownerId+status], ownerId, entityId',
    });
  }
}

function namespace(ownerId: UserId): string {
  return `grounded-local-${ownerId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
function entityKey(entityType: string, id: string): string {
  return `${entityType}:${id}`;
}

export class DexieLocalDatabase implements LocalDatabase {
  private readonly database: GroundedDexie;
  public constructor(public readonly ownerId: UserId) {
    this.database = new GroundedDexie(namespace(ownerId));
  }
  public async getEntity(entityType: string, id: string): Promise<LocalEntity | null> {
    return (await this.database.records.get(entityKey(entityType, id))) ?? null;
  }
  public async listEntities(entityType: string): Promise<readonly LocalEntity[]> {
    return this.database.records
      .where('[ownerId+entityType]')
      .equals([this.ownerId, entityType])
      .filter((entity) => entity.deletedAt === null)
      .toArray();
  }
  public async writeAndEnqueue(entity: LocalEntity, operation: OutboxOperation): Promise<void> {
    this.assertOwner(entity.ownerId);
    this.assertOwner(operation.ownerId);
    await this.database.transaction('rw', this.database.records, this.database.outbox, async () => {
      await this.database.records.put({ ...entity, key: entityKey(entity.entityType, entity.id) });
      await this.database.outbox.put(operation);
    });
  }
  public async listDueOperations(now: string, limit: number): Promise<readonly OutboxOperation[]> {
    return this.database.outbox
      .where('[ownerId+nextAttemptAt]')
      .between([this.ownerId, Dexie.minKey], [this.ownerId, now], true, true)
      .limit(limit)
      .sortBy('createdAt');
  }
  public async retryOperation(
    operationId: string,
    attempts: number,
    nextAttemptAt: string,
  ): Promise<void> {
    await this.database.outbox.update(operationId, { attempts, nextAttemptAt });
  }
  public async acknowledge(
    operationId: string,
    entityId: string,
    revision: number,
    updatedAt: string,
  ): Promise<void> {
    await this.database.transaction('rw', this.database.records, this.database.outbox, async () => {
      const operation = await this.database.outbox.get(operationId);
      if (!operation) return;
      const key = entityKey(operation.entityType, entityId);
      const entity = await this.database.records.get(key);
      if (entity)
        await this.database.records.put({ ...entity, revision, updatedAt, syncStatus: 'synced' });
      await this.database.outbox.delete(operationId);
    });
  }
  public async saveMergedConflict(entity: LocalEntity, operation: OutboxOperation): Promise<void> {
    await this.writeAndEnqueue(entity, operation);
  }
  public async recordConflict(conflict: SyncConflict, operationId: string): Promise<void> {
    await this.database.transaction(
      'rw',
      this.database.records,
      this.database.outbox,
      this.database.conflicts,
      async () => {
        const key = entityKey(conflict.entityType, conflict.entityId);
        const entity = await this.database.records.get(key);
        if (entity) await this.database.records.put({ ...entity, syncStatus: 'conflict' });
        await this.database.conflicts.put(conflict);
        await this.database.outbox.delete(operationId);
      },
    );
  }
  public async listConflicts(): Promise<readonly SyncConflict[]> {
    return this.database.conflicts
      .where('[ownerId+status]')
      .equals([this.ownerId, 'unresolved'])
      .toArray();
  }
  public async mergeRemote(entities: readonly RemoteEntity[]): Promise<void> {
    await this.database.transaction('rw', this.database.records, async () => {
      for (const remote of entities) {
        this.assertOwner(remote.ownerId);
        const key = entityKey(remote.entityType, remote.id);
        const local = await this.database.records.get(key);
        if (local?.syncStatus === 'pending' || local?.syncStatus === 'conflict') continue;
        if (local && local.revision > remote.revision) continue;
        await this.database.records.put({
          ...remote,
          key,
          localVersion: local?.localVersion ?? 0,
          syncStatus: 'synced',
        });
      }
    });
  }
  public async clear(): Promise<void> {
    await this.database.transaction(
      'rw',
      this.database.records,
      this.database.outbox,
      this.database.conflicts,
      async () => {
        await Promise.all([
          this.database.records.clear(),
          this.database.outbox.clear(),
          this.database.conflicts.clear(),
        ]);
      },
    );
  }
  public close(): Promise<void> {
    this.database.close();
    return Promise.resolve();
  }
  private assertOwner(ownerId: UserId): void {
    if (ownerId !== this.ownerId) throw new Error('Local database owner mismatch.');
  }
}
