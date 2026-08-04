import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading')
    return (
      <p className="route-status" role="status">
        Checking your account…
      </p>
    );
  if (auth.status === 'configuration_error')
    return (
      <p className="route-status" role="alert">
        Grounded authentication is not configured.
      </p>
    );
  if (auth.status === 'error')
    return (
      <p className="route-status" role="alert">
        {auth.error?.message ?? 'Your account could not be loaded.'}
      </p>
    );
  if (auth.status === 'unauthorized')
    return (
      <Navigate replace state={{ accessDenied: true, from: location.pathname }} to="/sign-in" />
    );
  if (auth.status === 'anonymous')
    return <Navigate replace state={{ from: location.pathname }} to="/sign-in" />;
  return <Outlet />;
}
