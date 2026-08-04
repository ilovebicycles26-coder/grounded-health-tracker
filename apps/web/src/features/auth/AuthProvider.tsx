import type { AuthError, AuthSession, Profile, ProfileUpdate, Result } from '@grounded/auth';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService, browserAuthStorage, profileRepository } from './runtime';

interface AuthContextValue {
  readonly status: 'loading' | 'anonymous' | 'authenticated' | 'configuration_error' | 'error';
  readonly session: AuthSession | null;
  readonly profile: Profile | null;
  readonly error: AuthError | null;
  readonly staySignedIn: boolean;
  setStaySignedIn(value: boolean): void;
  refresh(): Promise<void>;
  updateProfile(update: ProfileUpdate): Promise<Result<Profile>>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>(
    authService ? 'loading' : 'configuration_error',
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [staySignedIn, setStaySignedInState] = useState(
    browserAuthStorage.getPersistence() === 'durable',
  );
  const applySession = useCallback(async (next: AuthSession | null): Promise<void> => {
    setSession(next);
    setError(null);
    if (!next) {
      setProfile(null);
      setStatus('anonymous');
      return;
    }
    if (!profileRepository) {
      setStatus('configuration_error');
      return;
    }
    const result = await profileRepository.ensureForUser(next.user.id);
    if (!result.ok) {
      setError(result.error);
      setStatus('error');
      return;
    }
    setProfile(result.value);
    setStatus('authenticated');
  }, []);
  const refresh = useCallback(async (): Promise<void> => {
    if (!authService) return;
    setStatus('loading');
    const result = await authService.getSession();
    if (!result.ok) {
      setError(result.error);
      setStatus('error');
      return;
    }
    await applySession(result.value);
  }, [applySession]);
  const updateProfile = useCallback(
    async (update: ProfileUpdate): Promise<Result<Profile>> => {
      if (!profileRepository || !session) {
        return {
          ok: false,
          error: {
            code: 'not_authenticated',
            message: 'Sign in before changing account settings.',
          },
        };
      }
      const result = await profileRepository.updateForUser(session.user.id, update);
      if (result.ok) setProfile(result.value);
      return result;
    },
    [session],
  );
  useEffect(() => {
    if (!authService) return undefined;
    void authService.getSession().then((result) => {
      if (result.ok) void applySession(result.value);
      else {
        setError(result.error);
        setStatus('error');
      }
    });
    return authService.subscribe((_event, next) => {
      void applySession(next);
    });
  }, [applySession]);
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      error,
      staySignedIn,
      setStaySignedIn(value) {
        browserAuthStorage.setPersistence(value ? 'durable' : 'session');
        setStaySignedInState(value);
      },
      refresh,
      updateProfile,
    }),
    [error, profile, refresh, session, status, staySignedIn, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
