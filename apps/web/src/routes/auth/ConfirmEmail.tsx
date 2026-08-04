import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
export function ConfirmEmail() {
  const ready = useAuth().status === 'authenticated';
  return (
    <div role="status">
      <p className="eyebrow">EMAIL CONFIRMATION</p>
      <h1 id="auth-title">{ready ? 'Email confirmed' : 'Finishing your account…'}</h1>
      <p className="lede">
        {ready
          ? 'Your private Grounded account is ready.'
          : 'If this takes more than a few seconds, the link may have expired.'}
      </p>
      <Link className="text-action" to={ready ? '/today' : '/sign-in'}>
        {ready ? 'Continue to Grounded' : 'Return to sign in'}
      </Link>
    </div>
  );
}
