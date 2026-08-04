import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Checkbox } from '@grounded/ui/web';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthProvider';
import { SaveMessage, type SaveState } from './formSupport';

const privacySettingsSchema = z.object({ analyticsConsent: z.boolean() });
type PrivacySettingsValues = z.infer<typeof privacySettingsSchema>;

export function Component() {
  const auth = useAuth();
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const {
    formState: { isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<PrivacySettingsValues>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: { analyticsConsent: auth.profile?.analyticsConsent ?? false },
  });

  useEffect(() => {
    reset({ analyticsConsent: auth.profile?.analyticsConsent ?? false });
  }, [auth.profile?.analyticsConsent, reset]);

  const save = handleSubmit(async (values) => {
    setSaveState({ status: 'idle' });
    const result = await auth.updateProfile(values);
    if (result.ok) {
      reset(values);
      setSaveState({ status: 'saved' });
    } else {
      setSaveState({ status: 'error', error: result.error });
    }
  });

  return (
    <Card aria-labelledby="privacy-settings-title">
      <div className="settings-section-heading">
        <p className="eyebrow">PRIVACY FIRST</p>
        <h2 id="privacy-settings-title">Privacy choices</h2>
        <p>
          Health records are never used for advertising. Sharing with Zoe remains a separate,
          explicit action.
        </p>
      </div>
      <form className="settings-form" onSubmit={(event) => void save(event)}>
        <Checkbox
          hint="Allow anonymous product events such as screen viewed and feature completed. Health values, notes, email addresses and free text are always excluded. This is off by default."
          label="Help improve Grounded with privacy-safe analytics"
          {...register('analyticsConsent')}
        />
        <div className="privacy-note" role="note">
          <strong>Your choice is reversible.</strong>
          <p>Turning this off stops future optional analytics collection for your account.</p>
        </div>
        <div className="form-actions">
          <Button disabled={!isDirty} pending={isSubmitting} type="submit">
            Save privacy choice
          </Button>
          <SaveMessage state={saveState} />
        </div>
      </form>
    </Card>
  );
}
