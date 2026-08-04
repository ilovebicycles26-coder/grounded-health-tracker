import {
  SupabaseAuthService,
  SupabasePersonalAccessService,
  SupabaseProfileRepository,
  createGroundedSupabaseClient,
} from '@grounded/supabase';
import { configuration } from '../../app/configuration';
import { BrowserAuthStorage } from './browserAuthStorage';

export const browserAuthStorage = new BrowserAuthStorage(
  window.localStorage,
  window.sessionStorage,
);
export const supabaseClient = configuration.supabase
  ? createGroundedSupabaseClient(
      configuration.supabase.url,
      configuration.supabase.publishableKey,
      {
        auth: {
          storage: browserAuthStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      },
    )
  : null;
export const authService = supabaseClient ? new SupabaseAuthService(supabaseClient) : null;
export const personalAccessService = supabaseClient
  ? new SupabasePersonalAccessService(supabaseClient)
  : null;
export const profileRepository = supabaseClient
  ? new SupabaseProfileRepository(supabaseClient)
  : null;
