import { NavLink, Outlet } from 'react-router-dom';

const sections = [
  { to: 'profile', label: 'Profile & region' },
  { to: 'preferences', label: 'Appearance' },
  { to: 'privacy', label: 'Privacy' },
  { to: 'sharing', label: 'Sharing' },
  { to: 'notifications', label: 'Reminders' },
  { to: 'data', label: 'Your data' },
] as const;

export function Component() {
  return (
    <section className="page settings-page" aria-labelledby="settings-title">
      <div className="page-heading">
        <p className="eyebrow">YOUR PREFERENCES</p>
        <h1 id="settings-title">Settings</h1>
        <p className="lede">Make Grounded feel right on this device and across your account.</p>
      </div>
      <div className="settings-shell">
        <nav className="settings-navigation" aria-label="Settings sections">
          {sections.map((section) => (
            <NavLink key={section.to} to={section.to}>
              {section.label}
            </NavLink>
          ))}
        </nav>
        <div className="settings-content">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
