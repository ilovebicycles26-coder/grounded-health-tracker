import type { EntityId, UserId } from '@grounded/domain';
import { describe, expect, it } from 'vitest';

import {
  calculateDailyNutrition,
  NutritionService,
  type FoodEntry,
  type FoodFavourite,
  type NutritionRepository,
  type NutritionTarget,
} from './index';

class MemoryNutritionRepository implements NutritionRepository {
  entries: FoodEntry[] = [];
  targets: NutritionTarget[] = [];
  favourites: FoodFavourite[] = [];
  getEntry(_owner: UserId, id: EntityId) {
    return Promise.resolve({
      ok: true as const,
      value: this.entries.find((entry) => entry.id === id) ?? null,
    });
  }
  listEntries() {
    return Promise.resolve({ ok: true as const, value: this.entries });
  }
  saveEntry(entry: FoodEntry) {
    this.entries = [...this.entries.filter((item) => item.id !== entry.id), entry];
    return Promise.resolve({ ok: true as const, value: entry });
  }
  removeEntry(_owner: UserId, id: EntityId) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    return Promise.resolve({ ok: true as const, value: undefined });
  }
  listTargets() {
    return Promise.resolve({ ok: true as const, value: this.targets });
  }
  saveTarget(target: NutritionTarget) {
    this.targets = [...this.targets.filter((item) => item.id !== target.id), target];
    return Promise.resolve({ ok: true as const, value: target });
  }
  listFavourites() {
    return Promise.resolve({ ok: true as const, value: this.favourites });
  }
  saveFavourite(favourite: FoodFavourite) {
    this.favourites.push(favourite);
    return Promise.resolve({ ok: true as const, value: favourite });
  }
  removeFavourite(_owner: UserId, id: EntityId) {
    this.favourites = this.favourites.filter((item) => item.id !== id);
    return Promise.resolve({ ok: true as const, value: undefined });
  }
}

describe('NutritionService', () => {
  it('validates, saves and totals a day without inventing missing macros', async () => {
    const repository = new MemoryNutritionRepository();
    let id = 0;
    const service = new NutritionService(
      repository,
      { now: () => new Date('2026-08-04T08:00:00Z') },
      { create: () => `id-${++id}` },
    );
    const ownerId = 'owner' as UserId;
    await service.saveEntry({
      ownerId,
      consumedOn: '2026-08-04',
      mealType: 'breakfast',
      name: 'Porridge',
      quantity: 1,
      unit: 'bowl',
      caloriesKcal: 350,
      proteinGrams: 12,
    });
    await service.saveEntry({
      ownerId,
      consumedOn: '2026-08-04',
      mealType: 'snack',
      name: 'Apple',
      quantity: 1,
      unit: 'item',
      caloriesKcal: 80,
    });
    const target = await service.saveTarget({
      ownerId,
      effectiveFrom: '2026-08-01',
      caloriesKcal: 2200,
      proteinGrams: 120,
    });
    expect(target.ok).toBe(true);
    const summary = calculateDailyNutrition(
      repository.entries,
      repository.targets,
      '2026-08-04' as never,
    );
    expect(summary.caloriesKcal).toBe(430);
    expect(summary.proteinGrams).toBe(12);
    expect(summary.remainingCalories).toBe(1770);
  });

  it('rejects a calorie target below the supported self-service range', async () => {
    const service = new NutritionService(
      new MemoryNutritionRepository(),
      { now: () => new Date() },
      { create: () => 'id' },
    );
    const result = await service.saveTarget({
      ownerId: 'owner' as UserId,
      effectiveFrom: '2026-08-04',
      caloriesKcal: 900,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        code: 'calorie_target_below_supported_range',
        field: 'calories',
      },
    });
  });
});
