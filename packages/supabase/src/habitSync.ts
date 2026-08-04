import type { UserId } from '@grounded/domain';
import { habitCategories, habitEntityTypes } from '@grounded/habits';
import type { JsonValue, OutboxOperation, RemoteEntity } from '@grounded/local-store';
import type { PushOutcome, SyncTransport } from '@grounded/sync';
import type { Database } from './database';
import type { GroundedSupabaseClient } from './index';

type DefinitionRow = Database['public']['Tables']['habit_definitions']['Row'];
type CompletionRow = Database['public']['Tables']['habit_completions']['Row'];
type CheckinRow = Database['public']['Tables']['wellbeing_checkins']['Row'];
type Row = DefinitionRow | CompletionRow | CheckinRow;
type JsonObject = { readonly [key: string]: JsonValue };
const object = (value: JsonValue | null): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const retry = (operationId: string): PushOutcome => ({ kind: 'retry', operationId });
const ack = (operationId: string, row: Row): PushOutcome => ({
  kind: 'ack',
  operationId,
  revision: row.revision,
  updatedAt: row.updated_at,
});
const conflict = (
  operationId: string,
  row: Row | null,
  payload: JsonValue | null,
): PushOutcome => ({
  kind: 'conflict',
  operationId,
  remotePayload: payload,
  remoteRevision: row?.revision ?? 0,
  remoteUpdatedAt: row?.updated_at ?? new Date(0).toISOString(),
});
const definitionPayload = (row: DefinitionRow): JsonValue => ({
  name: row.name,
  category: row.category,
  weekdays: row.weekdays,
  reminderTime: row.reminder_time?.slice(0, 5) ?? null,
  createdAt: row.created_at,
});
const completionPayload = (row: CompletionRow): JsonValue => ({
  habitId: row.habit_id,
  completedOn: row.completed_on,
  createdAt: row.created_at,
});
const checkinPayload = (row: CheckinRow): JsonValue => ({
  checkedOn: row.checked_on,
  mood: row.mood,
  energy: row.energy,
  sleepQuality: row.sleep_quality,
  note: row.note,
  createdAt: row.created_at,
});
function definitionMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  if (
    typeof p.name !== 'string' ||
    typeof p.category !== 'string' ||
    !habitCategories.includes(p.category as never) ||
    !Array.isArray(p.weekdays) ||
    p.weekdays.some((d) => typeof d !== 'number') ||
    (p.reminderTime !== null && typeof p.reminderTime !== 'string')
  )
    return null;
  return {
    name: p.name,
    category: p.category,
    weekdays: p.weekdays as number[],
    reminder_time: p.reminderTime,
  };
}
function completionMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  return typeof p.habitId === 'string' && typeof p.completedOn === 'string'
    ? { habit_id: p.habitId, completed_on: p.completedOn }
    : null;
}
function checkinMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  if (
    typeof p.checkedOn !== 'string' ||
    typeof p.mood !== 'number' ||
    typeof p.energy !== 'number' ||
    typeof p.sleepQuality !== 'number' ||
    (p.note !== null && typeof p.note !== 'string')
  )
    return null;
  return {
    checked_on: p.checkedOn,
    mood: p.mood,
    energy: p.energy,
    sleep_quality: p.sleepQuality,
    note: p.note,
  };
}

