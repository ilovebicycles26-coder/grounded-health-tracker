export interface DailyReportInput {
  readonly date: string;
  readonly calories: number;
  readonly exerciseMinutes: number;
  readonly habitCompletions: number;
  readonly weightKilograms: number | null;
}
export interface WeeklyReport {
  readonly from: string;
  readonly through: string;
  readonly days: readonly DailyReportInput[];
  readonly totalExerciseMinutes: number;
  readonly totalHabitCompletions: number;
  readonly averageCalories: number | null;
  readonly firstWeight: number | null;
  readonly latestWeight: number | null;
}
export function buildWeeklyReport(days: readonly DailyReportInput[]): WeeklyReport {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const calorieDays = ordered.filter((day) => day.calories > 0);
  const weights = ordered.filter((day) => day.weightKilograms !== null);
  return {
    from: ordered[0]?.date ?? '',
    through: ordered.at(-1)?.date ?? '',
    days: ordered,
    totalExerciseMinutes: ordered.reduce((sum, day) => sum + day.exerciseMinutes, 0),
    totalHabitCompletions: ordered.reduce((sum, day) => sum + day.habitCompletions, 0),
    averageCalories: calorieDays.length
      ? Math.round(calorieDays.reduce((sum, day) => sum + day.calories, 0) / calorieDays.length)
      : null,
    firstWeight: weights[0]?.weightKilograms ?? null,
    latestWeight: weights.at(-1)?.weightKilograms ?? null,
  };
}
const safe = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  const escaped = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${escaped.replaceAll('"', '""')}"`;
};
export function weeklyReportCsv(report: WeeklyReport): string {
  return [
    ['Date', 'Calories (kcal)', 'Exercise (minutes)', 'Habit completions', 'Weight (kg)']
      .map(safe)
      .join(','),
    ...report.days.map((day) =>
      [day.date, day.calories, day.exerciseMinutes, day.habitCompletions, day.weightKilograms]
        .map(safe)
        .join(','),
    ),
  ].join('\r\n');
}
