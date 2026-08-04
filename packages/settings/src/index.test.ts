import { describe, expect, it } from 'vitest';

import {
  defaultAccountSettings,
  defaultDeviceSettings,
  isValidTimeZone,
  parseAccountSettings,
  parseDeviceSettings,
} from './index';

describe('settings registry', () => {
  it('recovers each device preference independently from corrupted storage', () => {
    expect(
      parseDeviceSettings({ version: 99, theme: 'dark', motion: 'fast', reducedData: true }),
    ).toEqual({
      ...defaultDeviceSettings,
      theme: 'dark',
      reducedData: true,
    });
  });

  it('uses privacy-preserving account defaults', () => {
    expect(parseAccountSettings({ unitSystem: 'imperial', analyticsConsent: 'yes' })).toEqual({
      ...defaultAccountSettings,
      unitSystem: 'imperial',
      analyticsConsent: false,
    });
  });

  it('validates IANA timezones without maintaining a stale local list', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