export class SupabaseHabitSyncTransport implements SyncTransport {
  public readonly supportedEntityTypes = Object.values(habitEntityTypes);
  public constructor(
    private readonly client: GroundedSupabaseClient,
    private readonly ownerId: UserId,
  ) {}
  public async push(operations: readonly OutboxOperation[]) {
    const outcomes: PushOutcome[] = [];
    for (const op of operations) {
      if (op.ownerId !== this.ownerId) outcomes.push(retry(op.operationId));
      else if (op.entityType === habitEntityTypes.definition)
        outcomes.push(await this.pushDefinition(op));
      else if (op.entityType === habitEntityTypes.completion)
        outcomes.push(await this.pushCompletion(op));
      else if (op.entityType === habitEntityTypes.wellbeing)
        outcomes.push(await this.pushCheckin(op));
      else outcomes.push(retry(op.operationId));
    }
    return outcomes;
  }
  public async pull(cursor: string | null, limit: number) {
    let definitions = this.client
      .from('habit_definitions')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    let completions = this.client
      .from('habit_completions')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    let checkins = this.client
      .from('wellbeing_checkins')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    if (cursor) {
      definitions = definitions.gte('updated_at', cursor);
      completions = completions.gte('updated_at', cursor);
      checkins = checkins.gte('updated_at', cursor);
    }
    const [d, c, w] = await Promise.all([definitions, completions, checkins]);
    if (d.error || c.error || w.error) throw new Error('Habit sync pull failed.');
    const entities: RemoteEntity[] = [
      ...d.data.map((row) => this.remote(habitEntityTypes.definition, row, definitionPayload(row))),
      ...c.data.map((row) => this.remote(habitEntityTypes.completion, row, completionPayload(row))),
      ...w.data.map((row) => this.remote(habitEntityTypes.wellbeing, row, checkinPayload(row))),
    ].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return { entities, nextCursor: entities.at(-1)?.updatedAt ?? cursor };
  }
  private remote(type: string, row: Row, payload: JsonValue): RemoteEntity {
    return {
      ownerId: this.ownerId,
      entityType: type,
      id: row.id,
      payload: row.deleted_at ? {} : payload,
      revision: row.revision,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
  private async pushDefinition(op: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('habit_definitions')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', op.operationId)
      .maybeSingle();
    if (replay.error) return retry(op.operationId);
    if (replay.data) return ack(op.operationId, replay.data);
    if (op.kind === 'delete') {
      const r = await this.client
        .from('habit_definitions')
        .update({ deleted_at: new Date().toISOString(), last_operation_id: op.operationId })
        .eq('id', op.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', op.baseRevision)
        .select('*')
        .maybeSingle();
      return r.error
        ? retry(op.operationId)
        : r.data
          ? ack(op.operationId, r.data)
          : this.definitionConflict(op);
    }
    const values = definitionMutation(op);
    if (!values) return retry(op.operationId);
    if (op.baseRevision === 0) {
      const r = await this.client
        .from('habit_definitions')
        .insert({
          id: op.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: op.operationId,
        })
        .select('*')
        .single();
      return !r.error
        ? ack(op.operationId, r.data)
        : r.error.code === '23505'
          ? this.definitionConflict(op)
          : retry(op.operationId);
    }
    const r = await this.client
      .from('habit_definitions')
      .update({ ...values, deleted_at: null, last_operation_id: op.operationId })
      .eq('id', op.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', op.baseRevision)
      .select('*')
      .maybeSingle();
    return r.error
      ? retry(op.operationId)
      : r.data
        ? ack(op.operationId, r.data)
        : this.definitionConflict(op);
  }
  private async definitionConflict(op: OutboxOperation) {
    const r = await this.client
      .from('habit_definitions')
      .select('*')
      .eq('id', op.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return r.error
      ? retry(op.operationId)
      : conflict(op.operationId, r.data, r.data ? definitionPayload(r.data) : null);
  }
  private async pushCompletion(op: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('habit_completions')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', op.operationId)
      .maybeSingle();
    if (replay.error) return retry(op.operationId);
    if (replay.data) return ack(op.operationId, replay.data);
    if (op.kind === 'delete') {
      const r = await this.client
        .from('habit_completions')
        .update({ deleted_at: new Date().toISOString(), last_operation_id: op.operationId })
        .eq('id', op.entityId)
        .eq('user_id', this.ownerId)
        .eq('revision', op.baseRevision)
        .select('*')
        .maybeSingle();
      return r.error
        ? retry(op.operationId)
        : r.data
          ? ack(op.operationId, r.data)
          : this.completionConflict(op);
    }
    const values = completionMutation(op);
    if (!values) return retry(op.operationId);
    if (op.baseRevision === 0) {
      const r = await this.client
        .from('habit_completions')
        .insert({
          id: op.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: op.operationId,
        })
        .select('*')
        .single();
      return !r.error
        ? ack(op.operationId, r.data)
        : r.error.code === '23505'
          ? this.completionConflict(op)
          : retry(op.operationId);
    }
    return retry(op.operationId);
  }
  private async completionConflict(op: OutboxOperation) {
    const r = await this.client
      .from('habit_completions')
      .select('*')
      .eq('id', op.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return r.error
      ? retry(op.operationId)
      : conflict(op.operationId, r.data, r.data ? completionPayload(r.data) : null);
  }
  private async pushCheckin(op: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('wellbeing_checkins')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', op.operationId)
      .maybeSingle();
    if (replay.error) return retry(op.operationId);
    if (replay.data) return ack(op.operationId, replay.data);
    if (op.kind === 'delete') return retry(op.operationId);
    const values = checkinMutation(op);
    if (!values) return retry(op.operationId);
    if (op.baseRevision === 0) {
      const r = await this.client
        .from('wellbeing_checkins')
        .insert({
          id: op.entityId,
          user_id: this.ownerId,
          ...values,
          last_operation_id: op.operationId,
        })
        .select('*')
        .single();
      return !r.error
        ? ack(op.operationId, r.data)
        : r.error.code === '23505'
          ? this.checkinConflict(op)
          : retry(op.operationId);
    }
    const r = await this.client
      .from('wellbeing_checkins')
      .update({ ...values, deleted_at: null, last_operation_id: op.operationId })
      .eq('id', op.entityId)
      .eq('user_id', this.ownerId)
      .eq('revision', op.baseRevision)
      .select('*')
      .maybeSingle();
    return r.error
      ? retry(op.operationId)
      : r.data
        ? ack(op.operationId, r.data)
        : this.checkinConflict(op);
  }
  private async checkinConflict(op: OutboxOperation) {
    const r = await this.client
      .from('wellbeing_checkins')
      .select('*')
      .eq('id', op.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return r.error
      ? retry(op.operationId)
      : conflict(op.operationId, r.data, r.data ? checkinPayload(r.data) : null);
  }
}
