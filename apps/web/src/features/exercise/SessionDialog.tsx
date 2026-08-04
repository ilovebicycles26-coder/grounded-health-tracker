import type { ExerciseRoutine } from '@grounded/exercise';
import { Button, TextField } from '@grounded/ui/web';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formText } from '../../shared/formData';

export function SessionDialog({
  routine,
  onCancel,
  onSave,
}: {
  readonly routine: ExerciseRoutine;
  readonly onCancel: () => void;
  readonly onSave: (duration: number, effort: number | null, note: string) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await onSave(
      Number(data.get('duration')),
      data.get('effort') ? Number(data.get('effort')) : null,
      formText(data, 'note'),
    );
    if (!saved) setError('Check the session details and try again.');
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
          <p className="eyebrow">SESSION COMPLETE</p>
          <h2>{routine.name}</h2>
          <p>Log what happened, not what was planned.</p>
        </div>
        <TextField
          defaultValue={routine.estimatedMinutes}
          label="Minutes"
          min="1"
          name="duration"
          required
          type="number"
        />
        <TextField
          hint="Optional, from very easy (1) to maximum effort (10)."
          label="Effort (1–10)"
          max="10"
          min="1"
          name="effort"
          type="number"
        />
        <TextField label="Note (optional)" maxLength={500} name="note" />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Button type="submit">Save session</Button>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
