import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { AuthLayout } from '../routes/auth/AuthLayout';
import { ConfirmEmail } from '../routes/auth/ConfirmEmail';
import { ForgotPassword } from '../routes/auth/ForgotPassword';
import { ResetPassword } from '../routes/auth/ResetPassword';
import { SignIn } from '../routes/auth/SignIn';
import { AppShell } from './shell/AppShell';
import { RouteError } from './shell/RouteError';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      element: <AuthLayout />,
      errorElement: <RouteError />,
      children: [
        { path: '/sign-in', element: <SignIn /> },
        { path: '/confirm-email', element: <ConfirmEmail /> },
        { path: '/forgot-password', element: <ForgotPassword /> },
        { path: '/reset-password', element: <ResetPassword /> },
      ],
    },
    {
      element: <ProtectedRoute />,
      errorElement: <RouteError />,
      children: [
        {
          path: '/',
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate replace to="/today" /> },
            { path: 'today', lazy: () => import('../routes/today') },
            { path: 'progress/weight', lazy: () => import('../routes/weight') },
            { path: 'nutrition', lazy: () => import('../routes/nutrition') },
            { path: 'exercise', lazy: () => import('../routes/exercise') },
            { path: 'habits', lazy: () => import('../routes/habits') },
            { path: 'achievements', lazy: () => import('../routes/achievements') },
            { path: 'reports', lazy: () => import('../routes/reports') },
            {
              path: 'settings',
              lazy: () => import('../routes/settings/SettingsLayout'),
              children: [
                { index: true, element: <Navigate replace to="profile" /> },
                { path: 'profile', lazy: () => import('../routes/settings/ProfileSettings') },
                {
                  path: 'preferences',
                  lazy: () => import('../routes/settings/PreferencesSettings'),
                },
                { path: 'privacy', lazy: () => import('../routes/settings/PrivacySettings') },
                { path: 'sharing', lazy: () => import('../routes/settings/SharingSettings') },
                {
                  path: 'notifications',
                  lazy: () => import('../routes/settings/NotificationSettings'),
                },
                { path: 'data', lazy: () => import('../routes/settings/DataSettings') },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename },
);
