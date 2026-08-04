import type { UserId } from '@grounded/domain';
import type { JsonValue, OutboxOperation, RemoteEntity } from '@grounded/local-store';
import type { PushOutcome, SyncTransport } from '@grounded/sync';
import { asWeightKilograms, weightEntityTypes } from '@grounded/weight';

import type { Database } from './database';
import type { GroundedSupabaseClient } from './index';

type EntryRow = Database['public']['Tables']['weight_entries']['Row'];
type GoalRow = Database['public']['Tables']['weight_goals']['Row'];
type JsonObject = { readonly [key: string]: JsonValue };

function isObject(value: JsonValue | null): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entryPayload(row: EntryRow): JsonValue | null {
  if (row.deleted_at) return null;
  return {
    measuredOn: row.measured_on,
    kilograms: Number(row.weight_kg),
    note: row.note,
    recordedAt: row.created_at,
  };
}

function goalPayload(row: GoalRow): JsonValue | null {
  if (row.deleted_at) return null;
  return {
    targetKilograms: Number(row.target_weight_kg),
    targetDate: row.target_date,
    createdAt: row.created_at,
  };
}

function ack(operationId: string, row: EntryRow | GoalRow): PushOutcome {
  return { kind: 'ack', operationId, revision: row.revision, updatedAt: row.updated_at };
}

function conflict(
  operationId: string,
  row: EntryRow | GoalRow | null,
  payload: JsonValue | null,
): PushOutcome {
  return {
    kind: 'conflict',
    operationId,
    remotePayload: payload,
    remoteRevision: row?.revision ?? 0,
    remoteUpdatedAt: row?.updated_at ?? new Date(0).toISOString(),
  };
}

function retry(operationId: string): PushOutcome {
  return { kind: 'retry', operationId };
}

function parseEntryMutation(operation: OutboxOperation) {
  if (!isObject(operation.payload)) return null;
  const measuredOn = operation.payload.measuredOn;
  const kilogramsValue = operation.payload.kilograms;
  const note = operation.payload.note;
  const kilograms = typeof kilogramsValue === 'number' ? asWeightKilograms(kilogramsValue) : null;
  if (
    typeof measuredOn !== 'string' ||
    !kilograms?.ok ||
    (note !== null && typeof note !== 'string')
  ) {
    return null;
  }
  return { measured_on: measuredOn, weight_kg: kilograms.value, note };
}

function parseGoalMutation(operation: OutboxOperation) {
  if (!isObject(operation.payload)) return null;
  const targetValue = operation.payload.targetKilograms;
  const targetDate = operation.payload.targetDate;
  const target = typeof targetValue === 'number' ? asWeightKilograms(targetValue) : null;
  if (!target?.ok || (targetDate !== null && typeof targetDate !== 'string')) return null;
  return { target_weight_kg: target.value, target_date: targetDate };
}

export class SupabaseWeightSyncTransport implements SyncTransport {
  public readonly supportedEntityTypes = Object.values(weightEntityTypes);
  public constructor(
    private readonly client: GroundedSupabaseClient,
    private readonly ownerId: UserId,
  ) {}

  public async push(operations: readonly OutboxOperation[]): Promise<readonly PushOutcome[]> {
    const outcomes: PushOutcome[] = [];
    for (const operation of operations) {
      if (operation.ownerId !== this.ownerId) {
        outcomes.push(retry(operation.operationId));
      } else if (operation.entityType === weightEntityTypes.entry) {
        outcomes.push(await this.pushEntry(operation));
      } else if (operation.entityType === weightEntityTypes.goal) {
        outcomes.push(await this.pushGoal(operation));
      } else {
        outcomes.push(retry(operation.operationId));
      }
    }
    return outcomes;
  }

  public async pull(
    cursor: string | null,
    limit: number,
  ): Promise<{ readonly entities: readonly RemoteEntity[]; readonly nextCursor: string | null }> {
    let entriesQuery = this.client
      .from('weight_entries')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at', { ascending: true })
      .limit(limit);
    let goalsQuery = this.client
      .from('weight_goals')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (cursor) {
      entriesQuery = entriesQuery.gte('updated_at', cursor);
      goalsQuery = goalsQuery.gte('updated_at', cursor);
    }
    const [entries, goals] = await Promise.all([entriesQuery, goalsQuery]);
    if (entries.error || goals.error) throw new Error('Weight sync pull failed.');
    const entities: RemoteEntity[] = [
      ...entries.data.map((row) => this.mapEntry(row)),
      ...goals.data.map((row) => this.mapGoal(row)),
    ].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    return {
      entities,
      nextCursor: entities.at(-1)?.updatedAt ?? cursor,
    };
  }

