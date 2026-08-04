import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formValue } from '../../features/auth/formValue';

import { authService } from '../../features/auth/runtime';
import { appUrl } from '../../shared/appUrl';

export function ForgotPassword() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authService) {
      setError('Grounded authentication is not configured.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await authService.requestPasswordReset({
      email: formValue(data, 'email'),
      redirectTo: appUrl('/reset-password'),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(true);
  }

  return (
    <>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1 id="auth-title">Reset your password</h1>
      <p className="lede">
        Enter your email and we’ll send a secure recovery link if an account exists.
      </p>
      {sent ? (
        <p className="success-message" role="status">
          Check your inbox for the recovery email.
        </p>
      ) : (
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="email">Email address</label>
          <input autoComplete="email" id="email" name="email" required type="email" />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-action" disabled={pending} type="submit">
            {pending ? 'Sending…' : 'Send recovery link'}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/sign-in">Back to sign in</Link>
      </p>
    </>
  );
}
