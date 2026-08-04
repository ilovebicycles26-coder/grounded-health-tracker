import type { UserId } from '@grounded/domain';
import type { JsonValue, OutboxOperation, RemoteEntity } from '@grounded/local-store';
import { mealTypes, nutritionEntityTypes } from '@grounded/nutrition';
import type { PushOutcome, SyncTransport } from '@grounded/sync';

import type { Database } from './database';
import type { GroundedSupabaseClient } from './index';

type EntryRow = Database['public']['Tables']['food_entries']['Row'];
type TargetRow = Database['public']['Tables']['nutrition_targets']['Row'];
type FavouriteRow = Database['public']['Tables']['food_favourites']['Row'];
type NutritionRow = EntryRow | TargetRow | FavouriteRow;
type JsonObject = { readonly [key: string]: JsonValue };

function isObject(value: JsonValue | null): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrNull(value: JsonValue | undefined): number | null | undefined {
  return value === null || typeof value === 'number' ? value : undefined;
}

function nutritionMutation(payload: JsonObject) {
  const calories = payload.caloriesKcal;
  const protein = numberOrNull(payload.proteinGrams);
  const carbs = numberOrNull(payload.carbohydrateGrams);
  const fat = numberOrNull(payload.fatGrams);
  if (
    typeof calories !== 'number' ||
    protein === undefined ||
    carbs === undefined ||
    fat === undefined
  )
    return null;
  return { calories_kcal: calories, protein_g: protein, carbs_g: carbs, fat_g: fat };
}

function entryMutation(operation: OutboxOperation) {
  if (!isObject(operation.payload)) return null;
  const payload = operation.payload;
  const nutrition = nutritionMutation(payload);
  if (
    !nutrition ||
    typeof payload.consumedOn !== 'string' ||
    typeof payload.mealType !== 'string' ||
    !mealTypes.includes(payload.mealType as never) ||
    typeof payload.name !== 'string' ||
    typeof payload.quantity !== 'number' ||
    typeof payload.unit !== 'string' ||
    (payload.note !== null && typeof payload.note !== 'string')
  )
    return null;
  return {
    consumed_on: payload.consumedOn,
    meal_type: payload.mealType as EntryRow['meal_type'],
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    note: payload.note,
    ...nutrition,
  };
}

function targetMutation(operation: OutboxOperation) {
  if (!isObject(operation.payload)) return null;
  const nutrition = nutritionMutation(operation.payload);
  return nutrition && typeof operation.payload.effectiveFrom === 'string'
    ? { effective_from: operation.payload.effectiveFrom, ...nutrition }
    : null;
}

function favouriteMutation(operation: OutboxOperation) {
  if (!isObject(operation.payload)) return null;
  const payload = operation.payload;
  const nutrition = nutritionMutation(payload);
  return nutrition &&
    typeof payload.name === 'string' &&
    typeof payload.quantity === 'number' &&
    typeof payload.unit === 'string'
    ? { name: payload.name, quantity: payload.quantity, unit: payload.unit, ...nutrition }
    : null;
}

function entryPayload(row: EntryRow): JsonValue {
  return {
    consumedOn: row.consumed_on,
    mealType: row.meal_type,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    caloriesKcal: Number(row.calories_kcal),
    proteinGrams: row.protein_g === null ? null : Number(row.protein_g),
    carbohydrateGrams: row.carbs_g === null ? null : Number(row.carbs_g),
    fatGrams: row.fat_g === null ? null : Number(row.fat_g),
    note: row.note,
    createdAt: row.created_at,
  };
}

function targetPayload(row: TargetRow): JsonValue {
  return {
    effectiveFrom: row.effective_from,
    caloriesKcal: Number(row.calories_kcal),
    proteinGrams: row.protein_g === null ? null : Number(row.protein_g),
    carbohydrateGrams: row.carbs_g === null ? null : Number(row.carbs_g),
    fatGrams: row.fat_g === null ? null : Number(row.fat_g),
    createdAt: row.created_at,
  };
}

function favouritePayload(row: FavouriteRow): JsonValue {
  return {
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    caloriesKcal: Number(row.calories_kcal),
    proteinGrams: row.protein_g === null ? null : Number(row.protein_g),
    carbohydrateGrams: row.carbs_g === null ? null : Number(row.carbs_g),
    fatGrams: row.fat_g === null ? null : Number(row.fat_g),
    createdAt: row.created_at,
  };
}

const ack = (operationId: string, row: NutritionRow): PushOutcome => ({
  kind: 'ack',
  operationId,
  revision: row.revision,
  updatedAt: row.updated_at,
});
const retry = (operationId: string): PushOutcome => ({ kind: 'retry', operationId });
const conflict = (
  operationId: string,
  row: NutritionRow | null,
  payload: JsonValue | null,
): PushOutcome => ({
  kind: 'conflict',
  operationId,
  remotePayload: payload,
  remoteRevision: row?.revision ?? 0,
  remoteUpdatedAt: row?.updated_at ?? new Date(0).toISOString(),
});

export class SupabaseNutritionSyncTransport implements SyncTransport {
  public readonly supportedEntityTypes = Object.values(nutritionEntityTypes);
  public constructor(
    private readonly client: GroundedSupabaseClient,
    private readonly ownerId: UserId,
  ) {}

