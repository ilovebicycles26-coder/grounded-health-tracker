import { definePublicConfiguration } from '@grounded/config';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configuration = definePublicConfiguration({
  environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
  release: import.meta.env.VITE_RELEASE ?? 'local',
  supabase:
    supabaseUrl && supabasePublishableKey
      ? { url: supabaseUrl, publishableKey: supabasePublishableKey }
      : null,
});
