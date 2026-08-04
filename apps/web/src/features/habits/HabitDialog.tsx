import { habitCategories, type HabitCategory, type HabitDefinition } from '@grounded/habits';
import { Button, Checkbox, SelectField, TextField } from '@grounded/ui/web';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formText } from '../../shared/formData';
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function HabitDialog({
  habit,
  onCancel,
  onSave,
}: {
  readonly habit: HabitDefinition | null;
  readonly onCancel: () => void;
  readonly onSave: (input: {
    readonly id?: HabitDefinition['id'];
    readonly name: string;
    readonly category: HabitCategory;
    readonly weekdays: readonly number[];
    readonly reminderTime: string | null;
  }) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [days, setDays] = useState<readonly number[]>(habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await onSave({
      ...(habit ? { id: habit.id } : {}),
      name: formText(data, 'name'),
      category: formText(data, 'category') as HabitCategory,
      weekdays: days,
      reminderTime: formText(data, 'time') || null,
    });
    if (!saved) setError('Choose a name and at least one day.');
  }
  return (
    <dialog
      className="entry-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialog}
    >
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <div>
          <p className="eyebrow">HABIT</p>
          <h2>{habit ? 'Edit habit' : 'Create a habit'}</h2>
          <p>Small enough to repeat beats perfect.</p>
        </div>
        <TextField
          defaultValue={habit?.name ?? ''}
          label="Habit name"
          maxLength={100}
          name="name"
          required
        />
        <SelectField defaultValue={habit?.category ?? 'custom'} label="Category" name="category">
          {habitCategories.map((category) => (
            <option key={category} value={category}>
              {category.replace('_', ' ')}
            </option>
          ))}
        </SelectField>
        <fieldset className="day-choices">
          <legend>Scheduled days</legend>
          {dayNames.map((name, day) => (
            <Checkbox
              checked={days.includes(day)}
              key={name}
              label={name}
              onChange={() =>
                setDays((current) =>
                  current.includes(day)
                    ? current.filter((item) => item !== day)
                    : [...current, day],
                )
              }
            />
          ))}
        </fieldset>
        <TextField
          defaultValue={habit?.reminderTime ?? ''}
          hint="Optional; notification permission is managed separately."
          label="Reminder time"
          name="time"
          type="time"
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="submit">Save habit</Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
