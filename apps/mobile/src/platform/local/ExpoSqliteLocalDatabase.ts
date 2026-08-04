import type { UserId } from '@grounded/domain';
import type {
  JsonValue,
  LocalDatabase,
  LocalEntity,
  OutboxOperation,
  RemoteEntity,
  SyncConflict,
} from '@grounded/local-store';
import { type SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';

interface EntityRow {
  owner_id: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  revision: number;
  local_version: number;
  updated_at: string;
  deleted_at: string | null;
  sync_status: LocalEntity['syncStatus'];
}
interface OperationRow {
  operation_id: string;
  owner_id: string;
  entity_type: string;
  entity_id: string;
  kind: OutboxOperation['kind'];
  payload: string | null;
  base_payload: string | null;
  base_revision: number;
  attempts: number;
  next_attempt_at: string;
  created_at: string;
}
interface ConflictRow {
  id: string;
  owner_id: string;
  entity_type: string;
  entity_id: string;
  base_payload: string | null;
  local_payload: string | null;
  remote_payload: string | null;
  remote_revision: number;
  detected_at: string;
  status: SyncConflict['status'];
}

function parseJson(value: string): JsonValue {
  const parsed: unknown = JSON.parse(value);
  return parsed as JsonValue;
}
function parseNullable(value: string | null): JsonValue | null {
  return value === null ? null : parseJson(value);
}
function databaseName(ownerId: UserId): string {
  return `grounded_${ownerId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`;
}
function mapEntity(row: EntityRow): LocalEntity {
  return {
    ownerId: row.owner_id as UserId,
    entityType: row.entity_type,
    id: row.entity_id,
    payload: parseJson(row.payload),
    revision: row.revision,
    localVersion: row.local_version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
  };
}
function mapOperation(row: OperationRow): OutboxOperation {
  return {
    operationId: row.operation_id,
    ownerId: row.owner_id as UserId,
    entityType: row.entity_type,
    entityId: row.entity_id,
    kind: row.kind,
    payload: parseNullable(row.payload),
    basePayload: parseNullable(row.base_payload),
    baseRevision: row.base_revision,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
  };
}
function mapConflict(row: ConflictRow): SyncConflict {
  return {
    id: row.id,
    ownerId: row.owner_id as UserId,
    entityType: row.entity_type,
    entityId: row.entity_id,
    basePayload: parseNullable(row.base_payload),
    localPayload: parseNullable(row.local_payload),
    remotePayload: parseNullable(row.remote_payload),
    remoteRevision: row.remote_revision,
    detectedAt: row.detected_at,
    status: row.status,
  };
}

export class ExpoSqliteLocalDatabase implements LocalDatabase {
  private constructor(
    public readonly ownerId: UserId,
    private readonly database: SQLiteDatabase,
  ) {}
  public static async open(ownerId: UserId): Promise<ExpoSqliteLocalDatabase> {
    const database = await openDatabaseAsync(databaseName(ownerId));
    await database.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS records (owner_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, local_version INTEGER NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, sync_status TEXT NOT NULL, PRIMARY KEY (entity_type, entity_id));
      CREATE INDEX IF NOT EXISTS records_owner_type ON records (owner_id, entity_type);
      CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT, base_payload TEXT, base_revision INTEGER NOT NULL, attempts INTEGER NOT NULL, next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS outbox_owner_due ON outbox (owner_id, next_attempt_at);
      CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, base_payload TEXT, local_payload TEXT, remote_payload TEXT, remote_revision INTEGER NOT NULL, detected_at TEXT NOT NULL, status TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS conflicts_owner_status ON conflicts (owner_id, status);`);
    return new ExpoSqliteLocalDatabase(ownerId, database);
  }
  public async getEntity(entityType: string, id: string): Promise<LocalEntity | null> {
    const row = await this.database.getFirstAsync<EntityRow>(
      'SELECT * FROM records WHERE owner_id = ? AND entity_type = ? AND entity_id = ?',
      this.ownerId,
      entityType,
      id,
    );
    return row ? mapEntity(row) : null;
  }
  public async listEntities(entityType: string): Promise<readonly LocalEntity[]> {
    const rows = await this.database.getAllAsync<EntityRow>(
      'SELECT * FROM records WHERE owner_id = ? AND entity_type = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
      this.ownerId,
      entityType,
    );
    return rows.map(mapEntity);
  }
  public async writeAndEnqueue(entity: LocalEntity, operation: OutboxOperation): Promise<void> {
    this.assertOwner(entity.ownerId);
    this.assertOwner(operation.ownerId);
    await this.database.withTransactionAsync(async () => {
      await this.putEntity(entity);
      await this.putOperation(operation);
    });
  }
  public async listDueOperations(now: string, limit: number): Promise<readonly OutboxOperation[]> {
    const rows = await this.database.getAllAsync<OperationRow>(
      'SELECT * FROM outbox WHERE owner_id = ? AND next_attempt_at <= ? ORDER BY created_at LIMIT ?',
      this.ownerId,
      now,
      limit,
    );
    return rows.map(mapOperation);
  }
  public async retryOperation(
    operationId: string,
    attempts: number,
    nextAttemptAt: string,
  ): Promise<void> {
    await this.database.runAsync(
      'UPDATE outbox SET attempts = ?, next_attempt_at = ? WHERE owner_id = ? AND operation_id = ?',
      attempts,
      nextAttemptAt,
      this.ownerId,
      operationId,
    );
  }
  public async acknowledge(
    operationId: string,
    entityId: string,
    revision: number,
    updatedAt: string,
  ): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      const operation = await this.database.getFirstAsync<OperationRow>(
        'SELECT * FROM outbox WHERE owner_id = ? AND operation_id = ?',
        this.ownerId,
        operationId,
      );
      if (!operation) return;
      await this.database.runAsync(
        "UPDATE records SET revision = ?, updated_at = ?, sync_status = 'synced' WHERE owner_id = ? AND entity_type = ? AND entity_id = ?",
        revision,
        updatedAt,
        this.ownerId,
        operation.entity_type,
        entityId,
      );
      await this.database.runAsync(
        'DELETE FROM outbox WHERE owner_id = ? AND operation_id = ?',
        this.ownerId,
        operationId,
      );
    });
  }
  public async saveMergedConflict(entity: LocalEntity, operation: OutboxOperation): Promise<void> {
    await this.writeAndEnqueue(entity, operation);
  }
  public async recordConflict(conflict: SyncConflict, operationId: string): Promise<void> {
    this.assertOwner(conflict.ownerId);
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        "UPDATE records SET sync_status = 'conflict' WHERE owner_id = ? AND entity_type = ? AND entity_id = ?",
        this.ownerId,
        conflict.entityType,
        conflict.entityId,
      );
      await this.database.runAsync(
        'INSERT OR REPLACE INTO conflicts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        conflict.id,
        this.ownerId,
        conflict.entityType,
        conflict.entityId,
        conflict.basePayload === null ? null : JSON.stringify(conflict.basePayload),
        conflict.localPayload === null ? null : JSON.stringify(conflict.localPayload),
        conflict.remotePayload === null ? null : JSON.stringify(conflict.remotePayload),
        conflict.remoteRevision,
        conflict.detectedAt,
        conflict.status,
      );
      await this.database.runAsync(
        'DELETE FROM outbox WHERE owner_id = ? AND operation_id = ?',
        this.ownerId,
        operationId,
      );
    });
  }
  public async listConflicts(): Promise<readonly SyncConflict[]> {
    const rows = await this.database.getAllAsync<ConflictRow>(
      "SELECT * FROM conflicts WHERE owner_id = ? AND status = 'unresolved' ORDER BY detected_at",
      this.ownerId,
    );
    return rows.map(mapConflict);
  }
  public async mergeRemote(entities: readonly RemoteEntity[]): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const remote of entities) {
        this.assertOwner(remote.ownerId);
        const local = await this.database.getFirstAsync<EntityRow>(
          'SELECT * FROM records WHERE owner_id = ? AND entity_type = ? AND entity_id = ?',
          this.ownerId,
          remote.entityType,
          remote.id,
        );
        if (local?.sync_status === 'pending' || local?.sync_status === 'conflict') continue;
        if (local && local.revision > remote.revision) continue;
        await this.putEntity({
          ...remote,
          localVersion: local?.local_version ?? 0,
          syncStatus: 'synced',
        });
      }
    });
  }
  public async clear(): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const table of ['records', 'outbox', 'conflicts'] as const)
        await this.database.runAsync(`DELETE FROM ${table} WHERE owner_id = ?`, this.ownerId);
    });
  }
  public async close(): Promise<void> {
    await this.database.closeAsync();
  }
  private async putEntity(entity: LocalEntity): Promise<void> {
    await this.database.runAsync(
      'INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      this.ownerId,
      entity.entityType,
      entity.id,
      JSON.stringify(entity.payload),
      entity.revision,
      entity.localVersion,
      entity.updatedAt,
      entity.deletedAt,
      entity.syncStatus,
    );
  }
  private async putOperation(operation: OutboxOperation): Promise<void> {
    await this.database.runAsync(
      'INSERT OR REPLACE INTO outbox VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      operation.operationId,
      this.ownerId,
      operation.entityType,
      operation.entityId,
      operation.kind,
      operation.payload === null ? null : JSON.stringify(operation.payload),
      operation.basePayload === null ? null : JSON.stringify(operation.basePayload),
      operation.baseRevision,
      operation.attempts,
      operation.nextAttemptAt,
      operation.createdAt,
    );
  }
  private assertOwner(ownerId: UserId): void {
    if (ownerId !== this.ownerId) throw new Error('Local database owner mismatch.');
  }
}
