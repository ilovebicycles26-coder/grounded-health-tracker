import type { Clock, IdGenerator } from '@grounded/application';
import {
  asIsoDate,
  failure,
  success,
  type Brand,
  type DomainError,
  type EntityId,
  type IsoDate,
  type Result,
  type UserId,
} from '@grounded/domain';

export const weightEntityTypes = {
  entry: 'weight-entry:v1',
  goal: 'weight-goal:v1',
} as const;

export type WeightKilograms = Brand<number, 'WeightKilograms'>;

export interface WeightEntry {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly measuredOn: IsoDate;
  readonly kilograms: WeightKilograms;
  readonly note: string | null;
  readonly recordedAt: string;
}

export interface WeightGoal {
  readonly id: EntityId;
  readonly ownerId: UserId;
  readonly targetKilograms: WeightKilograms;
  readonly targetDate: IsoDate | null;
  readonly createdAt: string;
}

export interface WeightRepository {
  getEntry(ownerId: UserId, id: EntityId): Promise<Result<WeightEntry | null>>;
  listEntries(ownerId: UserId): Promise<Result<readonly WeightEntry[]>>;
  saveEntry(entry: WeightEntry): Promise<Result<WeightEntry>>;
  removeEntry(ownerId: UserId, id: EntityId): Promise<Result<void>>;
  getGoal(ownerId: UserId): Promise<Result<WeightGoal | null>>;
  saveGoal(goal: WeightGoal): Promise<Result<WeightGoal>>;
}

const MINIMUM_WEIGHT_KG = 25;
const MAXIMUM_WEIGHT_KG = 500;
const POUNDS_PER_KILOGRAM = 2.2046226218;

export function asWeightKilograms(value: number): Result<WeightKilograms> {
  if (!Number.isFinite(value) || value < MINIMUM_WEIGHT_KG || value > MAXIMUM_WEIGHT_KG) {
    return failure({ kind: 'validation', code: 'weight_out_of_range', field: 'weight' });
  }
  return success((Math.round(value * 1_000) / 1_000) as WeightKilograms);
}

export function kilogramsFromPounds(value: number): Result<WeightKilograms> {
  return asWeightKilograms(value / POUNDS_PER_KILOGRAM);
}

export function poundsFromKilograms(value: WeightKilograms): number {
  return Math.round(value * POUNDS_PER_KILOGRAM * 10) / 10;
}

export function formatWeight(value: WeightKilograms, unitSystem: 'metric' | 'imperial'): string {
  return unitSystem === 'metric'
    ? `${value.toFixed(1)} kg`
    : `${poundsFromKilograms(value).toFixed(1)} lb`;
}

function validateNote(value: string | null | undefined): Result<string | null> {
  const note = value?.trim() ?? '';
  if (note.length > 240) {
    return failure({ kind: 'validation', code: 'note_too_long', field: 'note' });
  }
  return success(note.length > 0 ? note : null);
}

export interface SaveWeightEntryInput {
  readonly ownerId: UserId;
  readonly id?: EntityId;
  readonly measuredOn: string;
  readonly kilograms: number;
  readonly note?: string | null;
}

export interface SaveWeightGoalInput {
  readonly ownerId: UserId;
  readonly targetKilograms: number;
  readonly targetDate?: string | null;
}

