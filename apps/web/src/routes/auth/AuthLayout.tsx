import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-brand" to="/" aria-label="Grounded home">
          <span aria-hidden="true">g.</span> grounded
        </Link>
        <Outlet />
        <p className="auth-privacy">Personal access is limited to Richard and Zoe.</p>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <p>
          Small steps.
          <br />
          Long-term health.
        </p>
      </aside>
    </main>
  );
}
