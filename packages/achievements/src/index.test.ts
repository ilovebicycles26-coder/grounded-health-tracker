import { evaluateAchievements } from './index';
import { expect, it } from 'vitest';
it('uses only safe count evidence and awards deterministic versions', () => {
  const results = evaluateAchievements({
    weightEntries: 5,
    foodDays: 3,
    workoutSessions: 1,
    habitCompletions: 0,
    longestHabitStreak: 0,
  });
  expect(results.filter((item) => item.earned).map((item) => item.definition.code)).toEqual([
    'first_check_in',
    'seeing_the_trend',
    'fuel_awareness',
    'moved_your_way',
  ]);
  expect(results[0]?.evidence).toEqual({ entries: 5 });
});
