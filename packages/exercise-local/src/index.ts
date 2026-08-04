import type { Clock, IdGenerator } from '@grounded/application';
import { failure, success, type EntityId, type Result, type UserId } from '@grounded/domain';
import {
  activityTypes,
  exerciseEntityTypes,
  type ExercisePreference,
  type ExerciseRepository,
  type ExerciseRoutine,
  type RoutineStep,
  type WorkoutSession,
} from '@grounded/exercise';
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
const nullableNumber = (value: JsonValue | undefined): value is number | null =>
  value === null || typeof value === 'number';

function parseStep(value: JsonValue): RoutineStep | null {
  if (
    !object(value) ||
    typeof value.id !== 'string' ||
    typeof value.activityType !== 'string' ||
    !activityTypes.includes(value.activityType as never) ||
    typeof value.title !== 'string' ||
    typeof value.instructions !== 'string' ||
    !nullableNumber(value.durationMinutes) ||
    !nullableNumber(value.sets) ||
    !nullableNumber(value.repetitions)
  )
    return null;
  return {
    id: value.id as EntityId,
    activityType: value.activityType as RoutineStep['activityType'],
    title: value.title,
    instructions: value.instructions,
    durationMinutes: value.durationMinutes,
    sets: value.sets,
    repetitions: value.repetitions,
  };
}

function parseRoutine(entity: LocalEntity): Result<ExerciseRoutine> {
  if (!object(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_routine' });
  const p = entity.payload;
  const steps = Array.isArray(p.steps) ? p.steps.map(parseStep) : [];
  if (
    typeof p.familyId !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.description !== 'string' ||
    typeof p.estimatedMinutes !== 'number' ||
    typeof p.version !== 'number' ||
    !steps.length ||
    steps.some((step) => !step) ||
    !timestamp(p.createdAt) ||
    !timestamp(p.updatedAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_routine' });
  return success({
    id: entity.id as EntityId,
    familyId: p.familyId as EntityId,
    ownerId: entity.ownerId,
    name: p.name,
    description: p.description,
    estimatedMinutes: p.estimatedMinutes,
    version: p.version,
    steps: steps as RoutineStep[],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
}

function parseSession(entity: LocalEntity): Result<WorkoutSession> {
  if (!object(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_session' });
  const p = entity.payload;
  if (
    (p.routineId !== null && typeof p.routineId !== 'string') ||
    typeof p.routineName !== 'string' ||
    typeof p.activityType !== 'string' ||
    !activityTypes.includes(p.activityType as never) ||
    !timestamp(p.completedAt) ||
    typeof p.durationMinutes !== 'number' ||
    !nullableNumber(p.perceivedEffort) ||
    (p.note !== null && typeof p.note !== 'string')
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_session' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    routineId: p.routineId as EntityId | null,
    routineName: p.routineName,
    activityType: p.activityType as WorkoutSession['activityType'],
    completedAt: p.completedAt,
    durationMinutes: p.durationMinutes,
    perceivedEffort: p.perceivedEffort,
    note: p.note,
  });
}

function parsePreference(entity: LocalEntity): Result<ExercisePreference> {
  if (!object(entity.payload))
    return failure({ kind: 'unavailable', code: 'invalid_local_exercise_preference' });
  const p = entity.payload;
  if (
    !Array.isArray(p.activities) ||
    p.activities.some(
      (item) => typeof item !== 'string' || !activityTypes.includes(item as never),
    ) ||
    typeof p.daysPerWeek !== 'number' ||
    typeof p.sessionMinutes !== 'number' ||
    !timestamp(p.updatedAt)
  )
    return failure({ kind: 'unavailable', code: 'invalid_local_exercise_preference' });
  return success({
    id: entity.id as EntityId,
    ownerId: entity.ownerId,
    activities: p.activities as ExercisePreference['activities'],
    daysPerWeek: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    updatedAt: p.updatedAt,
  });
}

function payload<T extends { readonly id: EntityId; readonly ownerId: UserId }>(
  record: T,
): JsonValue {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'id' && key !== 'ownerId'),
  );
}

function accountMismatch(): Result<never> {
  return failure({ kind: 'unavailable', code: 'local_account_mismatch' });
}

export class LocalFirstExerciseRepository implements ExerciseRepository {
  private readonly entities: LocalEntityRepository;
  public constructor(
    private readonly database: LocalDatabase,
    clock: Clock,
    ids: IdGenerator,
  ) {
    this.entities = new LocalEntityRepository(database, clock, ids);
  }
  private owner(ownerId: UserId) {
    return ownerId === this.database.ownerId;
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
      return failure({ kind: 'unavailable', code: 'exercise_storage_unavailable' });
    }
  }
  public async getRoutine(ownerId: UserId, id: EntityId) {
    if (!this.owner(ownerId)) return accountMismatch();
    const entity = await this.database.getEntity(exerciseEntityTypes.routine, id);
    return entity && !entity.deletedAt ? parseRoutine(entity) : success(null);
  }
  public listRoutines(ownerId: UserId) {
    return this.owner(ownerId)
      ? this.list(exerciseEntityTypes.routine, parseRoutine)
      : Promise.resolve(accountMismatch());
  }
  public async saveRoutine(routine: ExerciseRoutine) {
    if (!this.owner(routine.ownerId)) return accountMismatch();
    await this.entities.save(exerciseEntityTypes.routine, routine.id, payload(routine));
    return success(routine);
  }
  public async archiveRoutine(ownerId: UserId, id: EntityId) {
    if (!this.owner(ownerId)) return accountMismatch();
    await this.entities.remove(exerciseEntityTypes.routine, id);
    return success(undefined);
  }
  public async hasCompletedSessions(ownerId: UserId, routineId: EntityId) {
    const result = await this.listSessions(ownerId);
    return result.ok
      ? success(result.value.some((session) => session.routineId === routineId))
      : result;
  }
  public listSessions(ownerId: UserId) {
    return this.owner(ownerId)
      ? this.list(exerciseEntityTypes.session, parseSession)
      : Promise.resolve(accountMismatch());
  }
  public async saveSession(session: WorkoutSession) {
    if (!this.owner(session.ownerId)) return accountMismatch();
    await this.entities.save(exerciseEntityTypes.session, session.id, payload(session));
    return success(session);
  }
  public async getPreference(ownerId: UserId) {
    if (!this.owner(ownerId)) return accountMismatch();
    const [entity] = await this.database.listEntities(exerciseEntityTypes.preference);
    return entity ? parsePreference(entity) : success(null);
  }
  public async savePreference(preference: ExercisePreference) {
    if (!this.owner(preference.ownerId)) return accountMismatch();
    await this.entities.save(exerciseEntityTypes.preference, preference.id, payload(preference));
    return success(preference);
  }
}
