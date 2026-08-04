import type { Clock, IdGenerator } from '@grounded/application';
import {
  asIsoDate,
  failure,
  success,
  type EntityId,
  type IsoDate,
  type Result,
  type UserId,
} from '@grounded/domain';

export const nutritionEntityTypes = {
  entry: 'nutrition-entry:v1',
  target: 'nutrition-target:v1',
  favourite: 'nutrition-favourite:v1',
} as const;

export const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof mealTypes)[number];

export interface NutritionValues {
  readonly caloriesKcal: number;
  readonly proteinGrams: number | null;
  readonly carbohydrateGrams: number | null;
  readonly fatGrams: number | null;
}

export interface FoodEntry extends NutritionValues {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly consumedOn: IsoDate;
  readonly mealType: MealType;
  readonly name: string;
  readonly quantity: number;
  readonly unit: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface NutritionTarget extends NutritionValues {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly effectiveFrom: IsoDate;
  readonly createdAt: string;
}

export interface FoodFavourite extends NutritionValues {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly quantity: number;
  readonly unit: string;
  readonly createdAt: string;
}

export interface NutritionRepository {
  getEntry(ownerId: UserId, id: EntityId): Promise<Result<FoodEntry | null>>;
  listEntries(ownerId: UserId): Promise<Result<readonly FoodEntry[]>>;
  saveEntry(entry: FoodEntry): Promise<Result<FoodEntry>>;
  removeEntry(ownerId: UserId, id: EntityId): Promise<Result<void>>;
  listTargets(ownerId: UserId): Promise<Result<readonly NutritionTarget[]>>;
  saveTarget(target: NutritionTarget): Promise<Result<NutritionTarget>>;
  listFavourites(ownerId: UserId): Promise<Result<readonly FoodFavourite[]>>;
  saveFavourite(favourite: FoodFavourite): Promise<Result<FoodFavourite>>;
  removeFavourite(ownerId: UserId, id: EntityId): Promise<Result<void>>;
}

function boundedNumber(
  value: number | null | undefined,
  field: string,
  maximum: number,
  optional = false,
): Result<number | null> {
  if (optional && (value === null || value === undefined)) return success(null);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    return failure({ kind: 'validation', code: `invalid_${field}`, field });
  }
  return success(Math.round(value * 10) / 10);
}

function nutritionValues(input: {
  readonly caloriesKcal: number;
  readonly proteinGrams?: number | null;
  readonly carbohydrateGrams?: number | null;
  readonly fatGrams?: number | null;
}): Result<NutritionValues> {
  const calories = boundedNumber(input.caloriesKcal, 'calories', 10_000);
  const protein = boundedNumber(input.proteinGrams, 'protein', 1_000, true);
  const carbohydrate = boundedNumber(input.carbohydrateGrams, 'carbohydrate', 2_000, true);
  const fat = boundedNumber(input.fatGrams, 'fat', 1_000, true);
  if (!calories.ok) return calories;
  if (!protein.ok) return protein;
  if (!carbohydrate.ok) return carbohydrate;
  if (!fat.ok) return fat;
  return success({
    caloriesKcal: calories.value ?? 0,
    proteinGrams: protein.value,
    carbohydrateGrams: carbohydrate.value,
    fatGrams: fat.value,
  });
}

function requiredText(value: string, field: string, maximum: number): Result<string> {
  const text = value.trim();
  if (!text || text.length > maximum) {
    return failure({ kind: 'validation', code: `invalid_${field}`, field });
  }
  return success(text);
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maximum: number,
): Result<string | null> {
  const text = value?.trim() ?? '';
  return text.length > maximum
    ? failure({ kind: 'validation', code: `invalid_${field}`, field })
    : success(text || null);
}

export interface SaveFoodEntryInput {
  readonly ownerId: UserId;
  readonly id?: EntityId;
  readonly consumedOn: string;
  readonly mealType: MealType;
  readonly name: string;
  readonly quantity: number;
  readonly unit: string;
  readonly caloriesKcal: number;
  readonly proteinGrams?: number | null;
  readonly carbohydrateGrams?: number | null;
  readonly fatGrams?: number | null;
  readonly note?: string | null;
}

export interface SaveNutritionTargetInput {
  readonly ownerId: UserId;
  readonly effectiveFrom: string;
  readonly caloriesKcal: number;
  readonly proteinGrams?: number | null;
  readonly carbohydrateGrams?: number | null;
  readonly fatGrams?: number | null;
}

export interface SaveFoodFavouriteInput {
  readonly ownerId: UserId;
  readonly name: string;
  readonly quantity: number;
  readonly unit: string;
  readonly caloriesKcal: number;
  readonly proteinGrams?: number | null;
  readonly carbohydrateGrams?: number | null;
  readonly fatGrams?: number | null;
}

