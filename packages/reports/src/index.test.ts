import { buildWeeklyReport, weeklyReportCsv } from './index';
import { expect, it } from 'vitest';
it('builds safe aggregates and protects CSV formula cells', () => {
  const report = buildWeeklyReport([
    {
      date: '2026-08-03',
      calories: 2000,
      exerciseMinutes: 30,
      habitCompletions: 2,
      weightKilograms: 100,
    },
    {
      date: '2026-08-04',
      calories: 0,
      exerciseMinutes: 20,
      habitCompletions: 1,
      weightKilograms: 99.5,
    },
  ]);
  expect(report.totalExerciseMinutes).toBe(50);
  expect(report.averageCalories).toBe(2000);
  expect(weeklyReportCsv(report)).toContain('"99.5"');
});
