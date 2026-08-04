import {
  activityTypes,
  type ExerciseRoutine,
  type RoutineStepInput,
  type SaveRoutineInput,
} from '@grounded/exercise';
import { Button, SelectField, TextField } from '@grounded/ui/web';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formText } from '../../shared/formData';

interface StepDraft {
  readonly key: string;
  readonly id?: RoutineStepInput['id'];
  readonly activityType: RoutineStepInput['activityType'];
  readonly title: string;
  readonly instructions: string;
  readonly durationMinutes: string;
  readonly sets: string;
  readonly repetitions: string;
}
const blankStep = (): StepDraft => ({
  key: crypto.randomUUID(),
  activityType: 'bodyweight',
  title: '',
  instructions: '',
  durationMinutes: '15',
  sets: '',
  repetitions: '',
});

export function RoutineDialog({
  routine,
  onCancel,
  onSave,
}: {
  readonly routine: ExerciseRoutine | null;
  readonly onCancel: () => void;
  readonly onSave: (input: Omit<SaveRoutineInput, 'ownerId'>) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    routine
      ? routine.steps.map((step) => ({
          key: step.id,
          id: step.id,
          activityType: step.activityType,
          title: step.title,
          instructions: step.instructions,
          durationMinutes: step.durationMinutes?.toString() ?? '',
          sets: step.sets?.toString() ?? '',
          repetitions: step.repetitions?.toString() ?? '',
        }))
      : [blankStep()],
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const update = (key: string, change: Partial<StepDraft>) =>
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, ...change } : step)),
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = (value: string) => (value ? Number(value) : null);
    const saved = await onSave({
      ...(routine ? { id: routine.id } : {}),
      name: formText(data, 'name'),
      description: formText(data, 'description'),
      steps: steps.map((step) => ({
        ...(step.id ? { id: step.id } : {}),
        activityType: step.activityType,
        title: step.title,
        instructions: step.instructions,
        durationMinutes: number(step.durationMinutes),
        sets: number(step.sets),
        repetitions: number(step.repetitions),
      })),
    });
    if (!saved)
      setError('Check that every step has a title and either minutes, sets or repetitions.');
  }
  return (
    <dialog
      className="entry-dialog routine-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialog}
    >
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <div>
          <p className="eyebrow">EDITABLE ROUTINE</p>
          <h2>{routine ? 'Edit routine' : 'Create a routine'}</h2>
          <p>
            If a routine has workout history, editing creates a new version and preserves the
            original.
          </p>
        </div>
        <TextField
          defaultValue={routine?.name ?? ''}
          label="Routine name"
          maxLength={100}
          name="name"
          required
        />
        <TextField
          defaultValue={routine?.description ?? ''}
          label="Description"
          maxLength={500}
          name="description"
        />
        <div className="routine-step-list">
          {steps.map((step, index) => (
            <fieldset className="routine-step" key={step.key}>
              <legend>Step {index + 1}</legend>
              <SelectField
                label="Activity"
                onChange={(event) =>
                  update(step.key, {
                    activityType: event.target.value as StepDraft['activityType'],
                  })
                }
                value={step.activityType}
              >
                {activityTypes.map((activity) => (
                  <option key={activity} value={activity}>
                    {activity.replace('_', ' ')}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Step title"
                onChange={(event) => update(step.key, { title: event.target.value })}
                required
                value={step.title}
              />
              <TextField
                label="Instructions"
                onChange={(event) => update(step.key, { instructions: event.target.value })}
                value={step.instructions}
              />
              <div className="form-grid form-grid--three">
                <TextField
                  label="Minutes"
                  min="1"
                  onChange={(event) => update(step.key, { durationMinutes: event.target.value })}
                  type="number"
                  value={step.durationMinutes}
                />
                <TextField
                  label="Sets"
                  min="1"
                  onChange={(event) => update(step.key, { sets: event.target.value })}
                  type="number"
                  value={step.sets}
                />
                <TextField
                  label="Reps"
                  min="1"
                  onChange={(event) => update(step.key, { repetitions: event.target.value })}
                  type="number"
                  value={step.repetitions}
                />
              </div>
              {steps.length > 1 ? (
                <Button
                  onClick={() =>
                    setSteps((current) => current.filter((item) => item.key !== step.key))
                  }
                  variant="quiet"
                >
                  Remove step
                </Button>
              ) : null}
            </fieldset>
          ))}
        </div>
        <Button
          onClick={() => setSteps((current) => [...current, blankStep()])}
          variant="secondary"
        >
          Add another step
        </Button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="submit">Save routine</Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
