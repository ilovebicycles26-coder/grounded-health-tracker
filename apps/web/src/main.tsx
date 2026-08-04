import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { configuration } from './app/configuration';
import { router } from './app/router';
import { AuthProvider } from './features/auth/AuthProvider';
import {
  DeviceSettingsProvider,
  initializeBrowserDeviceSettings,
} from './features/settings/deviceSettings';
import { LocalStoreLifecycle } from './platform/local/LocalStoreLifecycle';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Grounded could not find its application root.');

document.documentElement.dataset.environment = configuration.environment;
initializeBrowserDeviceSettings();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', document.baseURI));
  });
}

createRoot(root).render(
  <StrictMode>
    <DeviceSettingsProvider>
      <AuthProvider>
        <LocalStoreLifecycle>
          <RouterProvider router={router} />
        </LocalStoreLifecycle>
      </AuthProvider>
    </DeviceSettingsProvider>
  </StrictMode>,
);
