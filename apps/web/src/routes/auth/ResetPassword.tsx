import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formValue } from '../../features/auth/formValue';
import { useAuth } from '../../features/auth/AuthProvider';
import { authService } from '../../features/auth/runtime';
export function ResetPassword() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = formValue(data, 'password');
    if (password.length < 10 || password !== formValue(data, 'confirmPassword')) {
      setError(
        password.length < 10
          ? 'Use at least 10 characters for your password.'
          : 'The passwords do not match.',
      );
      return;
    }
    if (!authService || !auth.session) {
      setError('This recovery link is invalid or has expired. Request a new one.');
      return;
    }
    const result = await authService.updatePassword(password);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setComplete(true);
  }
  if (complete)
    return (
      <div role="status">
        <h1 id="auth-title">You’re all set</h1>
        <p className="lede">Your password has been changed securely.</p>
        <Link className="text-action" to="/today">
          Continue to Grounded
        </Link>
      </div>
    );
  return (
    <>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1 id="auth-title">Choose a new password</h1>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="password">New password</label>
        <input
          autoComplete="new-password"
          id="password"
          minLength={10}
          name="password"
          required
          type="password"
        />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          autoComplete="new-password"
          id="confirm-password"
          name="confirmPassword"
          required
          type="password"
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-action" type="submit">
          Update password
        </button>
      </form>
    </>
  );
}
