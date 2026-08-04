import type { AuthError } from '@grounded/auth';

export type SaveState =
  { readonly status: 'idle' | 'saved' } | { readonly status: 'error'; readonly error: AuthError };

export function SaveMessage({ state }: { readonly state: SaveState }) {
  return (
    <div className="save-message" aria-live="polite">
      {state.status === 'saved' ? <p className="success-message">Changes saved.</p> : null}
      {state.status === 'error' ? <p className="form-error">{state.error.message}</p> : null}
    </div>
  );
}
