import type { Clock, IdGenerator } from '@grounded/application';
import type { UserId } from '@grounded/domain';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type EntitySyncStatus = 'pending' | 'synced' | 'conflict';

export interface LocalEntity {
  readonly ownerId: UserId;
  readonly entityType: string;
  readonly id: string;
  readonly payload: JsonValue;
  readonly revision: number;
  readonly localVersion: number;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly syncStatus: EntitySyncStatus;
}

export interface RemoteEntity {
  readonly ownerId: UserId;
  readonly entityType: string;
  readonly id: string;
  readonly payload: JsonValue;
  readonly revision: number;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface OutboxOperation {
  readonly operationId: string;
  readonly ownerId: UserId;
  readonly entityType: string;
  readonly entityId: string;
  readonly kind: 'upsert' | 'delete';
  readonly payload: JsonValue | null;
  readonly basePayload: JsonValue | null;
  readonly baseRevision: number;
  readonly attempts: number;
  readonly nextAttemptAt: string;
  readonly createdAt: string;
}

export interface SyncConflict {
  readonly id: string;
  readonly ownerId: UserId;
  readonly entityType: string;
  readonly entityId: string;
  readonly basePayload: JsonValue | null;
  readonly localPayload: JsonValue | null;
  readonly remotePayload: JsonValue | null;
  readonly remoteRevision: number;
  readonly detectedAt: string;
  readonly status: 'unresolved' | 'resolved';
}

export interface LocalDatabase {
  readonly ownerId: UserId;
  getEntity(entityType: string, id: string): Promise<LocalEntity | null>;
  listEntities(entityType: string): Promise<readonly LocalEntity[]>;
  writeAndEnqueue(entity: LocalEntity, operation: OutboxOperation): Promise<void>;
  listDueOperations(now: string, limit: number): Promise<readonly OutboxOperation[]>;
  retryOperation(operationId: string, attempts: number, nextAttemptAt: string): Promise<void>;
  acknowledge(
    operationId: string,
    entityId: string,
    revision: number,
    updatedAt: string,
  ): Promise<void>;
  saveMergedConflict(entity: LocalEntity, operation: OutboxOperation): Promise<void>;
  recordConflict(conflict: SyncConflict, operationId: string): Promise<void>;
  listConflicts(): Promise<readonly SyncConflict[]>;
  mergeRemote(entities: readonly RemoteEntity[]): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

function assertOwner(database: LocalDatabase, ownerId: UserId): void {
  if (database.ownerId !== ownerId) throw new Error('Local database owner mismatch.');
}

export class LocalEntityRepository {
  public constructor(
    private readonly database: LocalDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async save(entityType: string, id: string, payload: JsonValue): Promise<LocalEntity> {
    const existing = await this.database.getEntity(entityType, id);
    const now = this.clock.now().toISOString();
    const entity: LocalEntity = {
      ownerId: this.database.ownerId,
      entityType,
      id,
      payload,
      revision: existing?.revision ?? 0,
      localVersion: (existing?.localVersion ?? 0) + 1,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    const operation: OutboxOperation = {
      operationId: this.ids.create(),
      ownerId: this.database.ownerId,
      entityType,
      entityId: id,
      kind: 'upsert',
      payload,
      basePayload: existing?.payload ?? null,
      baseRevision: existing?.revision ?? 0,
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    };
    await this.database.writeAndEnqueue(entity, operation);
    return entity;
  }

  public async remove(entityType: string, id: string): Promise<void> {
    const existing = await this.database.getEntity(entityType, id);
    if (!existing) return;
    assertOwner(this.database, existing.ownerId);
    const now = this.clock.now().toISOString();
    await this.database.writeAndEnqueue(
      {
        ...existing,
        localVersion: existing.localVersion + 1,
        updatedAt: now,
        deletedAt: now,
        syncStatus: 'pending',
      },
      {
        operationId: this.ids.create(),
        ownerId: this.database.ownerId,
        entityType,
        entityId: id,
        kind: 'delete',
        payload: null,
        basePayload: existing.payload,
        baseRevision: existing.revision,
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
      },
    );
  }
}

export type LocalDatabaseFactory = (ownerId: UserId) => Promise<LocalDatabase>;

export class AccountScopedStoreManager {
  private active: LocalDatabase | null = null;
  public constructor(private readonly openDatabase: LocalDatabaseFactory) {}
  public async switchTo(ownerId: UserId): Promise<LocalDatabase> {
    if (this.active?.ownerId === ownerId) return this.active;
    await this.active?.close();
    this.active = null;
    const next = await this.openDatabase(ownerId);
    assertOwner(next, ownerId);
    this.active = next;
    return next;
  }
  public async close(): Promise<void> {
    await this.active?.close();
    this.active = null;
  }
}

export class InMemoryLocalDatabase implements LocalDatabase {
  private readonly entities = new Map<string, LocalEntity>();
  private readonly operations = new Map<string, OutboxOperation>();
  private readonly conflicts = new Map<string, SyncConflict>();
  public constructor(public readonly ownerId: UserId) {}
  private key(type: string, id: string): string {
    return `${type}:${id}`;
  }
  public getEntity(type: string, id: string): Promise<LocalEntity | null> {
    return Promise.resolve(this.entities.get(this.key(type, id)) ?? null);
  }
  public listEntities(type: string): Promise<readonly LocalEntity[]> {
    return Promise.resolve(
      [...this.entities.values()].filter(
        (entity) => entity.entityType === type && entity.deletedAt === null,
      ),
    );
  }
  public writeAndEnqueue(entity: LocalEntity, operation: OutboxOperation): Promise<void> {
    assertOwner(this, entity.ownerId);
    assertOwner(this, operation.ownerId);
    this.entities.set(this.key(entity.entityType, entity.id), entity);
    this.operations.set(operation.operationId, operation);
    return Promise.resolve();
  }
  public listDueOperations(now: string, limit: number): Promise<readonly OutboxOperation[]> {
    return Promise.resolve(
      [...this.operations.values()]
        .filter((operation) => operation.nextAttemptAt <= now)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit),
    );
  }
  public retryOperation(id: string, attempts: number, next: string): Promise<void> {
    const operation = this.operations.get(id);
    if (operation) this.operations.set(id, { ...operation, attempts, nextAttemptAt: next });
    return Promise.resolve();
  }
  public acknowledge(
    operationId: string,
    entityId: string,
    revision: number,
    updatedAt: string,
  ): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) return Promise.resolve();
    const key = this.key(operation.entityType, entityId);
    const entity = this.entities.get(key);
    if (entity) this.entities.set(key, { ...entity, revision, updatedAt, syncStatus: 'synced' });
    this.operations.delete(operationId);
    return Promise.resolve();
  }
  public async saveMergedConflict(entity: LocalEntity, operation: OutboxOperation) {
    await this.writeAndEnqueue(entity, operation);
  }
  public recordConflict(conflict: SyncConflict, operationId: string): Promise<void> {
    const key = this.key(conflict.entityType, conflict.entityId);
    const entity = this.entities.get(key);
    if (entity) this.entities.set(key, { ...entity, syncStatus: 'conflict' });
    this.conflicts.set(conflict.id, conflict);
    this.operations.delete(operationId);
    return Promise.resolve();
  }
  public listConflicts(): Promise<readonly SyncConflict[]> {
    return Promise.resolve([...this.conflicts.values()]);
  }
  public mergeRemote(entities: readonly RemoteEntity[]): Promise<void> {
    for (const remote of entities) {
      assertOwner(this, remote.ownerId);
      const key = this.key(remote.entityType, remote.id);
      const local = this.entities.get(key);
      if (local?.syncStatus === 'pending' || local?.syncStatus === 'conflict') continue;
      if (local && local.revision > remote.revision) continue;
      this.entities.set(key, {
        ...remote,
        localVersion: local?.localVersion ?? 0,
        syncStatus: 'synced',
      });
    }
    return Promise.resolve();
  }
  public clear(): Promise<void> {
    this.entities.clear();
    this.operations.clear();
    this.conflicts.clear();
    return Promise.resolve();
  }
  public close(): Promise<void> {
    return Promise.resolve();
  }
}
