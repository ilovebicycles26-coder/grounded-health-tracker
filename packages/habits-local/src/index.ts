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
  habitCategories,
  habitEntityTypes,
  type HabitCompletion,
  type HabitDefinition,
  type HabitRepository,
  type WellbeingCheckin,
} from '@grounded/habits';
import {
  LocalEntityRepository,
  type JsonValue,
  type LocalDatabase,
  type LocalEntity,
} from '@grounded/local-store';
type JsonObject = { readonly [key: string]: JsonValue };
const object = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));
function parseDefinition(entity: LocalEntity): Result<HabitDefinition> {
  if (!object(entity.payload)) return failure({ kind: 'unavailable', code: 'invalid_local_habit' });
  const p = entity.payload;
  if (
    typeof p.name !== 'string' ||
    typeof p.category !== 'string' ||
    !habitCategories.includes(p.category as never) ||
    !Array.isArray(p.weekdays) ||
    p.weekdays.some((day) => typeof day !== 'number') ||
    (p.reminderTime !== null && typeof p.reminderTime !== 'string') ||
    !timestamp(p.createdAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_habit' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    name: p.name,
    category: p.category as HabitDefinition['category'],
    weekdays: p.weekdays as number[],
    reminderTime: p.reminderTime,
    createdAt: p.createdAt,
  });
}
function parseCompletion(entity: LocalEntity): Result<HabitCompletion> {
  if (!object(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_completion' });
  const p = entity.payload;
  const date = typeof p.completedOn === 'string' ? asIsoDate(p.completedOn) : null;
  if (typeof p.habitId !== 'string' || !date?.ok || !timestamp(p.createdAt))
    return failure({ kind: 'unavailable', code: 'invalid_local_completion' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    habitId: p.habitId as EntityId,
    completedOn: date.value,
    createdAt: p.createdAt,
  });
}
function parseCheckin(entity: LocalEntity): Result<WellbeingCheckin> {
  if (!object(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_checkin' });
  const p = entity.payload;
  const date = typeof p.checkedOn === 'string' ? asIsoDate(p.checkedOn) : null;
  if (
    !date?.ok ||
    typeof p.mood !== 'number' ||
    typeof p.energy !== 'number' ||
    typeof p.sleepQuality !== 'number' ||
    (p.note !== null && typeof p.note !== 'string') ||
    !timestamp(p.createdAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_checkin' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    checkedOn: date.value,
    mood: p.mood,
    energy: p.energy,
    sleepQuality: p.sleepQuality,
    note: p.note,
    createdAt: p.createdAt,
  });
}
function payload<T extends { readonly id: EntityId; readonly ownerId: UserId }>(
  record: T,
): JsonValue {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'id' && key !== 'ownerId'),
  );
}
const mismatch = (): Result<never> =>
  failure({ kind: 'unavailable', code: 'local_account_mismatch' });
export class LocalFirstHabitRepository implements HabitRepository {
  private readonly entities: LocalEntityRepository;
  public constructor(
    private readonly database: LocalDatabase,
    clock: Clock,
    ids: IdGenerator,
  ) {
    this.entities = new LocalEntityRepository(database, clock, ids);
  }
  private owner(id: UserId) {
    return id === this.database.ownerId;
  }
  private async list<T>(
    type: string,
    parser: (entity: LocalEntity) => Result<T>,
  ): Promise<Result<readonly T[]>> {
    try {
      const result: T[] = [];
      for (const entity of await this.database.listEntities(type)) {
        const parsed = parser(entity);
        if (!parsed.ok) return parsed;
        result.push(parsed.value);
      }
      return success(result);
    } catch {
      return failure({ kind: 'unavailable', code: 'habit_storage_unavailable' });
    }
  }
  public async getDefinition(ownerId: UserId, id: EntityId) {
    if (!this.owner(ownerId)) return mismatch();
    const entity = await this.database.getEntity(habitEntityTypes.definition, id);
    return entity && !entity.deletedAt ? parseDefinition(entity) : success(null);
  }
  public listDefinitions(ownerId: UserId) {
    return this.owner(ownerId)
      ? this.list(habitEntityTypes.definition, parseDefinition)
      : Promise.resolve(mismatch());
  }
  public async saveDefinition(item: HabitDefinition) {
    if (!this.owner(item.ownerId)) return mismatch();
    await this.entities.save(habitEntityTypes.definition, item.id, payload(item));
    return success(item);
  }
  public async archiveDefinition(ownerId: UserId, id: EntityId) {
    if (!this.owner(ownerId)) return mismatch();
    await this.entities.remove(habitEntityTypes.definition, id);
    return success(undefined);
  }
  public listCompletions(ownerId: UserId) {
    return this.owner(ownerId)
      ? this.list(habitEntityTypes.completion, parseCompletion)
      : Promise.resolve(mismatch());
  }
  public async saveCompletion(item: HabitCompletion) {
    if (!this.owner(item.ownerId)) return mismatch();
    await this.entities.save(habitEntityTypes.completion, item.id, payload(item));
    return success(item);
  }
  public async removeCompletion(ownerId: UserId, id: EntityId) {
    if (!this.owner(ownerId)) return mismatch();
    await this.entities.remove(habitEntityTypes.completion, id);
    return success(undefined);
  }
  public listCheckins(ownerId: UserId) {
    return this.owner(ownerId)
      ? this.list(habitEntityTypes.wellbeing, parseCheckin)
      : Promise.resolve(mismatch());
  }
  public async saveCheckin(item: WellbeingCheckin) {
    if (!this.owner(item.ownerId)) return mismatch();
    await this.entities.save(habitEntityTypes.wellbeing, item.id, payload(item));
    return success(item);
  }
}
