import type { EntityId } from '@grounded/domain';
import { Button, Card, TextField } from '@grounded/ui/web';
import {
  formatWeight,
  kilogramsFromPounds,
  poundsFromKilograms,
  type WeightEntry,
  type WeightGoal,
} from '@grounded/weight';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../features/auth/AuthProvider';
import { WeightChart } from '../features/weight/WeightChart';
import { WeightEntryDialog } from '../features/weight/WeightEntryDialog';
import { useWeightTracker } from '../features/weight/useWeightTracker';

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} kg`;
}

function GoalForm({
  goal,
  unitSystem,
  onSave,
}: {
  readonly goal: WeightGoal | null;
  readonly unitSystem: 'metric' | 'imperial';
  readonly onSave: (input: {
    readonly targetKilograms: number;
    readonly targetDate: string | null;
  }) => Promise<boolean>;
}) {
  const [goalInput, setGoalInput] = useState(
    goal
      ? unitSystem === 'metric'
        ? goal.targetKilograms.toString()
        : poundsFromKilograms(goal.targetKilograms).toString()
      : unitSystem === 'metric'
        ? '90'
        : poundsFromKilograms(90 as WeightGoal['targetKilograms']).toString(),
  );
  const [goalDate, setGoalDate] = useState(goal?.targetDate ?? '');
  const [goalError, setGoalError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(goalInput);
    const converted =
      unitSystem === 'metric' ? { ok: true as const, value } : kilogramsFromPounds(value);
    if (!converted.ok || !Number.isFinite(converted.value)) {
      setGoalError('Enter a valid goal weight.');
      return;
    }
    const saved = await onSave({
      targetKilograms: converted.value,
      targetDate: goalDate || null,
    });
    setGoalError(saved ? null : 'Check your goal and try again.');
  }

  return (
    <form className="goal-form" onSubmit={(event) => void submit(event)}>
      <TextField
        label={`Goal weight (${unitSystem === 'metric' ? 'kg' : 'lb'})`}
        max={unitSystem === 'metric' ? 500 : 1102}
        min={unitSystem === 'metric' ? 25 : 55}
        onChange={(event) => setGoalInput(event.target.value)}
        required
        step="0.1"
        type="number"
        value={goalInput}
      />
      <TextField
        hint="Optional. Progress is useful even without a deadline."
        label="Target date"
        onChange={(event) => setGoalDate(event.target.value)}
        type="date"
        value={goalDate}
      />
      {goalError ? (
        <p className="form-error" role="alert">
          {goalError}
        </p>
      ) : null}
      <Button type="submit">Save goal</Button>
    </form>
  );
}

export function Component() {
  const auth = useAuth();
  const unitSystem = auth.profile?.unitSystem ?? 'metric';
  const tracker = useWeightTracker();
  const [dialogEntry, setDialogEntry] = useState<WeightEntry | 'new' | null>(null);

  async function remove(id: EntityId) {
    const confirmed = window.confirm(
      'Delete this weight entry? This change will also sync to your other devices.',
    );
    if (confirmed) await tracker.removeEntry(id);
  }

  const current = tracker.summary.current;
  return (
    <section className="page weight-page" aria-labelledby="weight-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">YOUR PROGRESS</p>
          <h1 id="weight-title">Weight, without the noise.</h1>
          <p className="lede">
            Follow the long-term direction towards your goal, not daily fluctuations.
          </p>
        </div>
        <Button onClick={() => setDialogEntry('new')}>Log weight</Button>
      </header>

      {tracker.status === 'loading' ? (
        <Card aria-live="polite">Loading your private weight history…</Card>
      ) : tracker.status === 'error' ? (
        <Card>
          <h2>We could not open weight tracking</h2>
          <p>Your data has not been changed. Try again when your device is ready.</p>
          <Button onClick={() => void tracker.refresh()} variant="secondary">
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <div className="metric-grid">
            <Card className="metric-card">
              <span>Current</span>
              <strong>{current ? formatWeight(current.kilograms, unitSystem) : '—'}</strong>
              <small>{current ? `Recorded ${current.measuredOn}` : 'Log your first entry'}</small>
            </Card>
            <Card className="metric-card">
              <span>Overall change</span>
              <strong>
                {tracker.summary.changeKilograms === null
                  ? '—'
                  : signed(tracker.summary.changeKilograms)}
              </strong>
              <small>Since your first entry</small>
            </Card>
            <Card className="metric-card">
              <span>To goal</span>
              <strong>
                {tracker.summary.remainingKilograms === null
                  ? '—'
                  : `${tracker.summary.remainingKilograms.toFixed(1)} kg`}
              </strong>
              <small>
                {tracker.summary.progress === null
                  ? 'Set your personal goal'
                  : `${Math.round(tracker.summary.progress * 100)}% complete`}
              </small>
            </Card>
          </div>

          <div className="weight-layout">
            <Card className="chart-card">
              <WeightChart points={tracker.summary.trend} unitSystem={unitSystem} />
            </Card>
            <Card className="goal-card">
              <p className="eyebrow">PERSONAL GOAL</p>
              <h2>{tracker.goal ? 'Adjust your goal' : 'Start with 90 kg'}</h2>
              <p>This belongs only to your account. Zoe can choose a different goal in hers.</p>
              <GoalForm
                goal={tracker.goal}
                key={`${tracker.goal?.id ?? 'new'}-${unitSystem}`}
                onSave={async (input) => (await tracker.saveGoal(input)).ok}
                unitSystem={unitSystem}
              />
            </Card>
          </div>

          <Card className="history-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">HISTORY</p>
                <h2>Your entries</h2>
              </div>
              <Button onClick={() => setDialogEntry('new')} variant="secondary">
                Add entry
              </Button>
            </div>
            {tracker.entries.length === 0 ? (
              <p className="empty-state">
                No entries yet. A weekly weigh-in is plenty for seeing a useful trend.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Note</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...tracker.entries]
                      .sort((left, right) => right.measuredOn.localeCompare(left.measuredOn))
                      .map((entry) => (
                        <tr key={entry.id}>
                          <th scope="row">{entry.measuredOn}</th>
                          <td>{formatWeight(entry.kilograms, unitSystem)}</td>
                          <td>{entry.note ?? '—'}</td>
                          <td className="row-actions">
                            <Button onClick={() => setDialogEntry(entry)} variant="quiet">
                              Edit
                            </Button>
                            <Button onClick={() => void remove(entry.id)} variant="quiet">
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {dialogEntry ? (
        <WeightEntryDialog
          entry={dialogEntry === 'new' ? null : dialogEntry}
          onCancel={() => setDialogEntry(null)}
          onSave={async (input) => {
            const result = await tracker.saveEntry(input);
            if (result.ok) setDialogEntry(null);
            return result.ok;
          }}
          unitSystem={unitSystem}
        />
      ) : null}
    </section>
  );
}
