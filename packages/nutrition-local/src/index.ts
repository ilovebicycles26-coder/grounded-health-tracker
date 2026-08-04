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
  mealTypes,
  nutritionEntityTypes,
  type FoodEntry,
  type FoodFavourite,
  type NutritionRepository,
  type NutritionTarget,
} from '@grounded/nutrition';

type JsonObject = { readonly [key: string]: JsonValue };

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function asOptionalNumber(value: JsonValue | undefined): number | null | undefined {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
    ? value
    : undefined;
}

function values(payload: JsonObject) {
  const proteinGrams = asOptionalNumber(payload.proteinGrams);
  const carbohydrateGrams = asOptionalNumber(payload.carbohydrateGrams);
  const fatGrams = asOptionalNumber(payload.fatGrams);
  if (
    typeof payload.caloriesKcal !== 'number' ||
    !Number.isFinite(payload.caloriesKcal) ||
    proteinGrams === undefined ||
    carbohydrateGrams === undefined ||
    fatGrams === undefined
  )
    return null;
  return { caloriesKcal: payload.caloriesKcal, proteinGrams, carbohydrateGrams, fatGrams };
}

function parseEntry(entity: LocalEntity): Result<FoodEntry> {
  if (!isObject(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_food_entry' });
  const payload = entity.payload;
  const date = typeof payload.consumedOn === 'string' ? asIsoDate(payload.consumedOn) : null;
  const nutrition = values(payload);
  if (
    !date?.ok ||
    !nutrition ||
    typeof payload.mealType !== 'string' ||
    !mealTypes.includes(payload.mealType as never) ||
    typeof payload.name !== 'string' ||
    typeof payload.quantity !== 'number' ||
    typeof payload.unit !== 'string' ||
    (payload.note !== null && typeof payload.note !== 'string') ||
    !isTimestamp(payload.createdAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_food_entry' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    consumedOn: date.value,
    mealType: payload.mealType as FoodEntry['mealType'],
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    ...nutrition,
    note: payload.note,
    createdAt: payload.createdAt,
  });
}

function parseTarget(entity: LocalEntity): Result<NutritionTarget> {
  if (!isObject(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_nutrition_target' });
  const date =
    typeof entity.payload.effectiveFrom === 'string'
      ? asIsoDate(entity.payload.effectiveFrom)
      : null;
  const nutrition = values(entity.payload);
  if (!date?.ok || !nutrition || !isTimestamp(entity.payload.createdAt))
    return failure({ kind: 'unavailable', code: 'invalid_local_nutrition_target' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    effectiveFrom: date.value,
    ...nutrition,
    createdAt: entity.payload.createdAt,
  });
}

function parseFavourite(entity: LocalEntity): Result<FoodFavourite> {
  if (!isObject(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_food_favourite' });
  const nutrition = values(entity.payload);
  if (
    !nutrition ||
    typeof entity.payload.name !== 'string' ||
    typeof entity.payload.quantity !== 'number' ||
    typeof entity.payload.unit !== 'string' ||
    !isTimestamp(entity.payload.createdAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_food_favourite' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    name: entity.payload.name,
    quantity: entity.payload.quantity,
    unit: entity.payload.unit,
    ...nutrition,
    createdAt: entity.payload.createdAt,
  });
}

function payload(
  record: Omit<FoodEntry | NutritionTarget | FoodFavourite, 'id' | 'ownerId'>,
): JsonValue {
  return { ...record };
}

export class LocalFirstNutritionRepository implements NutritionRepository {
  private readonly entities: LocalEntityRepository;
  public constructor(
    private readonly database: LocalDatabase,
    clock: Clock,
    ids: IdGenerator,
  ) {
    this.entities = new LocalEntityRepository(database, clock, ids);
  }
  private owner(ownerId: UserId): Result<void> {
    return ownerId === this.database.ownerId
      ? success(undefined)
      : failure({ kind: 'unavailable', code: 'local_account_mismatch' });
  }
  private async list<T>(
    entityType: string,
    parse: (entity: LocalEntity) => Result<T>,
  ): Promise<Result<readonly T[]>> {
    try {
      const result: T[] = [];
      for (const entity of await this.database.listEntities(entityType)) {
        const item = parse(entity);
        if (!item.ok) return item;
        result.push(item.value);
      }
      return success(result);
    } catch {
      return failure({ kind: 'unavailable', code: 'nutrition_storage_unavailable' });
    }
  }
  public async getEntry(ownerId: UserId, id: EntityId): Promise<Result<FoodEntry | null>> {
    const owner = this.owner(ownerId);
    if (!owner.ok) return owner;
    try {
      const entity = await this.database.getEntity(nutritionEntityTypes.entry, id);
      return entity && !entity.deletedAt ? parseEntry(entity) : success(null);
    } catch {
      return failure({ kind: 'unavailable', code: 'nutrition_storage_unavailable' });
    }
  }
  public listEntries(ownerId: UserId) {
    const owner = this.owner(ownerId);
    return owner.ok ? this.list(nutritionEntityTypes.entry, parseEntry) : Promise.resolve(owner);
  }
  public async saveEntry(entry: FoodEntry) {
    const owner = this.owner(entry.ownerId);
    if (!owner.ok) return owner;
    await this.entities.save(nutritionEntityTypes.entry, entry.id, payload(entry));
    return success(entry);
  }
  public async removeEntry(ownerId: UserId, id: EntityId) {
    const owner = this.owner(ownerId);
    if (!owner.ok) return owner;
    await this.entities.remove(nutritionEntityTypes.entry, id);
    return success(undefined);
  }
  public listTargets(ownerId: UserId) {
    const owner = this.owner(ownerId);
    return owner.ok ? this.list(nutritionEntityTypes.target, parseTarget) : Promise.resolve(owner);
  }
  public async saveTarget(target: NutritionTarget) {
    const owner = this.owner(target.ownerId);
    if (!owner.ok) return owner;
    await this.entities.save(nutritionEntityTypes.target, target.id, payload(target));
    return success(target);
  }
  public listFavourites(ownerId: UserId) {
    const owner = this.owner(ownerId);
    return owner.ok
      ? this.list(nutritionEntityTypes.favourite, parseFavourite)
      : Promise.resolve(owner);
  }
  public async saveFavourite(favourite: FoodFavourite) {
    const owner = this.owner(favourite.ownerId);
    if (!owner.ok) return owner;
    await this.entities.save(nutritionEntityTypes.favourite, favourite.id, payload(favourite));
    return success(favourite);
  }
  public async removeFavourite(ownerId: UserId, id: EntityId) {
    const owner = this.owner(ownerId);
    if (!owner.ok) return owner;
    await this.entities.remove(nutritionEntityTypes.favourite, id);
    return success(undefined);
  }
}
