import { z } from 'zod';

export type SettingScope = 'device' | 'account';

export interface SettingDefinition<T> {
  readonly key: string;
  readonly schema: z.ZodType<T>;
  readonly defaultValue: T;
  readonly scope: SettingScope;
  readonly version: number;
}

export const themePreferenceSchema = z.enum(['system', 'light', 'dark', 'high-contrast']);
export const motionPreferenceSchema = z.enum(['system', 'reduce']);
export const unitSystemSchema = z.enum(['metric', 'imperial']);
export const weekStartsOnSchema = z.union([z.literal(0), z.literal(1)]);
export const timezoneSchema = z.string().trim().min(1).max(64);
export const localeSchema = z.string().trim().min(2).max(16);

export type ThemePreference = z.infer<typeof themePreferenceSchema>;
export type MotionPreference = z.infer<typeof motionPreferenceSchema>;
export type UnitSystem = z.infer<typeof unitSystemSchema>;
export type WeekStartsOn = z.infer<typeof weekStartsOnSchema>;

export const deviceSettingsSchema = z
  .object({
    version: z.literal(1),
    theme: themePreferenceSchema,
    motion: motionPreferenceSchema,
    reducedData: z.boolean(),
  })
  .readonly();

export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;

export const accountSettingsSchema = z
  .object({
    timezone: timezoneSchema,
    locale: localeSchema,
    unitSystem: unitSystemSchema,
    weekStartsOn: weekStartsOnSchema,
    calorieDisplay: z.boolean(),
    analyticsConsent: z.boolean(),
  })
  .readonly();

export type AccountSettings = z.infer<typeof accountSettingsSchema>;

export const deviceSettingDefinitions = {
  theme: {
    key: 'appearance.theme',
    schema: themePreferenceSchema,
    defaultValue: 'system',
    scope: 'device',
    version: 1,
  },
  motion: {
    key: 'accessibility.motion',
    schema: motionPreferenceSchema,
    defaultValue: 'system',
    scope: 'device',
    version: 1,
  },
  reducedData: {
    key: 'performance.reducedData',
    schema: z.boolean(),
    defaultValue: false,
    scope: 'device',
    version: 1,
  },
} as const satisfies Record<keyof Omit<DeviceSettings, 'version'>, SettingDefinition<unknown>>;

export const accountSettingDefinitions = {
  timezone: {
    key: 'regional.timezone',
    schema: timezoneSchema,
    defaultValue: 'UTC',
    scope: 'account',
    version: 1,
  },
  locale: {
    key: 'regional.locale',
    schema: localeSchema,
    defaultValue: 'en-GB',
    scope: 'account',
    version: 1,
  },
  unitSystem: {
    key: 'measurement.unitSystem',
    schema: unitSystemSchema,
    defaultValue: 'metric',
    scope: 'account',
    version: 1,
  },
  weekStartsOn: {
    key: 'regional.weekStartsOn',
    schema: weekStartsOnSchema,
    defaultValue: 1,
    scope: 'account',
    version: 1,
  },
  calorieDisplay: {
    key: 'nutrition.calorieDisplay',
    schema: z.boolean(),
    defaultValue: true,
    scope: 'account',
    version: 1,
  },
  analyticsConsent: {
    key: 'privacy.analyticsConsent',
    schema: z.boolean(),
    defaultValue: false,
    scope: 'account',
    version: 1,
  },
} as const satisfies Record<keyof AccountSettings, SettingDefinition<unknown>>;

export const defaultDeviceSettings: DeviceSettings = {
  version: 1,
  theme: deviceSettingDefinitions.theme.defaultValue,
  motion: deviceSettingDefinitions.motion.defaultValue,
  reducedData: deviceSettingDefinitions.reducedData.defaultValue,
};

export const defaultAccountSettings: AccountSettings = {
  timezone: accountSettingDefinitions.timezone.defaultValue,
  locale: accountSettingDefinitions.locale.defaultValue,
  unitSystem: accountSettingDefinitions.unitSystem.defaultValue,
  weekStartsOn: accountSettingDefinitions.weekStartsOn.defaultValue,
  calorieDisplay: accountSettingDefinitions.calorieDisplay.defaultValue,
  analyticsConsent: accountSettingDefinitions.analyticsConsent.defaultValue,
};

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function fallback<T>(schema: z.ZodType<T>, value: unknown, defaultValue: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : defaultValue;
}

export function parseDeviceSettings(value: unknown): DeviceSettings {
  const source = record(value);
  return {
    version: 1,
    theme: fallback(themePreferenceSchema, source.theme, defaultDeviceSettings.theme),
    motion: fallback(motionPreferenceSchema, source.motion, defaultDeviceSettings.motion),
    reducedData: fallback(z.boolean(), source.reducedData, defaultDeviceSettings.reducedData),
  };
}

export function parseAccountSettings(value: unknown): AccountSettings {
  const source = record(value);
  return {
    timezone: fallback(timezoneSchema, source.timezone, defaultAccountSettings.timezone),
    locale: fallback(localeSchema, source.locale, defaultAccountSettings.locale),
    unitSystem: fallback(unitSystemSchema, source.unitSystem, defaultAccountSettings.unitSystem),
    weekStartsOn: fallback(
      weekStartsOnSchema,
      source.weekStartsOn,
      defaultAccountSettings.weekStartsOn,
    ),
    calorieDisplay: fallback(
      z.boolean(),
      source.calorieDisplay,
      defaultAccountSettings.calorieDisplay,
    ),
    analyticsConsent: fallback(
      z.boolean(),
      source.analyticsConsent,
      defaultAccountSettings.analyticsConsent,
    ),
  };
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}
