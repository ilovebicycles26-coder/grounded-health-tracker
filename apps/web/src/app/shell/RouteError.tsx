import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `The requested page returned ${error.status}.`
    : 'Grounded could not open this page.';

  return (
    <main className="error-page">
      <p className="eyebrow">SOMETHING WENT WRONG</p>
      <h1>Let’s get you back on track.</h1>
      <p>{message}</p>
      <Link to="/today">Return to Today</Link>
    </main>
  );
}
