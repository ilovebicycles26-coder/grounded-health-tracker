import { evaluateAchievements } from '@grounded/achievements';
import { calculateHabitStreak } from '@grounded/habits';
import { Card, Checkbox } from '@grounded/ui/web';
import { useState } from 'react';
import { useExerciseTracker } from '../features/exercise/useExerciseTracker';
import { useHabitTracker } from '../features/habits/useHabitTracker';
import { useNutritionTracker } from '../features/nutrition/useNutritionTracker';
import { useWeightTracker } from '../features/weight/useWeightTracker';
export function Component() {
  const weight = useWeightTracker();
  const nutrition = useNutritionTracker(new Date().toISOString().slice(0, 10));
  const exercise = useExerciseTracker();
  const habits = useHabitTracker();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem('grounded:achievements:enabled') !== 'false',
  );
  const longest = habits.habits.reduce(
    (maximum, habit) =>
      Math.max(
        maximum,
        calculateHabitStreak(
          habit,
          habits.completions,
          new Date().toISOString().slice(0, 10) as never,
        ),
      ),
    0,
  );
  const results = evaluateAchievements({
    weightEntries: weight.entries.length,
    foodDays: new Set(nutrition.entries.map((entry) => entry.consumedOn)).size,
    workoutSessions: exercise.sessions.length,
    habitCompletions: habits.completions.length,
    longestHabitStreak: longest,
  });
  function toggle(value: boolean) {
    setEnabled(value);
    localStorage.setItem('grounded:achievements:enabled', String(value));
  }
  return (
    <section className="page" aria-labelledby="achievements-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">MILESTONES</p>
          <h1 id="achievements-title">Notice the progress.</h1>
          <p className="lede">
            Quiet acknowledgements for consistency—not pressure, competition or streak anxiety.
          </p>
        </div>
      </header>
      <Card className="achievement-setting">
        <Checkbox
          checked={enabled}
          hint="Turn this off if achievements do not feel helpful."
          label="Show achievements"
          onChange={(event) => toggle(event.target.checked)}
        />
      </Card>
      {enabled ? (
        <div className="achievement-grid">
          {results.map((result) => (
            <Card
              className={
                result.earned ? 'achievement-card achievement-card--earned' : 'achievement-card'
              }
              key={result.definition.code}
            >
              <span aria-hidden="true">{result.earned ? '✓' : '○'}</span>
              <p className="eyebrow">{result.earned ? 'EARNED' : 'IN PROGRESS'}</p>
              <h2>{result.definition.title}</h2>
              <p>{result.definition.description}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <h2>Achievements are off</h2>
          <p>Your health tracking works exactly the same without them.</p>
        </Card>
      )}
    </section>
  );
}
