import { Injectable, signal } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Throws a readable Error when a Supabase call failed, otherwise returns data. */
export function unwrap<T>(result: SupabaseResult<T>): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data as T;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  /** False when NG_APP_SUPABASE_* variables were not provided at build time. */
  readonly configured = signal(environment.configured);

  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl || 'http://localhost:54321',
    environment.supabasePublishableKey || 'unconfigured',
    {
      auth: {
        persistSession: environment.configured,
        autoRefreshToken: environment.configured,
        detectSessionInUrl: environment.configured,
      },
    },
  );
}