  public async push(operations: readonly OutboxOperation[]): Promise<readonly PushOutcome[]> {
    const outcomes: PushOutcome[] = [];
    for (const operation of operations) {
      if (operation.ownerId !== this.ownerId) outcomes.push(retry(operation.operationId));
      else if (operation.entityType === nutritionEntityTypes.entry)
        outcomes.push(await this.pushEntry(operation));
      else if (operation.entityType === nutritionEntityTypes.target)
        outcomes.push(await this.pushTarget(operation));
      else if (operation.entityType === nutritionEntityTypes.favourite)
        outcomes.push(await this.pushFavourite(operation));
      else outcomes.push(retry(operation.operationId));
    }
    return outcomes;
  }

  public async pull(cursor: string | null, limit: number) {
    const configure = <T extends { gte(column: string, value: string): T }>(query: T): T =>
      cursor ? query.gte('updated_at', cursor) : query;
    const [entries, targets, favourites] = await Promise.all([
      configure(
        this.client
          .from('food_entries')
          .select('*')
          .eq('user_id', this.ownerId)
          .order('updated_at')
          .limit(limit),
      ),
      configure(
        this.client
          .from('nutrition_targets')
          .select('*')
          .eq('user_id', this.ownerId)
          .order('updated_at')
          .limit(limit),
      ),
      configure(
        this.client
          .from('food_favourites')
          .select('*')
          .eq('user_id', this.ownerId)
          .order('updated_at')
          .limit(limit),
      ),
    ]);
    if (entries.error || targets.error || favourites.error)
      throw new Error('Nutrition sync pull failed.');
    const entities: RemoteEntity[] = [
      ...entries.data.map((row) => this.remote(nutritionEntityTypes.entry, row, entryPayload(row))),
      ...targets.data.map((row) =>
        this.remote(nutritionEntityTypes.target, row, targetPayload(row)),
      ),
      ...favourites.data.map((row) =>
        this.remote(nutritionEntityTypes.favourite, row, favouritePayload(row)),
      ),
    ].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    return { entities, nextCursor: entities.at(-1)?.updatedAt ?? cursor };
  }

  private remote(entityType: string, row: NutritionRow, payload: JsonValue): RemoteEntity {
    return {
      ownerId: this.ownerId,
      entityType,
      id: row.id,
      payload: row.deleted_at ? {} : payload,
      revision: row.revision,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private async pushEntry(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('food_entries')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') {
      const result = await this.client
        .from('food_entries')
        .update({ deleted_at: new Date().toISOString(), last_operation_id: operation.operationId })
        .eq('id', operation.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', operation.baseRevision)
        .select('*')
        .maybeSingle();
      return result.error
        ? retry(operation.operationId)
        : result.data
          ? ack(operation.operationId, result.data)
          : this.entryConflict(operation);
    }
    const values = entryMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('food_entries')
        .insert({
          id: operation.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: operation.operationId,
        })
        .select('*')
        .single();
      return !result.error
        ? ack(operation.operationId, result.data)
        : result.error.code === '23505'
          ? this.entryConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('food_entries')
      .update({ ...values, deleted_at: null, last_operation_id: operation.operationId })
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', operation.baseRevision)
      .select('*')
      .maybeSingle();
    return result.error
      ? retry(operation.operationId)
      : result.data
        ? ack(operation.operationId, result.data)
        : this.entryConflict(operation);
  }

  private async entryConflict(operation: OutboxOperation): Promise<PushOutcome> {
    const current = await this.client
      .from('food_entries')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? entryPayload(current.data) : null,
        );
  }

  private async pushTarget(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('nutrition_targets')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') return retry(operation.operationId);
    const values = targetMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('nutrition_targets')
        .insert({
          id: operation.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: operation.operationId,
        })
        .select('*')
        .single();
      return !result.error
        ? ack(operation.operationId, result.data)
        : result.error.code === '23505'
          ? this.targetConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('nutrition_targets')
      .update({ ...values, deleted_at: null, last_operation_id: operation.operationId })
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', operation.baseRevision)
      .select('*')
      .maybeSingle();
    return result.error
      ? retry(operation.operationId)
      : result.data
        ? ack(operation.operationId, result.data)
        : this.targetConflict(operation);
  }

  private async targetConflict(operation: OutboxOperation): Promise<PushOutcome> {
    const current = await this.client
      .from('nutrition_targets')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? targetPayload(current.data) : null,
        );
  }

  private async pushFavourite(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('food_favourites')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') {
      const result = await this.client
        .from('food_favourites')
        .update({ deleted_at: new Date().toISOString(), last_operation_id: operation.operationId })
        .eq('id', operation.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', operation.baseRevision)
        .select('*')
        .maybeSingle();
      return result.error
        ? retry(operation.operationId)
        : result.data
          ? ack(operation.operationId, result.data)
          : this.favouriteConflict(operation);
    }
    const values = favouriteMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('food_favourites')
        .insert({
          id: operation.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: operation.operationId,
        })
        .select('*')
        .single();
      return !result.error
        ? ack(operation.operationId, result.data)
        : result.error.code === '23505'
          ? this.favouriteConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('food_favourites')
      .update({ ...values, deleted_at: null, last_operation_id: operation.operationId })
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', operation.baseRevision)
      .select('*')
      .maybeSingle();
    return result.error
      ? retry(operation.operationId)
      : result.data
        ? ack(operation.operationId, result.data)
        : this.favouriteConflict(operation);
  }

  private async favouriteConflict(operation: OutboxOperation): Promise<PushOutcome> {
    const current = await this.client
      .from('food_favourites')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? favouritePayload(current.data) : null,
        );
  }
}
