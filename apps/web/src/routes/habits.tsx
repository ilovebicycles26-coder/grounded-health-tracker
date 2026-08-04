import type { HabitDefinition } from '@grounded/habits';
import { calculateHabitStreak } from '@grounded/habits';
import { Button, Card, SelectField, TextField } from '@grounded/ui/web';
import { useState, type FormEvent } from 'react';
import { HabitDialog } from '../features/habits/HabitDialog';
import { useHabitTracker } from '../features/habits/useHabitTracker';
import { formText } from '../shared/formData';
const today = () => new Date().toISOString().slice(0, 10);
const day = new Date().getDay();
export function Component() {
  const tracker = useHabitTracker();
  const [editing, setEditing] = useState<HabitDefinition | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const checkedToday = tracker.checkins.find((item) => item.checkedOn === today());
  async function saveCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await tracker.saveCheckin({
      checkedOn: today(),
      mood: Number(data.get('mood')),
      energy: Number(data.get('energy')),
      sleepQuality: Number(data.get('sleep')),
      note: formText(data, 'note'),
    });
    setMessage(result.ok ? 'Private check-in saved.' : 'Check the values and try again.');
  }
  return (
    <section className="page habits-page" aria-labelledby="habits-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">HABITS & WELLBEING</p>
          <h1 id="habits-title">Small actions, gently repeated.</h1>
          <p className="lede">
            Track supplements and routines without turning a missed day into failure.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>New habit</Button>
      </header>
      {tracker.status === 'loading' ? (
        <Card aria-live="polite">Opening your habits…</Card>
      ) : tracker.status === 'error' ? (
        <Card>
          <h2>Habits are unavailable</h2>
          <p>Your saved data has not been changed.</p>
          <Button onClick={() => void tracker.refresh()} variant="secondary">
            Try again
          </Button>
        </Card>
      ) : (
        <div className="habits-layout">
          <div>
            <div className="section-heading-row feature-section-heading">
              <div>
                <p className="eyebrow">TODAY</p>
                <h2>Your habits</h2>
              </div>
              <Button onClick={() => setEditing('new')} variant="secondary">
                Add habit
              </Button>
            </div>
            {tracker.habits.length === 0 ? (
              <Card>
                <h2>Start with the essentials</h2>
                <p>Add supplements and a short mobility break as editable starters.</p>
                <Button onClick={() => void tracker.addStarters()}>Add starter habits</Button>
              </Card>
            ) : (
              <div className="habit-list">
                {tracker.habits
                  .filter((habit) => habit.weekdays.includes(day))
                  .map((habit) => {
                    const completed = tracker.completions.some(
                      (item) => item.habitId === habit.id && item.completedOn === today(),
                    );
                    return (
                      <Card
                        className={completed ? 'habit-card habit-card--complete' : 'habit-card'}
                        key={habit.id}
                      >
                        <button
                          aria-pressed={completed}
                          className="habit-check"
                          onClick={() => void tracker.setCompleted(habit.id, today(), !completed)}
                          type="button"
                        >
                          <span aria-hidden="true">{completed ? '✓' : '○'}</span>
                          <span>
                            <strong>{habit.name}</strong>
                            <small>
                              {completed
                                ? 'Completed today'
                                : `${calculateHabitStreak(habit, tracker.completions, today() as never)} scheduled-day streak`}
                            </small>
                          </span>
                        </button>
                        <Button onClick={() => setEditing(habit)} variant="quiet">
                          Edit
                        </Button>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
          <Card className="wellbeing-card">
            <p className="eyebrow">PRIVATE CHECK-IN</p>
            <h2>How are you today?</h2>
            <p>Your note remains private and is never included in partner sharing.</p>
            <form className="goal-form" onSubmit={(event) => void saveCheckin(event)}>
              <SelectField defaultValue={checkedToday?.mood ?? 3} label="Mood" name="mood">
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </SelectField>
              <SelectField defaultValue={checkedToday?.energy ?? 3} label="Energy" name="energy">
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </SelectField>
              <SelectField
                defaultValue={checkedToday?.sleepQuality ?? 3}
                label="Sleep quality"
                name="sleep"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </SelectField>
              <TextField
                defaultValue={checkedToday?.note ?? ''}
                label="Private note (optional)"
                maxLength={500}
                name="note"
              />
              {message ? (
                <p
                  className={message.startsWith('Private') ? 'success-message' : 'form-error'}
                  role="status"
                >
                  {message}
                </p>
              ) : null}
              <Button type="submit">Save check-in</Button>
            </form>
          </Card>
        </div>
      )}
      {editing ? (
        <HabitDialog
          habit={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            const result = await tracker.saveHabit(input);
            if (result.ok) setEditing(null);
            return result.ok;
          }}
        />
      ) : null}
    </section>
  );
}
