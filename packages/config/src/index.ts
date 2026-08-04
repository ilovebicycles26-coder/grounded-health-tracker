export type EnvironmentName = 'development' | 'test' | 'staging' | 'production';

export interface PublicConfiguration {
  readonly environment: EnvironmentName;
  readonly release: string;
  readonly supabase: {
    readonly url: string;
    readonly publishableKey: string;
  } | null;
}

export function definePublicConfiguration(configuration: PublicConfiguration): PublicConfiguration {
  if (configuration.release.trim().length === 0) {
    throw new Error('A release identifier is required.');
  }
  return Object.freeze({ ...configuration });
}
