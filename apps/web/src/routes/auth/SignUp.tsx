import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formValue } from '../../features/auth/formValue';
import { authService } from '../../features/auth/runtime';
import { appUrl } from '../../shared/appUrl';
export function SignUp() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = formValue(data, 'password');
    if (password.length < 10) {
      setError('Use at least 10 characters for your password.');
      return;
    }
    if (password !== formValue(data, 'confirmPassword')) {
      setError('The passwords do not match.');
      return;
    }
    if (!authService) {
      setError('Grounded authentication is not configured.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await authService.signUp({
      email: formValue(data, 'email'),
      password,
      emailRedirectTo: appUrl('/confirm-email'),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(result.value.requiresConfirmation);
  }
  if (sent)
    return (
      <div role="status">
        <p className="eyebrow">CHECK YOUR INBOX</p>
        <h1 id="auth-title">Confirm your email</h1>
        <p className="lede">
          We sent a secure confirmation link. Open it on this device to finish creating your
          account.
        </p>
        <Link className="text-action" to="/sign-in">
          Return to sign in
        </Link>
      </div>
    );
  return (
    <>
      <p className="eyebrow">YOUR PRIVATE HEALTH SPACE</p>
      <h1 id="auth-title">Create your account</h1>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="email">Email address</label>
        <input autoComplete="email" id="email" name="email" required type="email" />
        <label htmlFor="password">Password</label>
        <input
          aria-describedby="password-help"
          autoComplete="new-password"
          id="password"
          minLength={10}
          name="password"
          required
          type="password"
        />
        <p className="field-help" id="password-help">
          At least 10 characters. A password manager is recommended.
        </p>
        <label htmlFor="confirm-password">Confirm password</label>
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
        <button className="primary-action" disabled={pending} type="submit">
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