export class WeightService {
  public constructor(
    private readonly repository: WeightRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async saveEntry(input: SaveWeightEntryInput): Promise<Result<WeightEntry>> {
    const measuredOn = asIsoDate(input.measuredOn);
    if (!measuredOn.ok) return measuredOn;
    const kilograms = asWeightKilograms(input.kilograms);
    if (!kilograms.ok) return kilograms;
    const note = validateNote(input.note);
    if (!note.ok) return note;

    const existing = input.id
      ? await this.repository.getEntry(input.ownerId, input.id)
      : success<WeightEntry | null>(null);
    if (!existing.ok) return existing;
    if (input.id && !existing.value) {
      return failure({ kind: 'not-found', code: 'weight_entry_not_found' });
    }

    return this.repository.saveEntry({
      id: input.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      measuredOn: measuredOn.value,
      kilograms: kilograms.value,
      note: note.value,
      recordedAt: existing.value?.recordedAt ?? this.clock.now().toISOString(),
    });
  }

  public removeEntry(ownerId: UserId, id: EntityId): Promise<Result<void>> {
    return this.repository.removeEntry(ownerId, id);
  }

  public listEntries(ownerId: UserId): Promise<Result<readonly WeightEntry[]>> {
    return this.repository.listEntries(ownerId);
  }

  public async saveGoal(input: SaveWeightGoalInput): Promise<Result<WeightGoal>> {
    const target = asWeightKilograms(input.targetKilograms);
    if (!target.ok) return target;
    let targetDate: IsoDate | null = null;
    if (input.targetDate) {
      const parsed = asIsoDate(input.targetDate);
      if (!parsed.ok) return parsed;
      targetDate = parsed.value;
    }
    const existing = await this.repository.getGoal(input.ownerId);
    if (!existing.ok) return existing;
    return this.repository.saveGoal({
      id: existing.value?.id ?? (this.ids.create() as EntityId),
      ownerId: input.ownerId,
      targetKilograms: target.value,
      targetDate,
      createdAt: existing.value?.createdAt ?? this.clock.now().toISOString(),
    });
  }

  public getGoal(ownerId: UserId): Promise<Result<WeightGoal | null>> {
    return this.repository.getGoal(ownerId);
  }
}

export interface WeightTrendPoint {
  readonly date: IsoDate;
  readonly kilograms: WeightKilograms;
  readonly rollingAverageKilograms: WeightKilograms;
}

export interface WeightSummary {
  readonly first: WeightEntry | null;
  readonly current: WeightEntry | null;
  readonly goal: WeightGoal | null;
  readonly changeKilograms: number | null;
  readonly remainingKilograms: number | null;
  readonly progress: number | null;
  readonly trend: readonly WeightTrendPoint[];
}

function compareEntries(left: WeightEntry, right: WeightEntry): number {
  const byDate = left.measuredOn.localeCompare(right.measuredOn);
  return byDate === 0 ? left.recordedAt.localeCompare(right.recordedAt) : byDate;
}

export function calculateWeightSummary(
  entries: readonly WeightEntry[],
  goal: WeightGoal | null,
  rollingWindow = 7,
): WeightSummary {
  const ordered = [...entries].sort(compareEntries);
  const trend = ordered.map((entry, index) => {
    const values = ordered.slice(Math.max(0, index - rollingWindow + 1), index + 1);
    const average = values.reduce((total, item) => total + item.kilograms, 0) / values.length;
    return {
      date: entry.measuredOn,
      kilograms: entry.kilograms,
      rollingAverageKilograms: (Math.round(average * 1_000) / 1_000) as WeightKilograms,
    };
  });
  const first = ordered[0] ?? null;
  const current = ordered.at(-1) ?? null;
  if (!first || !current) {
    return {
      first,
      current,
      goal,
      changeKilograms: null,
      remainingKilograms: null,
      progress: null,
      trend,
    };
  }
  const changeKilograms = Math.round((current.kilograms - first.kilograms) * 10) / 10;
  if (!goal) {
    return {
      first,
      current,
      goal,
      changeKilograms,
      remainingKilograms: null,
      progress: null,
      trend,
    };
  }
  const journey = first.kilograms - goal.targetKilograms;
  const achieved = first.kilograms - current.kilograms;
  return {
    first,
    current,
    goal,
    changeKilograms,
    remainingKilograms: Math.max(
      0,
      Math.round((current.kilograms - goal.targetKilograms) * 10) / 10,
    ),
    progress:
      journey <= 0
        ? current.kilograms <= goal.targetKilograms
          ? 1
          : 0
        : Math.min(1, Math.max(0, achieved / journey)),
    trend,
  };
}

export function unavailable(code = 'weight_storage_unavailable'): Result<never, DomainError> {
  return failure({ kind: 'unavailable', code });
}

export { planPrototypeWeightImport } from './prototypeImport';
export type { PrototypeWeightImportIssue, PrototypeWeightImportPlan } from './prototypeImport';
