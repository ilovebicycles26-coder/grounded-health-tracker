import {
  defaultDeviceSettings,
  parseDeviceSettings,
  type DeviceSettings,
  type ThemePreference,
} from '@grounded/settings';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

export const DEVICE_SETTINGS_STORAGE_KEY = 'grounded.device-settings.v1';

export interface DeviceSettingsStorage {
  read(): DeviceSettings;
  write(settings: DeviceSettings): void;
}

export class BrowserDeviceSettingsStorage implements DeviceSettingsStorage {
  public constructor(private readonly storage: Storage) {}

  public read(): DeviceSettings {
    try {
      const value = this.storage.getItem(DEVICE_SETTINGS_STORAGE_KEY);
      return parseDeviceSettings(value ? JSON.parse(value) : null);
    } catch {
      return defaultDeviceSettings;
    }
  }

  public write(settings: DeviceSettings): void {
    try {
      this.storage.setItem(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Preferences remain active for this session when browser storage is unavailable.
    }
  }
}

interface DeviceSettingsState {
  readonly settings: DeviceSettings;
  setSettings(settings: DeviceSettings): void;
}

function createDeviceSettingsStore(storage: DeviceSettingsStorage): StoreApi<DeviceSettingsState> {
  return createStore<DeviceSettingsState>()((set) => ({
    settings: storage.read(),
    setSettings(settings) {
      storage.write(settings);
      set({ settings });
    },
  }));
}

function systemPrefersDark(matchMedia: typeof window.matchMedia | undefined): boolean {
  return matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function resolveTheme(
  theme: ThemePreference,
  prefersDark: boolean,
): Exclude<ThemePreference, 'system'> {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
}

export function applyDeviceSettings(
  settings: DeviceSettings,
  root: HTMLElement,
  matchMedia: typeof window.matchMedia | undefined,
): void {
  const theme = resolveTheme(settings.theme, systemPrefersDark(matchMedia));
  root.dataset.theme = theme;
  root.dataset.themePreference = settings.theme;
  root.dataset.motion = settings.motion;
  root.dataset.reducedData = String(settings.reducedData);
  root.style.colorScheme = theme === 'dark' || theme === 'high-contrast' ? 'dark' : 'light';
}

const DeviceSettingsContext = createContext<StoreApi<DeviceSettingsState> | null>(null);

export function initializeBrowserDeviceSettings(): DeviceSettings {
  const settings = new BrowserDeviceSettingsStorage(window.localStorage).read();
  applyDeviceSettings(settings, document.documentElement, window.matchMedia.bind(window));
  return settings;
}

export function DeviceSettingsProvider({ children }: { readonly children: ReactNode }) {
  const [store] = useState(() =>
    createDeviceSettingsStore(new BrowserDeviceSettingsStorage(window.localStorage)),
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      applyDeviceSettings(
        store.getState().settings,
        document.documentElement,
        window.matchMedia.bind(window),
      );
    };
    apply();
    const unsubscribe = store.subscribe(apply);
    media.addEventListener('change', apply);
    return () => {
      unsubscribe();
      media.removeEventListener('change', apply);
    };
  }, [store]);

  return <DeviceSettingsContext.Provider value={store}>{children}</DeviceSettingsContext.Provider>;
}

export function useDeviceSettings(): DeviceSettingsState {
  const store = useContext(DeviceSettingsContext);
  if (!store) throw new Error('useDeviceSettings must be used within DeviceSettingsProvider.');
  return useStore(store);
}