  private async pushEntry(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('weight_entries')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);

    if (operation.kind === 'upsert') {
      const values = parseEntryMutation(operation);
      if (!values) return retry(operation.operationId);
      if (operation.baseRevision === 0) {
        const inserted = await this.client
          .from('weight_entries')
          .insert({
            id: operation.entityId,
            user_id: this.ownerId,
            ...values,
            last_operation_id: operation.operationId,
          })
          .select('*')
          .single();
        if (!inserted.error) return ack(operation.operationId, inserted.data);
        return inserted.error.code === '23505'
          ? this.entryConflict(operation)
          : retry(operation.operationId);
      }
      const updated = await this.client
        .from('weight_entries')
        .update({ ...values, deleted_at: null, last_operation_id: operation.operationId })
        .eq('id', operation.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', operation.baseRevision)
        .select('*')
        .maybeSingle();
      if (updated.error) return retry(operation.operationId);
      return updated.data
        ? ack(operation.operationId, updated.data)
        : this.entryConflict(operation);
    }

    const removed = await this.client
      .from('weight_entries')
      .update({ deleted_at: new Date().toISOString(), last_operation_id: operation.operationId })
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', operation.baseRevision)
      .select('*')
      .maybeSingle();
    if (removed.error) return retry(operation.operationId);
    return removed.data ? ack(operation.operationId, removed.data) : this.entryConflict(operation);
  }

  private async entryConflict(operation: OutboxOperation): Promise<PushOutcome> {
    const current = await this.client
      .from('weight_entries')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    if (current.error) return retry(operation.operationId);
    return conflict(
      operation.operationId,
      current.data,
      current.data ? entryPayload(current.data) : null,
    );
  }

  private async pushGoal(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('weight_goals')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);

    if (operation.kind === 'upsert') {
      const values = parseGoalMutation(operation);
      if (!values) return retry(operation.operationId);
      if (operation.baseRevision === 0) {
        const inserted = await this.client
          .from('weight_goals')
          .insert({
            id: operation.entityId,
            user_id: this.ownerId,
            ...values,
            last_operation_id: operation.operationId,
          })
          .select('*')
          .single();
        if (!inserted.error) return ack(operation.operationId, inserted.data);
        return inserted.error.code === '23505'
          ? this.goalConflict(operation)
          : retry(operation.operationId);
      }
      const updated = await this.client
        .from('weight_goals')
        .update({ ...values, deleted_at: null, last_operation_id: operation.operationId })
        .eq('id', operation.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', operation.baseRevision)
        .select('*')
        .maybeSingle();
      if (updated.error) return retry(operation.operationId);
      return updated.data ? ack(operation.operationId, updated.data) : this.goalConflict(operation);
    }

    const removed = await this.client
      .from('weight_goals')
      .update({ deleted_at: new Date().toISOString(), last_operation_id: operation.operationId })
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', operation.baseRevision)
      .select('*')
      .maybeSingle();
    if (removed.error) return retry(operation.operationId);
    return removed.data ? ack(operation.operationId, removed.data) : this.goalConflict(operation);
  }

  private async goalConflict(operation: OutboxOperation): Promise<PushOutcome> {
    const current = await this.client
      .from('weight_goals')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    if (current.error) return retry(operation.operationId);
    return conflict(
      operation.operationId,
      current.data,
      current.data ? goalPayload(current.data) : null,
    );
  }

  private mapEntry(row: EntryRow): RemoteEntity {
    return {
      ownerId: this.ownerId,
      entityType: weightEntityTypes.entry,
      id: row.id,
      payload: entryPayload(row) ?? {},
      revision: row.revision,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapGoal(row: GoalRow): RemoteEntity {
    return {
      ownerId: this.ownerId,
      entityType: weightEntityTypes.goal,
      id: row.id,
      payload: goalPayload(row) ?? {},
      revision: row.revision,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
