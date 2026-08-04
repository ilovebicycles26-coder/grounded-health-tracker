import type { UserId } from '@grounded/domain';
import { CompositeSyncTransport, type SyncTransport } from '@grounded/sync';
import {
  SupabaseExerciseSyncTransport,
  SupabaseHabitSyncTransport,
  SupabaseNutritionSyncTransport,
  SupabaseWeightSyncTransport,
} from '@grounded/supabase';

import { supabaseClient } from '../auth/runtime';

export function createAccountSyncTransport(ownerId: UserId): SyncTransport | null {
  if (!supabaseClient) return null;
  return new CompositeSyncTransport([
    new SupabaseExerciseSyncTransport(supabaseClient, ownerId),
    new SupabaseHabitSyncTransport(supabaseClient, ownerId),
    new SupabaseWeightSyncTransport(supabaseClient, ownerId),
    new SupabaseNutritionSyncTransport(supabaseClient, ownerId),
  ]);
}
