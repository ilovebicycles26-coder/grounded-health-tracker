import type {
  AuthError,
  AuthEvent,
  AuthService,
  AuthSession,
  Profile,
  ProfileRepository,
  ProfileUpdate,
  Result,
} from '@grounded/auth';
import {
  AuthApiError,
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

import type { Database } from './database';

export type GroundedSupabaseClient = SupabaseClient<Database>;

export function createGroundedSupabaseClient(
  url: string,
  publishableKey: string,
  options?: SupabaseClientOptions<'public'>,
): GroundedSupabaseClient {
  return createClient<Database>(url, publishableKey, options);
}

function mapSession(session: Session): AuthSession {
  return {
    user: { id: session.user.id, email: session.user.email ?? null },
    expiresAt: session.expires_at ?? null,
  };
}

function safeError(error: unknown): AuthError {
  if (error instanceof AuthApiError) {
    const code = error.code ?? '';
    if (code === 'invalid_credentials') {
      return { code: 'invalid_credentials', message: 'The email or password is not correct.' };
    }
    if (code === 'email_not_confirmed') {
      return { code: 'email_not_confirmed', message: 'Confirm your email before signing in.' };
    }
    if (code.includes('weak_password')) {
      return { code: 'password_too_short', message: 'Use a stronger password.' };
    }
    if (error.status === 429) {
      return { code: 'rate_limited', message: 'Too many attempts. Please wait and try again.' };
    }
  }
  if (error instanceof TypeError) {
    return { code: 'network_error', message: 'Grounded could not reach the service.' };
  }
  return { code: 'unknown', message: 'Something went wrong. Please try again.' };
}

function failure<T>(error: unknown): Result<T> {
  return { ok: false, error: safeError(error) };
}

function mapAuthEvent(event: AuthChangeEvent): AuthEvent | null {
  if (event === 'INITIAL_SESSION') return 'initial';
  if (event === 'SIGNED_IN') return 'signed_in';
  if (event === 'SIGNED_OUT') return 'signed_out';
  if (event === 'PASSWORD_RECOVERY') return 'password_recovery';
  return null;
}

export class SupabaseAuthService implements AuthService {
  public constructor(private readonly client: GroundedSupabaseClient) {}

  public async getSession(): Promise<Result<AuthSession | null>> {
    const { data, error } = await this.client.auth.getSession();
    if (error) return failure(error);
    return { ok: true, value: data.session ? mapSession(data.session) : null };
  }

  public async signIn(email: string, password: string): Promise<Result<AuthSession>> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return failure(error);
    return { ok: true, value: mapSession(data.session) };
  }

  public async signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<Result<{ requiresConfirmation: boolean }>> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: input.emailRedirectTo },
    });
    if (error) return failure(error);
    return { ok: true, value: { requiresConfirmation: data.session === null } };
  }

  public async signOut(): Promise<Result<void>> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    return error ? failure(error) : { ok: true, value: undefined };
  }

  public async requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<Result<void>> {
    const { error } = await this.client.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    });
    return error ? failure(error) : { ok: true, value: undefined };
  }

  public async updatePassword(password: string): Promise<Result<void>> {
    const { error } = await this.client.auth.updateUser({ password });
    return error ? failure(error) : { ok: true, value: undefined };
  }

  public subscribe(listener: (event: AuthEvent, session: AuthSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const mappedEvent = mapAuthEvent(event);
      if (mappedEvent) listener(mappedEvent, session ? mapSession(session) : null);
    });
    return () => data.subscription.unsubscribe();
  }
}

function mapProfile(row: Database['public']['Tables']['profiles']['Row']): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    timezone: row.timezone,
    locale: row.locale,
    unitSystem: row.unit_system,
    weekStartsOn: row.week_starts_on,
    calorieDisplay: row.calorie_display,
    analyticsConsent: row.analytics_consent,
    onboardingCompleted: row.onboarding_completed,
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  public constructor(private readonly client: GroundedSupabaseClient) {}

  public async getForUser(userId: string): Promise<Result<Profile>> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) return failure(error);
    return { ok: true, value: mapProfile(data) };
  }

  public async ensureForUser(userId: string): Promise<Result<Profile>> {
    const existing = await this.getForUser(userId);
    if (existing.ok) return existing;
    const { data, error } = await this.client
      .from('profiles')
      .insert({ user_id: userId })
      .select('*')
      .single();
    if (error) return failure(error);
    return { ok: true, value: mapProfile(data) };
  }

  public async updateForUser(userId: string, update: ProfileUpdate): Promise<Result<Profile>> {
    const databaseUpdate: Database['public']['Tables']['profiles']['Update'] = {};
    if (update.displayName !== undefined) databaseUpdate.display_name = update.displayName;
    if (update.timezone !== undefined) databaseUpdate.timezone = update.timezone;
    if (update.locale !== undefined) databaseUpdate.locale = update.locale;
    if (update.unitSystem !== undefined) databaseUpdate.unit_system = update.unitSystem;
    if (update.weekStartsOn !== undefined) databaseUpdate.week_starts_on = update.weekStartsOn;
    if (update.calorieDisplay !== undefined) databaseUpdate.calorie_display = update.calorieDisplay;
    if (update.analyticsConsent !== undefined) {
      databaseUpdate.analytics_consent = update.analyticsConsent;
    }
    const { data, error } = await this.client
      .from('profiles')
      .update(databaseUpdate)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) return failure(error);
    return { ok: true, value: mapProfile(data) };
  }
}

export type { Database } from './database';
export { SupabaseWeightSyncTransport } from './weightSync';
export { SupabaseNutritionSyncTransport } from './nutritionSync';
export { SupabaseExerciseSyncTransport } from './exerciseSync';
export { SupabaseHabitSyncTransport } from './habitSync';
export { SupabaseSharingRepository } from './sharing';
