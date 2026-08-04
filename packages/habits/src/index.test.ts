import type { EntityId, IsoDate, UserId } from '@grounded/domain';
import { calculateHabitStreak, type HabitCompletion, type HabitDefinition } from './index';
import { describe, expect, it } from 'vitest';

describe('habit streaks', () => {
  it('counts scheduled days and does not punish unscheduled weekends', () => {
    const habit: HabitDefinition = {
      id: 'habit' as EntityId,
      ownerId: 'owner' as UserId,
      name: 'Mobility',
      category: 'movement',
      weekdays: [1, 2, 3, 4, 5],
      reminderTime: null,
      createdAt: '2026-08-01T00:00:00Z',
    };
    const completions = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'].map(
      (date, index): HabitCompletion => ({
        id: `c${index}` as EntityId,
        ownerId: habit.ownerId,
        habitId: habit.id,
        completedOn: date as IsoDate,
        createdAt: `${date}T08:00:00Z`,
      }),
    );
    expect(calculateHabitStreak(habit, completions, '2026-08-09' as IsoDate)).toBe(5);
  });
});
