import { activityTypes, type ActivityType, type ExerciseRoutine } from '@grounded/exercise';
import { Button, Card, Checkbox, SelectField } from '@grounded/ui/web';
import { useState, type FormEvent } from 'react';
import { RoutineDialog } from '../features/exercise/RoutineDialog';
import { SessionDialog } from '../features/exercise/SessionDialog';
import { useExerciseTracker } from '../features/exercise/useExerciseTracker';

const labels: Record<ActivityType, string> = {
  cycling: 'Cycling',
  kettlebell: 'Kettlebells',
  bodyweight: 'Bodyweight',
  resistance_band: 'Resistance bands',
  mobility: 'Mobility',
  hula_hoop: 'Hula hooping',
  walking: 'Walking',
  custom: 'Something else',
};

export function Component() {
  const tracker = useExerciseTracker();
  const [editing, setEditing] = useState<ExerciseRoutine | 'new' | null>(null);
  const [completing, setCompleting] = useState<ExerciseRoutine | null>(null);
  const [selected, setSelected] = useState<readonly ActivityType[]>(
    tracker.preference?.activities ?? [
      'cycling',
      'kettlebell',
      'bodyweight',
      'resistance_band',
      'mobility',
    ],
  );
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const toggle = (activity: ActivityType) =>
    setSelected((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity],
    );
  async function curate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await tracker.curate(
      selected,
      Number(data.get('days')),
      Number(data.get('minutes')),
    );
    setPlanMessage(
      saved
        ? 'Your editable plan is ready.'
        : 'Choose at least one activity and check the plan details.',
    );
  }
  return (
    <section className="page exercise-page" aria-labelledby="exercise-title">
      <header className="feature-heading">
        <div>
          <p className="eyebrow">MOVEMENT</p>
          <h1 id="exercise-title">Exercise you can keep doing.</h1>
          <p className="lede">
            No gym required. Build around activities you enjoy and edit every detail.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>Create routine</Button>
      </header>
      {tracker.status === 'loading' ? (
        <Card aria-live="polite">Opening your movement plan…</Card>
      ) : tracker.status === 'error' ? (
        <Card>
          <h2>Your routines are unavailable</h2>
          <p>Your saved data has not been changed.</p>
          <Button onClick={() => void tracker.refresh()} variant="secondary">
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <Card className="preference-card">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">PLAN BUILDER</p>
                <h2>What movement do you enjoy?</h2>
                <p className="empty-state">
                  Each account chooses independently, so Zoe can include hula hooping without
                  changing your plan.
                </p>
              </div>
            </div>
            <form className="preference-form" onSubmit={(event) => void curate(event)}>
              <fieldset className="activity-choices">
                <legend>Choose one or more activities</legend>
                {activityTypes.map((activity) => (
                  <Checkbox
                    checked={selected.includes(activity)}
                    key={activity}
                    label={labels[activity]}
                    onChange={() => toggle(activity)}
                  />
                ))}
              </fieldset>
              <div className="form-grid form-grid--two">
                <SelectField
                  defaultValue={tracker.preference?.daysPerWeek ?? 3}
                  label="Days per week"
                  name="days"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  defaultValue={tracker.preference?.sessionMinutes ?? 30}
                  label="Typical session"
                  name="minutes"
                >
                  {[15, 20, 30, 45, 60, 90].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </SelectField>
              </div>
              {planMessage ? (
                <p
                  className={planMessage.startsWith('Your') ? 'success-message' : 'form-error'}
                  role="status"
                >
                  {planMessage}
                </p>
              ) : null}
              <Button type="submit">Build my editable plan</Button>
            </form>
          </Card>
          <div className="section-heading-row feature-section-heading">
            <div>
              <p className="eyebrow">YOUR ROUTINES</p>
              <h2>Move your way</h2>
            </div>
            <Button onClick={() => setEditing('new')} variant="secondary">
              New routine
            </Button>
          </div>
          {tracker.routines.length === 0 ? (
            <Card>
              <h2>No routines yet</h2>
              <p>
                Choose activities above to generate a sustainable starting plan, or create one from
                scratch.
              </p>
            </Card>
          ) : (
            <div className="routine-grid">
              {[...tracker.routines]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((routine) => (
                  <Card className="routine-card" key={routine.id}>
                    <div className="routine-card__meta">
                      <span>{routine.estimatedMinutes} min</span>
                      <span>Version {routine.version}</span>
                    </div>
                    <h2>{routine.name}</h2>
                    <p>{routine.description || 'Your editable routine.'}</p>
                    <ol>
                      {routine.steps.map((step) => (
                        <li key={step.id}>
                          <strong>{step.title}</strong>
                          <span>
                            {step.durationMinutes
                              ? `${step.durationMinutes} min`
                              : `${step.sets ?? 1} × ${step.repetitions ?? 'your pace'}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="form-actions">
                      <Button onClick={() => setCompleting(routine)}>Log complete</Button>
                      <Button onClick={() => setEditing(routine)} variant="secondary">
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          )}
          <Card className="history-card">
            <p className="eyebrow">HISTORY</p>
            <h2>Recent movement</h2>
            {tracker.sessions.length === 0 ? (
              <p className="empty-state">Completed sessions will appear here.</p>
            ) : (
              <div className="session-list">
                {[...tracker.sessions]
                  .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
                  .slice(0, 10)
                  .map((session) => (
                    <div key={session.id}>
                      <div>
                        <strong>{session.routineName}</strong>
                        <small>{new Date(session.completedAt).toLocaleDateString()}</small>
                      </div>
                      <span>
                        {session.durationMinutes} min
                        {session.perceivedEffort ? ` · effort ${session.perceivedEffort}/10` : ''}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}
      {editing ? (
        <RoutineDialog
          routine={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            const result = await tracker.saveRoutine(input);
            if (result.ok) setEditing(null);
            return result.ok;
          }}
        />
      ) : null}
      {completing ? (
        <SessionDialog
          routine={completing}
          onCancel={() => setCompleting(null)}
          onSave={async (durationMinutes, perceivedEffort, note) => {
            const activityType = completing.steps[0]?.activityType ?? 'custom';
            const result = await tracker.completeSession({
              routine: completing,
              activityType,
              durationMinutes,
              perceivedEffort,
              note,
            });
            if (result.ok) setCompleting(null);
            return result.ok;
          }}
        />
      ) : null}
    </section>
  );
}
