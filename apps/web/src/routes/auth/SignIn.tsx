import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { formValue } from '../../features/auth/formValue';
import { authService } from '../../features/auth/runtime';
export function SignIn() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeState = location.state as { accessDenied?: boolean; from?: string } | null;
  const destination = routeState?.from ?? '/today';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authService) {
      setError('Grounded authentication is not configured.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await authService.signIn(formValue(data, 'email'), formValue(data, 'password'));
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await auth.refresh();
    void navigate(destination, { replace: true });
  }
  return (
    <>
      <p className="eyebrow">WELCOME BACK</p>
      <h1 id="auth-title">Sign in to Grounded</h1>
      <p className="lede">Continue building health habits that fit real life.</p>
      {routeState?.accessDenied ? (
        <p className="form-error" role="alert">
          This personal Grounded app is limited to Richard and Zoe.
        </p>
      ) : null}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="email">Email address</label>
        <input autoComplete="email" id="email" name="email" required type="email" />
        <div className="label-row">
          <label htmlFor="password">Password</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
        <label className="check-row">
          <input
            checked={auth.staySignedIn}
            onChange={(event) => auth.setStaySignedIn(event.currentTarget.checked)}
            type="checkbox"
          />
          Stay signed in on this device
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-action" disabled={pending} type="submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">This is a private personal app. New accounts are closed.</p>
    </>
  );
}
