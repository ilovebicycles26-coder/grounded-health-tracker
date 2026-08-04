// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { defaultDeviceSettings } from '@grounded/settings';
import { describe, expect, it } from 'vitest';

import {
  applyDeviceSettings,
  BrowserDeviceSettingsStorage,
  DEVICE_SETTINGS_STORAGE_KEY,
  resolveTheme,
} from './deviceSettings';

describe('device settings', () => {
  it('persists only the validated settings document', () => {
    const storage = new BrowserDeviceSettingsStorage(window.localStorage);
    storage.write({ ...defaultDeviceSettings, theme: 'dark', reducedData: true });
    expect(JSON.parse(window.localStorage.getItem(DEVICE_SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      theme: 'dark',
      motion: 'system',
      reducedData: true,
    });
  });

  it('resolves system appearance and applies accessibility attributes', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    applyDeviceSettings(
      { ...defaultDeviceSettings, theme: 'high-contrast', motion: 'reduce' },
      document.documentElement,
      undefined,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'high-contrast');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
