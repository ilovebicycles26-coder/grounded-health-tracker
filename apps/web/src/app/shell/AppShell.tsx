import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthProvider';
import { authService } from '../../features/auth/runtime';
import { SyncStatusIndicator } from '../../features/sync/SyncStatusIndicator';
import { InstallAppButton } from '../../features/install/InstallAppButton';

const navigation = [
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/progress/weight', label: 'Weight', icon: 'weight' },
  { to: '/nutrition', label: 'Food', icon: 'nutrition' },
  { to: '/exercise', label: 'Move', icon: 'exercise' },
  { to: '/habits', label: 'Habits', icon: 'habits' },
  { to: '/achievements', label: 'Milestones', icon: 'achievements' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/settings/profile', label: 'Settings', icon: 'settings' },
] as const;

function NavigationLinks() {
  return navigation.map((item) => (
    <NavLink key={item.to} to={item.to}>
      <span className={`nav-icon nav-icon--${item.icon}`} aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  ));
}

export function AppShell() {
  const auth = useAuth();

  async function signOut() {
    await authService?.signOut();
    await auth.refresh();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <Link className="brand" to="/today" aria-label="Grounded home">
          <span aria-hidden="true">g.</span>
          grounded
        </Link>
        <div className="account-actions">
          <SyncStatusIndicator />
          <InstallAppButton />
          <span className="account-name">
            {auth.profile?.displayName ?? auth.session?.user.email ?? 'Your account'}
          </span>
          <button className="header-button" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      </header>
      <aside className="app-sidebar">
        <nav className="app-navigation" aria-label="Primary navigation">
          <NavigationLinks />
        </nav>
        <p className="sidebar-note">
          Your health data stays private unless you choose to share it.
        </p>
      </aside>
      <main className="app-content" id="main-content">
        <Outlet />
      </main>
      <nav className="mobile-navigation" aria-label="Primary navigation">
        <NavigationLinks />
      </nav>
    </div>
  );
}
