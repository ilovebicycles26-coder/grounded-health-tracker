import { zodResolver } from '@hookform/resolvers/zod';
import {
  deviceSettingsSchema,
  motionPreferenceSchema,
  themePreferenceSchema,
} from '@grounded/settings';
import { Button, Card, Checkbox, SelectField } from '@grounded/ui/web';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthProvider';
import { useDeviceSettings } from '../../features/settings/deviceSettings';
import { SaveMessage, type SaveState } from './formSupport';

const preferencesSchema = z.object({
  theme: themePreferenceSchema,
  motion: motionPreferenceSchema,
  reducedData: z.boolean(),
  calorieDisplay: z.boolean(),
});

type PreferencesValues = z.infer<typeof preferencesSchema>;

export function Component() {
  const auth = useAuth();
  const device = useDeviceSettings();
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const {
    formState: { isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: device.settings.theme,
      motion: device.settings.motion,
      reducedData: device.settings.reducedData,
      calorieDisplay: auth.profile?.calorieDisplay ?? true,
    },
  });

  useEffect(() => {
    reset({
      theme: device.settings.theme,
      motion: device.settings.motion,
      reducedData: device.settings.reducedData,
      calorieDisplay: auth.profile?.calorieDisplay ?? true,
    });
  }, [auth.profile?.calorieDisplay, device.settings, reset]);

  const save = handleSubmit(async (values) => {
    setSaveState({ status: 'idle' });
    const result = await auth.updateProfile({ calorieDisplay: values.calorieDisplay });
    if (!result.ok) {
      setSaveState({ status: 'error', error: result.error });
      return;
    }
    const nextDeviceSettings = deviceSettingsSchema.parse({
      version: 1,
      theme: values.theme,
      motion: values.motion,
      reducedData: values.reducedData,
    });
    device.setSettings(nextDeviceSettings);
    reset(values);
    setSaveState({ status: 'saved' });
  });

  return (
    <Card aria-labelledby="appearance-settings-title">
      <div className="settings-section-heading">
        <p className="eyebrow">THIS DEVICE</p>
        <h2 id="appearance-settings-title">Appearance & comfort</h2>
        <p>Theme, motion and data-saving choices apply only to this device.</p>
      </div>
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <SelectField
          hint="System follows this phone or computer automatically."
          label="Colour theme"
          {...register('theme')}
        >
          <option value="system">Use system setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High contrast</option>
        </SelectField>
        <SelectField
          hint="Reduce turns off non-essential animation, in addition to your device setting."
          label="Motion"
          {...register('motion')}
        >
          <option value="system">Use system setting</option>
          <option value="reduce">Reduce motion</option>
        </SelectField>
        <Checkbox
          hint="Future image and background sync features will use less mobile data."
          label="Use less data"
          {...register('reducedData')}
        />
        <div className="settings-divider" />
        <Checkbox
          hint="This account choice will apply on every signed-in device."
          label="Show calorie totals"
          {...register('calorieDisplay')}
        />
        <div className="form-actions">
          <Button disabled={!isDirty} pending={isSubmitting} type="submit">
            Save appearance settings
          </Button>
          <SaveMessage state={saveState} />
        </div>
      </form>
    </Card>
  );
}
