import { buildWeeklyReport, weeklyReportCsv } from '@grounded/reports';
import { Button, Card } from '@grounded/ui/web';
import { useMemo } from 'react';
import { useExerciseTracker } from '../features/exercise/useExerciseTracker';
import { useHabitTracker } from '../features/habits/useHabitTracker';
import { useNutritionTracker } from '../features/nutrition/useNutritionTracker';
import { useWeightTracker } from '../features/weight/useWeightTracker';
function dates() {
  const result: string[] = [];
  const now = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}
export function Component() {
  const range = useMemo(() => dates(), []);
  const nutrition = useNutritionTracker(range.at(-1) ?? '');
  const exercise = useExerciseTracker();
  const habits = useHabitTracker();
  const weight = useWeightTracker();
  const report = buildWeeklyReport(
    range.map((date) => ({
      date,
      calories: nutrition.entries
        .filter((item) => item.consumedOn === date)
        .reduce((sum, item) => sum + item.caloriesKcal, 0),
      exerciseMinutes: exercise.sessions
        .filter((item) => item.completedAt.slice(0, 10) === date)
        .reduce((sum, item) => sum + item.durationMinutes, 0),
      habitCompletions: habits.completions.filter((item) => item.completedOn === date).length,
      weightKilograms:
        weight.entries
          .filter((item) => item.measuredOn === date)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]?.kilograms ?? null,
    })),
  );
  function csv() {
    const blob = new Blob([weeklyReportCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grounded-week-${report.through}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const maximum = Math.max(1, ...report.days.map((day) => day.exerciseMinutes));
  return (
    <section className="page report-page" aria-labelledby="reports-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">REPORTS</p>
          <h1 id="reports-title">Your week, in context.</h1>
          <p className="lede">A factual summary without scores or medical conclusions.</p>
        </div>
        <div className="report-actions">
          <Button onClick={csv} variant="secondary">
            Download CSV
          </Button>
          <Button onClick={() => window.print()}>Print or save PDF</Button>
        </div>
      </header>
      <div className="metric-grid">
        <Card className="metric-card">
          <span>Movement</span>
          <strong>{report.totalExerciseMinutes} min</strong>
          <small>Across completed sessions</small>
        </Card>
        <Card className="metric-card">
          <span>Habit actions</span>
          <strong>{report.totalHabitCompletions}</strong>
          <small>Scheduled actions completed</small>
        </Card>
        <Card className="metric-card">
          <span>Logged-day average</span>
          <strong>{report.averageCalories ?? '—'}</strong>
          <small>Calories, only on logged days</small>
        </Card>
      </div>
      <Card className="report-chart">
        <p className="eyebrow">MOVEMENT</p>
        <h2>Daily minutes</h2>
        <div aria-hidden="true" className="bar-chart">
          {report.days.map((day) => (
            <div key={day.date}>
              <span style={{ height: `${Math.max(3, (day.exerciseMinutes / maximum) * 100)}%` }} />
              <small>
                {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                })}
              </small>
            </div>
          ))}
        </div>
        <div className="table-scroll">
          <table className="history-table">
            <caption className="visually-hidden">Accessible weekly health summary</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Calories</th>
                <th>Movement</th>
                <th>Habits</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.date}</th>
                  <td>{day.calories || '—'}</td>
                  <td>{day.exerciseMinutes} min</td>
                  <td>{day.habitCompletions}</td>
                  <td>
                    {day.weightKilograms === null ? '—' : `${day.weightKilograms.toFixed(1)} kg`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
