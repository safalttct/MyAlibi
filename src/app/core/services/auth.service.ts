import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface AuthResult {
  error: string | null;
  /** True when sign-up succeeded but email confirmation is still pending. */
  needsConfirmation?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly session = signal<Session | null>(null);
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly loading = signal(true);
  readonly isAuthenticated = computed(() => this.user() !== null);
  /** True after the user opens a password-reset email link. */
  readonly passwordRecovery = signal(false);

  private initPromise: Promise<void> | null = null;

  /** Restores the persisted session and subscribes to auth changes. Idempotent. */
  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (!this.supabase.configured()) {
      this.loading.set(false);
      return;
    }
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this.session.set(data.session);
    } catch {
      this.session.set(null);
    } finally {
      this.loading.set(false);
    }

    this.supabase.client.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecovery.set(true);
      }
    });
  }

  requireUserId(): string {
    const user = this.user();
    if (!user) {
      throw new Error('You must be signed in.');
    }
    return user.id;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    this.session.set(data.session);
    return { error: null };
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.client.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }
    if (data.session) {
      this.session.set(data.session);
      return { error: null };
    }
    return { error: null, needsConfirmation: true };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.session.set(null);
    await this.router.navigate(['/login']);
  }

  /** Sends a password-reset email. Redirects back to /login after the user sets a new password. */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) {
      return { error: error.message };
    }
    this.passwordRecovery.set(false);
    return { error: null };
  }
}
