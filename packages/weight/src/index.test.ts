import type { Clock, IdGenerator } from '@grounded/application';
import type { EntityId, Result, UserId } from '@grounded/domain';
import { describe, expect, it } from 'vitest';

import {
  asWeightKilograms,
  calculateWeightSummary,
  formatWeight,
  kilogramsFromPounds,
  type WeightEntry,
  type WeightGoal,
  type WeightRepository,
  WeightService,
} from './index';

const ownerId = '00000000-0000-0000-0000-000000000001' as UserId;
const clock: Clock = { now: () => new Date('2026-08-04T08:00:00.000Z') };
const ids: IdGenerator = { create: () => '10000000-0000-0000-0000-000000000001' };

class MemoryWeightRepository implements WeightRepository {
  public readonly entries = new Map<EntityId, WeightEntry>();
  public goal: WeightGoal | null = null;
  public getEntry(_ownerId: UserId, id: EntityId): Promise<Result<WeightEntry | null>> {
    return Promise.resolve({ ok: true, value: this.entries.get(id) ?? null });
  }
  public listEntries(): Promise<Result<readonly WeightEntry[]>> {
    return Promise.resolve({ ok: true, value: [...this.entries.values()] });
  }
  public saveEntry(entry: WeightEntry): Promise<Result<WeightEntry>> {
    this.entries.set(entry.id, entry);
    return Promise.resolve({ ok: true, value: entry });
  }
  public removeEntry(_ownerId: UserId, id: EntityId): Promise<Result<void>> {
    this.entries.delete(id);
    return Promise.resolve({ ok: true, value: undefined });
  }
  public getGoal(): Promise<Result<WeightGoal | null>> {
    return Promise.resolve({ ok: true, value: this.goal });
  }
  public saveGoal(goal: WeightGoal): Promise<Result<WeightGoal>> {
    this.goal = goal;
    return Promise.resolve({ ok: true, value: goal });
  }
}

describe('weight domain', () => {
  it('keeps kilograms canonical while presenting imperial values', () => {
    const converted = kilogramsFromPounds(220.46226218);
    expect(converted).toEqual({ ok: true, value: 100 });
    if (converted.ok) expect(formatWeight(converted.value, 'imperial')).toBe('220.5 lb');
  });

  it('rejects implausible values and invalid calendar dates', async () => {
    expect(asWeightKilograms(12)).toMatchObject({ ok: false });
    const service = new WeightService(new MemoryWeightRepository(), clock, ids);
    await expect(
      service.saveEntry({ ownerId, measuredOn: '2026-02-30', kilograms: 100 }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_iso_date' } });
  });

  it('creates the personal 90 kg goal and calculates progress with a rolling trend', async () => {
    const repository = new MemoryWeightRepository();
    const service = new WeightService(repository, clock, ids);
    const goal = await service.saveGoal({ ownerId, targetKilograms: 90 });
    expect(goal).toMatchObject({ ok: true, value: { targetKilograms: 90 } });

    const first = await service.saveEntry({ ownerId, measuredOn: '2026-08-01', kilograms: 110 });
    const second = await service.saveEntry({ ownerId, measuredOn: '2026-08-04', kilograms: 105 });
    if (!first.ok || !second.ok || !goal.ok) throw new Error('Fixture setup failed');
    const summary = calculateWeightSummary([second.value, first.value], goal.value);
    expect(summary.changeKilograms).toBe(-5);
    expect(summary.remainingKilograms).toBe(15);
    expect(summary.progress).toBe(0.25);
    expect(summary.trend.at(-1)?.rollingAverageKilograms).toBe(107.5);
  });
});