function validQuantity(value: number): Result<number> {
  return Number.isFinite(value) && value > 0 && value <= 10_000
    ? success(Math.round(value * 100) / 100)
    : failure({ kind: 'validation', code: 'invalid_quantity', field: 'quantity' });
}

export class NutritionService {
  public constructor(
    private readonly repository: NutritionRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async saveEntry(input: SaveFoodEntryInput): Promise<Result<FoodEntry>> {
    const date = asIsoDate(input.consumedOn);
    const name = requiredText(input.name, 'name', 120);
    const quantity = validQuantity(input.quantity);
    const unit = requiredText(input.unit, 'unit', 32);
    const values = nutritionValues(input);
    const note = optionalText(input.note, 'note', 240);
    if (!date.ok) return date;
    if (!mealTypes.includes(input.mealType)) {
      return failure({ kind: 'validation', code: 'invalid_meal_type', field: 'mealType' });
    }
    if (!name.ok) return name;
    if (!quantity.ok) return quantity;
    if (!unit.ok) return unit;
    if (!values.ok) return values;
    if (!note.ok) return note;
    const existing = input.id
      ? await this.repository.getEntry(input.ownerId, input.id)
      : success<FoodEntry | null>(null);
    if (!existing.ok) return existing;
    if (input.id && !existing.value) {
      return failure({ kind: 'not-found', code: 'food_entry_not_found' });
    }
    return this.repository.saveEntry({
      id: input.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      consumedOn: date.value,
      mealType: input.mealType,
      name: name.value,
      quantity: quantity.value,
      unit: unit.value,
      ...values.value,
      note: note.value,
      createdAt: existing.value?.createdAt ?? this.clock.now().toISOString(),
    });
  }

  public listEntries(ownerId: UserId) {
    return this.repository.listEntries(ownerId);
  }

  public removeEntry(ownerId: UserId, id: EntityId) {
    return this.repository.removeEntry(ownerId, id);
  }

  public async saveTarget(input: SaveNutritionTargetInput): Promise<Result<NutritionTarget>> {
    const date = asIsoDate(input.effectiveFrom);
    const values = nutritionValues(input);
    if (!date.ok) return date;
    if (!values.ok) return values;
    if (values.value.caloriesKcal > 0 && values.value.caloriesKcal < 1_200) {
      return failure({
        kind: 'validation',
        code: 'calorie_target_below_supported_range',
        field: 'calories',
      });
    }
    const targets = await this.repository.listTargets(input.ownerId);
    if (!targets.ok) return targets;
    const existing = targets.value.find((target) => target.effectiveFrom === date.value);
    return this.repository.saveTarget({
      id: existing?.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      effectiveFrom: date.value,
      ...values.value,
      createdAt: existing?.createdAt ?? this.clock.now().toISOString(),
    });
  }

  public listTargets(ownerId: UserId) {
    return this.repository.listTargets(ownerId);
  }

  public async saveFavourite(input: SaveFoodFavouriteInput): Promise<Result<FoodFavourite>> {
    const name = requiredText(input.name, 'name', 120);
    const quantity = validQuantity(input.quantity);
    const unit = requiredText(input.unit, 'unit', 32);
    const values = nutritionValues(input);
    if (!name.ok) return name;
    if (!quantity.ok) return quantity;
    if (!unit.ok) return unit;
    if (!values.ok) return values;
    return this.repository.saveFavourite({
      id: this.ids.create() as EntityId,
      ownerId: input.ownerId,
      name: name.value,
      quantity: quantity.value,
      unit: unit.value,
      ...values.value,
      createdAt: this.clock.now().toISOString(),
    });
  }

  public listFavourites(ownerId: UserId) {
    return this.repository.listFavourites(ownerId);
  }

  public removeFavourite(ownerId: UserId, id: EntityId) {
    return this.repository.removeFavourite(ownerId, id);
  }
}

export interface DailyNutritionSummary extends NutritionValues {
  readonly date: IsoDate;
  readonly entries: readonly FoodEntry[];
  readonly target: NutritionTarget | null;
  readonly remainingCalories: number | null;
}

export function calculateDailyNutrition(
  entries: readonly FoodEntry[],
  targets: readonly NutritionTarget[],
  date: IsoDate,
): DailyNutritionSummary {
  const daily = entries.filter((entry) => entry.consumedOn === date);
  const sum = (field: keyof NutritionValues): number | null => {
    const values = daily
      .map((entry) => entry[field])
      .filter((value): value is number => value !== null);
    return values.length
      ? Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10
      : null;
  };
  const target =
    [...targets]
      .filter((item) => item.effectiveFrom <= date)
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null;
  const caloriesKcal = sum('caloriesKcal') ?? 0;
  return {
    date,
    entries: daily,
    target,
    caloriesKcal,
    proteinGrams: sum('proteinGrams'),
    carbohydrateGrams: sum('carbohydrateGrams'),
    fatGrams: sum('fatGrams'),
    remainingCalories: target ? target.caloriesKcal - caloriesKcal : null,
  };
}
