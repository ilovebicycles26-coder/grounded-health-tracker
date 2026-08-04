import type { Clock, IdGenerator } from '@grounded/application';
import {
  asIsoDate,
  failure,
  success,
  type EntityId,
  type Result,
  type UserId,
} from '@grounded/domain';
import {
  LocalEntityRepository,
  type JsonValue,
  type LocalDatabase,
  type LocalEntity,
} from '@grounded/local-store';
import {
  asWeightKilograms,
  type WeightEntry,
  type WeightGoal,
  type WeightRepository,
  weightEntityTypes,
} from '@grounded/weight';

type JsonObject = { readonly [key: string]: JsonValue };

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function ownerMatches(database: LocalDatabase, ownerId: UserId): boolean {
  return database.ownerId === ownerId;
}

function parseEntry(entity: LocalEntity): Result<WeightEntry> {
  if (!isObject(entity.payload)) {
    return failure({ kind: 'unavailable', code: 'invalid_local_weight_entry' });
  }
  const measuredOn =
    typeof entity.payload.measuredOn === 'string'
      ? asIsoDate(entity.payload.measuredOn)
      : failure({ kind: 'validation', code: 'invalid_iso_date', field: 'date' });
  const kilograms =
    typeof entity.payload.kilograms === 'number'
      ? asWeightKilograms(entity.payload.kilograms)
      : failure({ kind: 'validation', code: 'weight_out_of_range', field: 'weight' });
  const note = entity.payload.note;
  const recordedAt = entity.payload.recordedAt;
  if (
    !measuredOn.ok ||
    !kilograms.ok ||
    (note !== null && typeof note !== 'string') ||
    !isTimestamp(recordedAt)
  ) {
    return failure({ kind: 'unavailable', code: 'invalid_local_weight_entry' });
  }
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    measuredOn: measuredOn.value,
    kilograms: kilograms.value,
    note,
    recordedAt,
  });
}

function parseGoal(entity: LocalEntity): Result<WeightGoal> {
  if (!isObject(entity.payload)) {
    return failure({ kind: 'unavailable', code: 'invalid_local_weight_goal' });
  }
  const target =
    typeof entity.payload.targetKilograms === 'number'
      ? asWeightKilograms(entity.payload.targetKilograms)
      : failure({ kind: 'validation', code: 'weight_out_of_range', field: 'weight' });
  const targetDateValue = entity.payload.targetDate;
  const targetDate =
    typeof targetDateValue === 'string'
      ? asIsoDate(targetDateValue)
      : targetDateValue === null
        ? success(null)
        : failure({ kind: 'validation', code: 'invalid_iso_date', field: 'targetDate' });
  const createdAt = entity.payload.createdAt;
  if (!target.ok || !targetDate.ok || !isTimestamp(createdAt)) {
    return failure({ kind: 'unavailable', code: 'invalid_local_weight_goal' });
  }
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    targetKilograms: target.value,
    targetDate: targetDate.value,
    createdAt,
  });
}

function entryPayload(entry: WeightEntry): JsonValue {
  return {
    measuredOn: entry.measuredOn,
    kilograms: entry.kilograms,
    note: entry.note,
    recordedAt: entry.recordedAt,
  };
}

function goalPayload(goal: WeightGoal): JsonValue {
  return {
    targetKilograms: goal.targetKilograms,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt,
  };
}

export class LocalFirstWeightRepository implements WeightRepository {
  private readonly entities: LocalEntityRepository;

  public constructor(
    private readonly database: LocalDatabase,
    clock: Clock,
    ids: IdGenerator,
  ) {
    this.entities = new LocalEntityRepository(database, clock, ids);
  }

  public async getEntry(ownerId: UserId, id: EntityId): Promise<Result<WeightEntry | null>> {
    if (!ownerMatches(this.database, ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      const entity = await this.database.getEntity(weightEntityTypes.entry, id);
      if (!entity || entity.deletedAt) return success(null);
      return parseEntry(entity);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }

  public async listEntries(ownerId: UserId): Promise<Result<readonly WeightEntry[]>> {
    if (!ownerMatches(this.database, ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      const entities = await this.database.listEntities(weightEntityTypes.entry);
      const parsed: WeightEntry[] = [];
      for (const entity of entities) {
        const entry = parseEntry(entity);
        if (!entry.ok) return entry;
        parsed.push(entry.value);
      }
      return success(parsed);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }

  public async saveEntry(entry: WeightEntry): Promise<Result<WeightEntry>> {
    if (!ownerMatches(this.database, entry.ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      await this.entities.save(weightEntityTypes.entry, entry.id, entryPayload(entry));
      return success(entry);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }

  public async removeEntry(ownerId: UserId, id: EntityId): Promise<Result<void>> {
    if (!ownerMatches(this.database, ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      await this.entities.remove(weightEntityTypes.entry, id);
      return success(undefined);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }

  public async getGoal(ownerId: UserId): Promise<Result<WeightGoal | null>> {
    if (!ownerMatches(this.database, ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      const [entity] = await this.database.listEntities(weightEntityTypes.goal);
      return entity ? parseGoal(entity) : success(null);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }

  public async saveGoal(goal: WeightGoal): Promise<Result<WeightGoal>> {
    if (!ownerMatches(this.database, goal.ownerId)) {
      return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
    }
    try {
      await this.entities.save(weightEntityTypes.goal, goal.id, goalPayload(goal));
      return success(goal);
    } catch {
      return failure({ kind: 'unavailable', code: 'weight_storage_unavailable' });
    }
  }
}
