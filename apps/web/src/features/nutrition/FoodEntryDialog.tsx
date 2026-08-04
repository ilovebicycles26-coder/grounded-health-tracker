import { Button, Checkbox, SelectField, TextField } from '@grounded/ui/web';
import { mealTypes, type FoodEntry, type SaveFoodEntryInput } from '@grounded/nutrition';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formText } from '../../shared/formData';

type Draft = Omit<SaveFoodEntryInput, 'ownerId'>;

export function FoodEntryDialog({
  date,
  entry,
  onCancel,
  onSave,
  onFavourite,
}: {
  readonly date: string;
  readonly entry: FoodEntry | null;
  readonly onCancel: () => void;
  readonly onSave: (input: Draft) => Promise<boolean>;
  readonly onFavourite: (input: Draft) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [favourite, setFavourite] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = formText(data, name).trim();
      return value ? Number(value) : null;
    };
    const input: Draft = {
      ...(entry ? { id: entry.id } : {}),
      consumedOn: formText(data, 'date'),
      mealType: formText(data, 'mealType') as Draft['mealType'],
      name: formText(data, 'name'),
      quantity: Number(data.get('quantity')),
      unit: formText(data, 'unit'),
      caloriesKcal: Number(data.get('calories')),
      proteinGrams: optionalNumber('protein'),
      carbohydrateGrams: optionalNumber('carbohydrate'),
      fatGrams: optionalNumber('fat'),
      note: formText(data, 'note'),
    };
    const saved = await onSave(input);
    if (!saved) {
      setError('Check the entry and try again.');
      return;
    }
    if (favourite && !entry) await onFavourite(input);
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
          <p className="eyebrow">FOOD DIARY</p>
          <h2>{entry ? 'Edit food' : 'Add food'}</h2>
          <p>Use the best estimate you have. It does not need to be perfect.</p>
        </div>
        <TextField
          defaultValue={entry?.name ?? ''}
          label="Food or meal"
          maxLength={120}
          name="name"
          required
        />
        <div className="form-grid form-grid--two">
          <TextField
            defaultValue={entry?.consumedOn ?? date}
            label="Date"
            name="date"
            required
            type="date"
          />
          <SelectField defaultValue={entry?.mealType ?? 'dinner'} label="Meal" name="mealType">
            {mealTypes.map((meal) => (
              <option key={meal} value={meal}>
                {meal[0]?.toUpperCase()}
                {meal.slice(1)}
              </option>
            ))}
          </SelectField>
          <TextField
            defaultValue={entry?.quantity ?? 1}
            label="Quantity"
            min="0.01"
            name="quantity"
            required
            step="0.01"
            type="number"
          />
          <TextField
            defaultValue={entry?.unit ?? 'serving'}
            label="Unit"
            maxLength={32}
            name="unit"
            required
          />
        </div>
        <div className="form-grid form-grid--four">
          <TextField
            defaultValue={entry?.caloriesKcal ?? ''}
            label="Calories (kcal)"
            min="0"
            name="calories"
            required
            step="1"
            type="number"
          />
          <TextField
            defaultValue={entry?.proteinGrams ?? ''}
            label="Protein (g)"
            min="0"
            name="protein"
            step="0.1"
            type="number"
          />
          <TextField
            defaultValue={entry?.carbohydrateGrams ?? ''}
            label="Carbs (g)"
            min="0"
            name="carbohydrate"
            step="0.1"
            type="number"
          />
          <TextField
            defaultValue={entry?.fatGrams ?? ''}
            label="Fat (g)"
            min="0"
            name="fat"
            step="0.1"
            type="number"
          />
        </div>
        <TextField
          defaultValue={entry?.note ?? ''}
          label="Note (optional)"
          maxLength={240}
          name="note"
        />
        {!entry ? (
          <Checkbox
            checked={favourite}
            hint="Makes this meal quick to add again."
            label="Save as a favourite"
            onChange={(event) => setFavourite(event.target.checked)}
          />
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="submit">Save food</Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
