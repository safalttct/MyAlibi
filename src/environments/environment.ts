import { environment as generated } from './environment.generated';

/**
 * Runtime configuration. Values are produced by `scripts/set-env.mjs` from the
 * `NG_APP_SUPABASE_*` variables (`.env` locally, platform env vars in CI/Vercel).
 * `environment.generated.ts` is git-ignored and regenerated before every build/test.
 */
export interface AppEnvironment {
  readonly production: boolean;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly configured: boolean;
}

export const environment: AppEnvironment = generated;
