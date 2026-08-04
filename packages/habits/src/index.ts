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

export const habitEntityTypes = {
  definition: 'habit-definition:v1',
  completion: 'habit-completion:v1',
  wellbeing: 'wellbeing-checkin:v1',
} as const;
export const habitCategories = [
  'supplements',
  'hydration',
  'sleep',
  'movement',
  'mindfulness',
  'custom',
] as const;
export type HabitCategory = (typeof habitCategories)[number];

export interface HabitDefinition {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly category: HabitCategory;
  readonly weekdays: readonly number[];
  readonly reminderTime: string | null;
  readonly createdAt: string;
}
export interface HabitCompletion {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly habitId: EntityId;
  readonly completedOn: IsoDate;
  readonly createdAt: string;
}
export interface WellbeingCheckin {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly checkedOn: IsoDate;
  readonly mood: number;
  readonly energy: number;
  readonly sleepQuality: number;
  readonly note: string | null;
  readonly createdAt: string;
}
export interface HabitRepository {
  getDefinition(ownerId: UserId, id: EntityId): Promise<Result<HabitDefinition | null>>;
  listDefinitions(ownerId: UserId): Promise<Result<readonly HabitDefinition[]>>;
  saveDefinition(definition: HabitDefinition): Promise<Result<HabitDefinition>>;
  archiveDefinition(ownerId: UserId, id: EntityId): Promise<Result<void>>;
  listCompletions(ownerId: UserId): Promise<Result<readonly HabitCompletion[]>>;
  saveCompletion(completion: HabitCompletion): Promise<Result<HabitCompletion>>;
  removeCompletion(ownerId: UserId, id: EntityId): Promise<Result<void>>;
  listCheckins(ownerId: UserId): Promise<Result<readonly WellbeingCheckin[]>>;
  saveCheckin(checkin: WellbeingCheckin): Promise<Result<WellbeingCheckin>>;
}

const boundedScore = (value: number, field: string): Result<number> =>
  Number.isInteger(value) && value >= 1 && value <= 5
    ? success(value)
    : failure({ kind: 'validation', code: `invalid_${field}`, field });
const validWeekdays = (values: readonly number[]): Result<readonly number[]> => {
  const unique = [...new Set(values)].sort();
  return unique.length > 0 && unique.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ? success(unique)
    : failure({ kind: 'validation', code: 'invalid_weekdays', field: 'weekdays' });
};
const validTime = (value: string | null | undefined): Result<string | null> =>
  !value
    ? success(null)
    : /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? success(value)
      : failure({ kind: 'validation', code: 'invalid_reminder_time', field: 'reminderTime' });
const note = (value: string | null | undefined): Result<string | null> => {
  const normalized = value?.trim() ?? '';
  return normalized.length <= 500
    ? success(normalized || null)
    : failure({ kind: 'validation', code: 'note_too_long', field: 'note' });
};

export class HabitService {
  public constructor(
    private readonly repository: HabitRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}
  public async saveDefinition(input: {
    readonly ownerId: UserId;
    readonly id?: EntityId;
    readonly name: string;
    readonly category: HabitCategory;
    readonly weekdays: readonly number[];
    readonly reminderTime?: string | null;
  }): Promise<Result<HabitDefinition>> {
    const name = input.name.trim();
    const weekdays = validWeekdays(input.weekdays);
    const reminderTime = validTime(input.reminderTime);
    if (!name || name.length > 100)
      return failure({ kind: 'validation', code: 'invalid_habit_name', field: 'name' });
    if (!habitCategories.includes(input.category))
      return failure({ kind: 'validation', code: 'invalid_habit_category', field: 'category' });
    if (!weekdays.ok) return weekdays;
    if (!reminderTime.ok) return reminderTime;
    const existing = input.id
      ? await this.repository.getDefinition(input.ownerId, input.id)
      : success<HabitDefinition | null>(null);
    if (!existing.ok) return existing;
    if (input.id && !existing.value) return failure({ kind: 'not-found', code: 'habit_not_found' });
    return this.repository.saveDefinition({
      id: input.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      name,
      category: input.category,
      weekdays: weekdays.value,
      reminderTime: reminderTime.value,
      createdAt: existing.value?.createdAt ?? this.clock.now().toISOString(),
    });
  }
  public listDefinitions(ownerId: UserId) {
    return this.repository.listDefinitions(ownerId);
  }
  public listCompletions(ownerId: UserId) {
    return this.repository.listCompletions(ownerId);
  }
  public listCheckins(ownerId: UserId) {
    return this.repository.listCheckins(ownerId);
  }
  public archiveDefinition(ownerId: UserId, id: EntityId) {
    return this.repository.archiveDefinition(ownerId, id);
  }
  public async setCompleted(
    ownerId: UserId,
    habitId: EntityId,
    completedOn: string,
    completed: boolean,
  ): Promise<Result<HabitCompletion | null>> {
    const date = asIsoDate(completedOn);
    if (!date.ok) return date;
    const completions = await this.repository.listCompletions(ownerId);
    if (!completions.ok) return completions;
    const existing = completions.value.find(
      (item) => item.habitId === habitId && item.completedOn === date.value,
    );
    if (!completed) {
      if (existing) {
        const removed = await this.repository.removeCompletion(ownerId, existing.id);
        if (!removed.ok) return removed;
      }
      return success(null);
    }
    if (existing) return success(existing);
    return this.repository.saveCompletion({
      id: this.ids.create() as EntityId,
      ownerId,
      habitId,
      completedOn: date.value,
      createdAt: this.clock.now().toISOString(),
    });
  }
  public async saveCheckin(input: {
    readonly ownerId: UserId;
    readonly checkedOn: string;
    readonly mood: number;
    readonly energy: number;
    readonly sleepQuality: number;
    readonly note?: string | null;
  }): Promise<Result<WellbeingCheckin>> {
    const date = asIsoDate(input.checkedOn);
    const mood = boundedScore(input.mood, 'mood');
    const energy = boundedScore(input.energy, 'energy');
    const sleep = boundedScore(input.sleepQuality, 'sleep_quality');
    const checkinNote = note(input.note);
    if (!date.ok) return date;
    if (!mood.ok) return mood;
    if (!energy.ok) return energy;
    if (!sleep.ok) return sleep;
    if (!checkinNote.ok) return checkinNote;
    const existing = await this.repository.listCheckins(input.ownerId);
    if (!existing.ok) return existing;
    const current = existing.value.find((item) => item.checkedOn === date.value);
    return this.repository.saveCheckin({
      id: current?.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      checkedOn: date.value,
      mood: mood.value,
      energy: energy.value,
      sleepQuality: sleep.value,
      note: checkinNote.value,
      createdAt: current?.createdAt ?? this.clock.now().toISOString(),
    });
  }
}

function previousDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
export function calculateHabitStreak(
  habit: HabitDefinition,
  completions: readonly HabitCompletion[],
  throughDate: IsoDate,
): number {
  const completed = new Set(
    completions.filter((item) => item.habitId === habit.id).map((item) => item.completedOn),
  );
  let cursor: string = throughDate;
  let streak = 0;
  let inspected = 0;
  while (inspected < 3660) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    if (habit.weekdays.includes(day)) {
      if (!completed.has(cursor as IsoDate)) break;
      streak += 1;
    }
    cursor = previousDate(cursor);
    inspected += 1;
  }
  return streak;
}

export const starterHabits = [
  { name: 'Take supplements', category: 'supplements' as const, weekdays: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Mobility break', category: 'movement' as const, weekdays: [1, 2, 3, 4, 5] },
];
