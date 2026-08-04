import type { UserId } from '@grounded/domain';
import { activityTypes, exerciseEntityTypes } from '@grounded/exercise';
import type { JsonValue, OutboxOperation, RemoteEntity } from '@grounded/local-store';
import type { PushOutcome, SyncTransport } from '@grounded/sync';
import type { Database, DatabaseJson } from './database';
import type { GroundedSupabaseClient } from './index';

type RoutineRow = Database['public']['Tables']['exercise_routines']['Row'];
type SessionRow = Database['public']['Tables']['workout_sessions']['Row'];
type PreferenceRow = Database['public']['Tables']['exercise_preferences']['Row'];
type ExerciseRow = RoutineRow | SessionRow | PreferenceRow;
type JsonObject = { readonly [key: string]: JsonValue };
const object = (value: JsonValue | null): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const ack = (id: string, row: ExerciseRow): PushOutcome => ({
  kind: 'ack',
  operationId: id,
  revision: row.revision,
  updatedAt: row.updated_at,
});
const retry = (operationId: string): PushOutcome => ({ kind: 'retry', operationId });
const conflict = (
  operationId: string,
  row: ExerciseRow | null,
  payload: JsonValue | null,
): PushOutcome => ({
  kind: 'conflict',
  operationId,
  remotePayload: payload,
  remoteRevision: row?.revision ?? 0,
  remoteUpdatedAt: row?.updated_at ?? new Date(0).toISOString(),
});

function routinePayload(row: RoutineRow): JsonValue {
  return {
    familyId: row.family_id,
    name: row.name,
    description: row.description,
    estimatedMinutes: row.estimated_minutes,
    version: row.version,
    steps: row.steps as JsonValue,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function sessionPayload(row: SessionRow): JsonValue {
  return {
    routineId: row.routine_id,
    routineName: row.routine_name,
    activityType: row.activity_type,
    completedAt: row.completed_at,
    durationMinutes: row.duration_minutes,
    perceivedEffort: row.perceived_effort,
    note: row.note,
  };
}
function preferencePayload(row: PreferenceRow): JsonValue {
  return {
    activities: row.activities,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    updatedAt: row.updated_at,
  };
}
function routineMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  if (
    typeof p.familyId !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.description !== 'string' ||
    typeof p.estimatedMinutes !== 'number' ||
    typeof p.version !== 'number' ||
    !Array.isArray(p.steps)
  )
    return null;
  return {
    family_id: p.familyId,
    name: p.name,
    description: p.description,
    estimated_minutes: p.estimatedMinutes,
    version: p.version,
    steps: p.steps as DatabaseJson,
  };
}
function sessionMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  if (
    (p.routineId !== null && typeof p.routineId !== 'string') ||
    typeof p.routineName !== 'string' ||
    typeof p.activityType !== 'string' ||
    !activityTypes.includes(p.activityType as never) ||
    typeof p.completedAt !== 'string' ||
    typeof p.durationMinutes !== 'number' ||
    (p.perceivedEffort !== null && typeof p.perceivedEffort !== 'number') ||
    (p.note !== null && typeof p.note !== 'string')
  )
    return null;
  return {
    routine_id: p.routineId,
    routine_name: p.routineName,
    activity_type: p.activityType,
    completed_at: p.completedAt,
    duration_minutes: p.durationMinutes,
    perceived_effort: p.perceivedEffort,
    note: p.note,
  };
}
function preferenceMutation(operation: OutboxOperation) {
  if (!object(operation.payload)) return null;
  const p = operation.payload;
  if (
    !Array.isArray(p.activities) ||
    p.activities.some(
      (item) => typeof item !== 'string' || !activityTypes.includes(item as never),
    ) ||
    typeof p.daysPerWeek !== 'number' ||
    typeof p.sessionMinutes !== 'number'
  )
    return null;
  return {
    activities: p.activities as string[],
    days_per_week: p.daysPerWeek,
    session_minutes: p.sessionMinutes,
  };
}

