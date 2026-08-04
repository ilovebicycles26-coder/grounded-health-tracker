export type SessionPersistence = 'durable' | 'session';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'password_too_short'
  | 'rate_limited'
  | 'network_error'
  | 'not_authenticated'
  | 'configuration_error'
  | 'access_denied'
  | 'unknown';

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: AuthError };

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

export interface AuthSession {
  readonly user: AuthUser;
  readonly expiresAt: number | null;
}

export type AuthEvent = 'initial' | 'signed_in' | 'signed_out' | 'password_recovery';

export interface SignUpInput {
  readonly email: string;
  readonly password: string;
  readonly emailRedirectTo: string;
}

export interface PasswordResetInput {
  readonly email: string;
  readonly redirectTo: string;
}

export interface AuthService {
  getSession(): Promise<Result<AuthSession | null>>;
  signIn(email: string, password: string): Promise<Result<AuthSession>>;
  signUp(input: SignUpInput): Promise<Result<{ requiresConfirmation: boolean }>>;
  signOut(): Promise<Result<void>>;
  requestPasswordReset(input: PasswordResetInput): Promise<Result<void>>;
  updatePassword(password: string): Promise<Result<void>>;
  subscribe(listener: (event: AuthEvent, session: AuthSession | null) => void): () => void;
}

export interface PersonalAccessService {
  hasAccess(): Promise<Result<boolean>>;
}

export interface Profile {
  readonly userId: string;
  readonly displayName: string | null;
  readonly timezone: string;
  readonly locale: string;
  readonly unitSystem: 'metric' | 'imperial';
  readonly weekStartsOn: 0 | 1;
  readonly calorieDisplay: boolean;
  readonly analyticsConsent: boolean;
  readonly onboardingCompleted: boolean;
}

export interface ProfileUpdate {
  readonly displayName?: string | null;
  readonly timezone?: string;
  readonly locale?: string;
  readonly unitSystem?: 'metric' | 'imperial';
  readonly weekStartsOn?: 0 | 1;
  readonly calorieDisplay?: boolean;
  readonly analyticsConsent?: boolean;
}

export interface ProfileRepository {
  getForUser(userId: string): Promise<Result<Profile>>;
  ensureForUser(userId: string): Promise<Result<Profile>>;
  updateForUser(userId: string, update: ProfileUpdate): Promise<Result<Profile>>;
}

export interface PersistenceController {
  getPersistence(): SessionPersistence;
  setPersistence(persistence: SessionPersistence): void;
}
