import {
  defaultDeviceSettings,
  parseDeviceSettings,
  type DeviceSettings,
} from '@grounded/settings';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

const STORAGE_KEY = 'grounded.device-settings.v1';

const palettes = {
  light: {
    background: '#f3f0e8',
    surface: '#fbfaf6',
    text: '#18362f',
    textMuted: '#61736c',
    border: '#d7dfd9',
    action: '#245f4e',
    actionText: '#ffffff',
  },
  dark: {
    background: '#10201c',
    surface: '#172b25',
    text: '#eef6f2',
    textMuted: '#b7c8c1',
    border: '#3a5148',
    action: '#8bd0b5',
    actionText: '#10231d',
  },
  'high-contrast': {
    background: '#000000',
    surface: '#000000',
    text: '#ffffff',
    textMuted: '#ffffff',
    border: '#ffffff',
    action: '#ffdf00',
    actionText: '#000000',
  },
} as const;

export type MobilePalette = (typeof palettes)[keyof typeof palettes];

interface MobileSettingsContextValue {
  readonly settings: DeviceSettings;
  readonly palette: MobilePalette;
  readonly ready: boolean;
  readonly update: (settings: DeviceSettings) => Promise<void>;
}

const MobileSettingsContext = createContext<MobileSettingsContextValue | null>(null);

export function MobileSettingsProvider({ children }: { readonly children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<DeviceSettings>(defaultDeviceSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (!active) return;
      try {
        setSettings(parseDeviceSettings(stored ? JSON.parse(stored) : null));
      } catch {
        setSettings(defaultDeviceSettings);
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (next: DeviceSettings) => {
    setSettings(next);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const effectiveTheme =
    settings.theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : settings.theme;
  const value = useMemo<MobileSettingsContextValue>(
    () => ({ settings, palette: palettes[effectiveTheme], ready, update }),
    [effectiveTheme, ready, settings, update],
  );

  return <MobileSettingsContext.Provider value={value}>{children}</MobileSettingsContext.Provider>;
}

export function useMobileSettings(): MobileSettingsContextValue {
  const value = useContext(MobileSettingsContext);
  if (!value) throw new Error('useMobileSettings must be used within MobileSettingsProvider.');
  return value;
}