export class SupabaseExerciseSyncTransport implements SyncTransport {
  public readonly supportedEntityTypes = Object.values(exerciseEntityTypes);
  public constructor(
    private readonly client: GroundedSupabaseClient,
    private readonly ownerId: UserId,
  ) {}
  public async push(operations: readonly OutboxOperation[]) {
    const outcomes: PushOutcome[] = [];
    for (const operation of operations) {
      if (operation.ownerId !== this.ownerId) outcomes.push(retry(operation.operationId));
      else if (operation.entityType === exerciseEntityTypes.routine)
        outcomes.push(await this.pushRoutine(operation));
      else if (operation.entityType === exerciseEntityTypes.session)
        outcomes.push(await this.pushSession(operation));
      else if (operation.entityType === exerciseEntityTypes.preference)
        outcomes.push(await this.pushPreference(operation));
      else outcomes.push(retry(operation.operationId));
    }
    return outcomes;
  }
  public async pull(cursor: string | null, limit: number) {
    let routines = this.client
      .from('exercise_routines')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    let sessions = this.client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    let preferences = this.client
      .from('exercise_preferences')
      .select('*')
      .eq('user_id', this.ownerId)
      .order('updated_at')
      .limit(limit);
    if (cursor) {
      routines = routines.gte('updated_at', cursor);
      sessions = sessions.gte('updated_at', cursor);
      preferences = preferences.gte('updated_at', cursor);
    }
    const [routineResult, sessionResult, preferenceResult] = await Promise.all([
      routines,
      sessions,
      preferences,
    ]);
    if (routineResult.error || sessionResult.error || preferenceResult.error)
      throw new Error('Exercise sync pull failed.');
    const entities: RemoteEntity[] = [
      ...routineResult.data.map((row) =>
        this.remote(exerciseEntityTypes.routine, row, routinePayload(row)),
      ),
      ...sessionResult.data.map((row) =>
        this.remote(exerciseEntityTypes.session, row, sessionPayload(row)),
      ),
      ...preferenceResult.data.map((row) =>
        this.remote(exerciseEntityTypes.preference, row, preferencePayload(row)),
      ),
    ].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return { entities, nextCursor: entities.at(-1)?.updatedAt ?? cursor };
  }
  private remote(type: string, row: ExerciseRow, payload: JsonValue): RemoteEntity {
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
  private async pushRoutine(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('exercise_routines')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') {
      const result = await this.client
        .from('exercise_routines')
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
          : this.routineConflict(operation);
    }
    const values = routineMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('exercise_routines')
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
          ? this.routineConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('exercise_routines')
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
        : this.routineConflict(operation);
  }
  private async routineConflict(operation: OutboxOperation) {
    const current = await this.client
      .from('exercise_routines')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? routinePayload(current.data) : null,
        );
  }
  private async pushSession(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('workout_sessions')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') return retry(operation.operationId);
    const values = sessionMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('workout_sessions')
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
          ? this.sessionConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('workout_sessions')
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
        : this.sessionConflict(operation);
  }
  private async sessionConflict(operation: OutboxOperation) {
    const current = await this.client
      .from('workout_sessions')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? sessionPayload(current.data) : null,
        );
  }
  private async pushPreference(operation: OutboxOperation): Promise<PushOutcome> {
    const replay = await this.client
      .from('exercise_preferences')
      .select('*')
      .eq('user_id', this.ownerId)
      .eq('last_operation_id', operation.operationId)
      .maybeSingle();
    if (replay.error) return retry(operation.operationId);
    if (replay.data) return ack(operation.operationId, replay.data);
    if (operation.kind === 'delete') return retry(operation.operationId);
    const values = preferenceMutation(operation);
    if (!values) return retry(operation.operationId);
    if (operation.baseRevision === 0) {
      const result = await this.client
        .from('exercise_preferences')
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
          ? this.preferenceConflict(operation)
          : retry(operation.operationId);
    }
    const result = await this.client
      .from('exercise_preferences')
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
        : this.preferenceConflict(operation);
  }
  private async preferenceConflict(operation: OutboxOperation) {
    const current = await this.client
      .from('exercise_preferences')
      .select('*')
      .eq('id', operation.entityId)
      .eq('user_id', this.ownerId)
      .maybeSingle();
    return current.error
      ? retry(operation.operationId)
      : conflict(
          operation.operationId,
          current.data,
          current.data ? preferencePayload(current.data) : null,
        );
  }
}
