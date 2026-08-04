import type { EntityId } from '@grounded/domain';
import { Button, TextField } from '@grounded/ui/web';
import { kilogramsFromPounds, poundsFromKilograms, type WeightEntry } from '@grounded/weight';
import { useEffect, useRef, useState, type FormEvent } from 'react';

interface WeightEntryDialogProps {
  readonly entry: WeightEntry | null;
  readonly unitSystem: 'metric' | 'imperial';
  readonly onCancel: () => void;
  readonly onSave: (input: {
    readonly id?: EntityId;
    readonly measuredOn: string;
    readonly kilograms: number;
    readonly note: string | null;
  }) => Promise<boolean>;
}

function localToday(): string {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.valueOf() - offset).toISOString().slice(0, 10);
}

export function WeightEntryDialog({ entry, unitSystem, onCancel, onSave }: WeightEntryDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [measuredOn, setMeasuredOn] = useState(entry?.measuredOn ?? localToday());
  const [weight, setWeight] = useState(
    entry
      ? unitSystem === 'metric'
        ? entry.kilograms.toString()
        : poundsFromKilograms(entry.kilograms).toString()
      : '',
  );
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entered = Number(weight);
    const converted =
      unitSystem === 'metric'
        ? { ok: true as const, value: entered }
        : kilogramsFromPounds(entered);
    if (!converted.ok || !Number.isFinite(converted.value)) {
      setError('Enter a valid weight.');
      return;
    }
    setPending(true);
    setError(null);
    const saved = await onSave({
      ...(entry ? { id: entry.id } : {}),
      measuredOn,
      kilograms: converted.value,
      note: note.trim() || null,
    });
    setPending(false);
    if (!saved) setError('Check the date and weight, then try again.');
  }

  return (
    <dialog
      aria-labelledby="weight-entry-title"
      className="entry-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialog}
    >
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <div>
          <p className="eyebrow">PRIVATE ENTRY</p>
          <h2 id="weight-entry-title">{entry ? 'Edit weight' : 'Log your weight'}</h2>
          <p>Saved to this device first, then securely synced when you are online.</p>
        </div>
        <TextField
          label="Date"
          max={localToday()}
          onChange={(event) => setMeasuredOn(event.target.value)}
          required
          type="date"
          value={measuredOn}
        />
        <TextField
          autoFocus
          inputMode="decimal"
          label={`Weight (${unitSystem === 'metric' ? 'kg' : 'lb'})`}
          max={unitSystem === 'metric' ? 500 : 1102}
          min={unitSystem === 'metric' ? 25 : 55}
          onChange={(event) => setWeight(event.target.value)}
          required
          step="0.1"
          type="number"
          value={weight}
        />
        <TextField
          hint="Optional, up to 240 characters."
          label="Note"
          maxLength={240}
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button pending={pending} type="submit">
            Save entry
          </Button>
          <Button disabled={pending} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
