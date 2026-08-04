import { zodResolver } from '@hookform/resolvers/zod';
import { isValidTimeZone, unitSystemSchema, weekStartsOnSchema } from '@grounded/settings';
import { Button, Card, SelectField, TextField } from '@grounded/ui/web';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthProvider';
import { SaveMessage, type SaveState } from './formSupport';

const profileSettingsSchema = z.object({
  displayName: z.string().trim().max(80, 'Use 80 characters or fewer.'),
  timezone: z
    .string()
    .trim()
    .min(1, 'Enter a timezone.')
    .max(64, 'Use 64 characters or fewer.')
    .refine(isValidTimeZone, 'Use a valid timezone such as Europe/London.'),
  locale: z.string().trim().min(2).max(16),
  unitSystem: unitSystemSchema,
  weekStartsOn: weekStartsOnSchema,
});

type ProfileSettingsValues = z.infer<typeof profileSettingsSchema>;

function timezones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Europe/London', 'UTC'];
  }
}

export function Component() {
  const auth = useAuth();
  const profile = auth.profile;
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const {
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<ProfileSettingsValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: profile?.locale ?? 'en-GB',
      unitSystem: profile?.unitSystem ?? 'metric',
      weekStartsOn: profile?.weekStartsOn ?? 1,
    },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      displayName: profile.displayName ?? '',
      timezone: profile.timezone,
      locale: profile.locale,
      unitSystem: profile.unitSystem,
      weekStartsOn: profile.weekStartsOn,
    });
  }, [profile, reset]);

  const save = handleSubmit(async (values) => {
    setSaveState({ status: 'idle' });
    const result = await auth.updateProfile({
      displayName: values.displayName || null,
      timezone: values.timezone,
      locale: values.locale,
      unitSystem: values.unitSystem,
      weekStartsOn: values.weekStartsOn,
    });
    if (result.ok) {
      reset(values);
      setSaveState({ status: 'saved' });
    } else {
      setSaveState({ status: 'error', error: result.error });
    }
  });

  return (
    <Card aria-labelledby="profile-settings-title">
      <div className="settings-section-heading">
        <p className="eyebrow">ACCOUNT</p>
        <h2 id="profile-settings-title">Profile & region</h2>
        <p>Your regional choices travel with your account on every signed-in device.</p>
      </div>
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <TextField
          autoComplete="name"
          error={errors.displayName?.message}
          hint="This is shown inside your account. It is not public."
          label="Display name"
          {...register('displayName')}
        />
        <TextField
          autoComplete="off"
          error={errors.timezone?.message}
          hint="Used to put entries on the correct local day."
          label="Timezone"
          list="grounded-timezones"
          {...register('timezone')}
        />
        <datalist id="grounded-timezones">
          {timezones().map((timezone) => (
            <option key={timezone} value={timezone} />
          ))}
        </datalist>
        <SelectField
          error={errors.locale?.message}
          label="Language and date format"
          {...register('locale')}
        >
          <option value="en-GB">English (United Kingdom)</option>
          <option value="en-US">English (United States)</option>
        </SelectField>
        <SelectField
          error={errors.unitSystem?.message}
          hint="Metric uses kilograms and centimetres. Imperial uses pounds, stones and feet."
          label="Measurement units"
          {...register('unitSystem')}
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </SelectField>
        <SelectField
          error={errors.weekStartsOn?.message}
          label="First day of the week"
          {...register('weekStartsOn', { setValueAs: (value) => Number(value) })}
        >
          <option value="1">Monday</option>
          <option value="0">Sunday</option>
        </SelectField>
        <div className="form-actions">
          <Button disabled={!isDirty} pending={isSubmitting} type="submit">
            Save account settings
          </Button>
          <SaveMessage state={saveState} />
        </div>
      </form>
    </Card>
  );
}
