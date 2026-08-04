import type { Clock, IdGenerator } from '@grounded/application';
import { failure, success, type EntityId, type Result, type UserId } from '@grounded/domain';

export const exerciseEntityTypes = {
  routine: 'exercise-routine:v1',
  session: 'exercise-session:v1',
  preference: 'exercise-preference:v1',
} as const;
export const activityTypes = [
  'cycling',
  'kettlebell',
  'bodyweight',
  'resistance_band',
  'mobility',
  'hula_hoop',
  'walking',
  'custom',
] as const;
export type ActivityType = (typeof activityTypes)[number];

export interface RoutineStep {
  readonly id: EntityId;
  readonly activityType: ActivityType;
  readonly title: string;
  readonly instructions: string;
  readonly durationMinutes: number | null;
  readonly sets: number | null;
  readonly repetitions: number | null;
}

export interface ExerciseRoutine {
  readonly id: EntityId;
  readonly familyId: EntityId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly description: string;
  readonly estimatedMinutes: number;
  readonly version: number;
  readonly steps: readonly RoutineStep[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkoutSession {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly routineId: EntityId | null;
  readonly routineName: string;
  readonly activityType: ActivityType;
  readonly completedAt: string;
  readonly durationMinutes: number;
  readonly perceivedEffort: number | null;
  readonly note: string | null;
}

export interface ExercisePreference {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly activities: readonly ActivityType[];
  readonly daysPerWeek: number;
  readonly sessionMinutes: number;
  readonly updatedAt: string;
}

export interface ExerciseRepository {
  getRoutine(ownerId: UserId, id: EntityId): Promise<Result<ExerciseRoutine | null>>;
  listRoutines(ownerId: UserId): Promise<Result<readonly ExerciseRoutine[]>>;
  saveRoutine(routine: ExerciseRoutine): Promise<Result<ExerciseRoutine>>;
  archiveRoutine(ownerId: UserId, id: EntityId): Promise<Result<void>>;
  hasCompletedSessions(ownerId: UserId, routineId: EntityId): Promise<Result<boolean>>;
  listSessions(ownerId: UserId): Promise<Result<readonly WorkoutSession[]>>;
  saveSession(session: WorkoutSession): Promise<Result<WorkoutSession>>;
  getPreference(ownerId: UserId): Promise<Result<ExercisePreference | null>>;
  savePreference(preference: ExercisePreference): Promise<Result<ExercisePreference>>;
}

export interface RoutineStepInput {
  readonly id?: EntityId;
  readonly activityType: ActivityType;
  readonly title: string;
  readonly instructions?: string;
  readonly durationMinutes?: number | null;
  readonly sets?: number | null;
  readonly repetitions?: number | null;
}

export interface SaveRoutineInput {
  readonly ownerId: UserId;
  readonly id?: EntityId;
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly RoutineStepInput[];
}

function text(
  value: string | null | undefined,
  field: string,
  maximum: number,
  required = true,
): Result<string> {
  const normalized = value?.trim() ?? '';
  return (required && !normalized) || normalized.length > maximum
    ? failure({ kind: 'validation', code: `invalid_${field}`, field })
    : success(normalized);
}

function optionalBounded(
  value: number | null | undefined,
  field: string,
  minimum: number,
  maximum: number,
): Result<number | null> {
  if (value === null || value === undefined) return success(null);
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? success(value)
    : failure({ kind: 'validation', code: `invalid_${field}`, field });
}

function validateStep(input: RoutineStepInput, ids: IdGenerator): Result<RoutineStep> {
  const title = text(input.title, 'step_title', 100);
  const instructions = text(input.instructions, 'step_instructions', 500, false);
  const duration = optionalBounded(input.durationMinutes, 'duration', 1, 480);
  const sets = optionalBounded(input.sets, 'sets', 1, 20);
  const repetitions = optionalBounded(input.repetitions, 'repetitions', 1, 500);
  if (!activityTypes.includes(input.activityType))
    return failure({ kind: 'validation', code: 'invalid_activity_type', field: 'activityType' });
  if (!title.ok) return title;
  if (!instructions.ok) return instructions;
  if (!duration.ok) return duration;
  if (!sets.ok) return sets;
  if (!repetitions.ok) return repetitions;
  if (duration.value === null && sets.value === null && repetitions.value === null)
    return failure({ kind: 'validation', code: 'step_needs_prescription', field: 'steps' });
  return success({
    id: input.id ?? (ids.create() as EntityId),
    activityType: input.activityType,
    title: title.value,
    instructions: instructions.value,
    durationMinutes: duration.value,
    sets: sets.value,
    repetitions: repetitions.value,
  });
}

export class ExerciseService {
  public constructor(
    private readonly repository: ExerciseRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async saveRoutine(input: SaveRoutineInput): Promise<Result<ExerciseRoutine>> {
    const name = text(input.name, 'routine_name', 100);
    const description = text(input.description, 'routine_description', 500, false);
    if (!name.ok) return name;
    if (!description.ok) return description;
    if (input.steps.length < 1 || input.steps.length > 30)
      return failure({ kind: 'validation', code: 'invalid_step_count', field: 'steps' });
    const steps: RoutineStep[] = [];
    for (const inputStep of input.steps) {
      const step = validateStep(inputStep, this.ids);
      if (!step.ok) return step;
      steps.push(step.value);
    }
    const existing = input.id
      ? await this.repository.getRoutine(input.ownerId, input.id)
      : success<ExerciseRoutine | null>(null);
    if (!existing.ok) return existing;
    if (input.id && !existing.value)
      return failure({ kind: 'not-found', code: 'routine_not_found' });
    const used = existing.value
      ? await this.repository.hasCompletedSessions(input.ownerId, existing.value.id)
      : success(false);
    if (!used.ok) return used;
    const now = this.clock.now().toISOString();
    const newVersion = Boolean(existing.value && used.value);
    return this.repository.saveRoutine({
      id: newVersion || !existing.value ? (this.ids.create() as EntityId) : existing.value.id,
      familyId: existing.value?.familyId ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      name: name.value,
      description: description.value,
      estimatedMinutes: steps.reduce(
        (sum, step) => sum + (step.durationMinutes ?? Math.max(5, (step.sets ?? 1) * 3)),
        0,
      ),
      version: existing.value ? existing.value.version + (newVersion ? 1 : 0) : 1,
      steps,
      createdAt: newVersion || !existing.value ? now : existing.value.createdAt,
      updatedAt: now,
    });
  }

  public listRoutines(ownerId: UserId) {
    return this.repository.listRoutines(ownerId);
  }
  public archiveRoutine(ownerId: UserId, id: EntityId) {
    return this.repository.archiveRoutine(ownerId, id);
  }
  public listSessions(ownerId: UserId) {
    return this.repository.listSessions(ownerId);
  }
  public getPreference(ownerId: UserId) {
    return this.repository.getPreference(ownerId);
  }

  public async savePreference(
    ownerId: UserId,
    activities: readonly ActivityType[],
    daysPerWeek: number,
    sessionMinutes: number,
  ) {
    const unique = [...new Set(activities)];
    if (!unique.length || unique.some((item) => !activityTypes.includes(item)))
      return failure({ kind: 'validation', code: 'invalid_activities', field: 'activities' });
    if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
      return failure({ kind: 'validation', code: 'invalid_days_per_week', field: 'daysPerWeek' });
    if (!Number.isInteger(sessionMinutes) || sessionMinutes < 10 || sessionMinutes > 240)
      return failure({
        kind: 'validation',
        code: 'invalid_session_minutes',
        field: 'sessionMinutes',
      });
    const current = await this.repository.getPreference(ownerId);
    if (!current.ok) return current;
    return this.repository.savePreference({
      id: current.value?.id ?? (this.ids.create() as EntityId),
      ownerId,
      activities: unique,
      daysPerWeek,
      sessionMinutes,
      updatedAt: this.clock.now().toISOString(),
    });
  }

  public async completeSession(input: {
    readonly ownerId: UserId;
    readonly routine?: ExerciseRoutine;
    readonly activityType: ActivityType;
    readonly durationMinutes: number;
    readonly perceivedEffort?: number | null;
    readonly note?: string | null;
  }): Promise<Result<WorkoutSession>> {
    const duration = optionalBounded(input.durationMinutes, 'duration', 1, 1_440);
    if (!duration.ok) return duration;
    if (duration.value === null) {
      return failure({ kind: 'validation', code: 'invalid_duration', field: 'duration' });
    }
    const effort = optionalBounded(input.perceivedEffort, 'perceived_effort', 1, 10);
    if (!effort.ok) return effort;
    const note = text(input.note, 'session_note', 500, false);
    if (!note.ok) return note;
    return this.repository.saveSession({
      id: this.ids.create() as EntityId,
      ownerId: input.ownerId,
      routineId: input.routine?.id ?? null,
      routineName: input.routine?.name ?? input.activityType.replace('_', ' '),
      activityType: input.activityType,
      completedAt: this.clock.now().toISOString(),
      durationMinutes: duration.value,
      perceivedEffort: effort.value,
      note: note.value || null,
    });
  }
}

const templates: Record<ActivityType, readonly RoutineStepInput[]> = {
  cycling: [
    {
      activityType: 'cycling',
      title: 'Easy endurance ride',
      instructions: 'Ride at a pace where conversation stays comfortable.',
      durationMinutes: 45,
    },
  ],
  kettlebell: [
    {
      activityType: 'kettlebell',
      title: 'Kettlebell deadlift',
      instructions: 'Keep the bell close and stop well before form changes.',
      sets: 3,
      repetitions: 8,
    },
    {
      activityType: 'kettlebell',
      title: 'Two-hand swing',
      instructions: 'Use a light, controlled bell and a crisp hip hinge.',
      sets: 5,
      repetitions: 10,
    },
  ],
  bodyweight: [
    {
      activityType: 'bodyweight',
      title: 'Sit-to-stand',
      instructions: 'Use a chair height that feels stable.',
      sets: 3,
      repetitions: 8,
    },
    {
      activityType: 'bodyweight',
      title: 'Incline press-up',
      instructions: 'Use a wall or sturdy surface.',
      sets: 3,
      repetitions: 8,
    },
  ],
  resistance_band: [
    {
      activityType: 'resistance_band',
      title: 'Band pull-apart',
      instructions: 'Move slowly and keep shoulders relaxed.',
      sets: 2,
      repetitions: 12,
    },
  ],
  mobility: [
    {
      activityType: 'mobility',
      title: 'Full-body mobility flow',
      instructions: 'Move gently through a comfortable range.',
      durationMinutes: 15,
    },
  ],
  hula_hoop: [
    {
      activityType: 'hula_hoop',
      title: 'Hula hoop flow',
      instructions: 'Use music you enjoy and take breaks whenever needed.',
      durationMinutes: 25,
    },
  ],
  walking: [
    {
      activityType: 'walking',
      title: 'Relaxed walk',
      instructions: 'Choose a pace and route that feel restorative.',
      durationMinutes: 30,
    },
  ],
  custom: [
    {
      activityType: 'custom',
      title: 'Favourite movement',
      instructions: 'Edit this step to make it yours.',
      durationMinutes: 20,
    },
  ],
};

export function curateRoutineInputs(
  activities: readonly ActivityType[],
  daysPerWeek: number,
): readonly Omit<SaveRoutineInput, 'ownerId'>[] {
  const selected: readonly ActivityType[] = activities.length ? activities : ['walking'];
  return Array.from({ length: Math.min(daysPerWeek, 5) }, (_, index) => {
    const activity = selected.at(index % selected.length) ?? 'walking';
    return {
      name: `${activity.replace('_', ' ')} day`,
      description: 'A sustainable session built around movement you chose.',
      steps: templates[activity],
    };
  });
}
