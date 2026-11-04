import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

/**
 * `true`  = guide finished / skipped (never auto-show again)
 * `false` = pending after signup — show once on next app shell load
 * missing = existing account (or never set) — do not auto-show
 */
const SETTINGS_KEY = 'onboarding_guide_completed';

@Injectable({ providedIn: 'root' })
export class OnboardingGuideService {
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);

  private readonly loaded = signal(false);
  private readonly completed = signal(true);
  private readonly open = signal(false);

  readonly ready = computed(() => this.loaded());
  readonly isOpen = this.open.asReadonly();
  readonly hasCompleted = this.completed.asReadonly();

  /**
   * Load the guide flag. Only auto-opens when signup explicitly marked it pending (`false`).
   * Existing users with no flag (or `true`) never get the popup on a new browser/device.
   */
  async ensureLoaded(): Promise<void> {
    if (this.loaded() || !this.auth.isAuthenticated()) {
      return;
    }
    try {
      const value = await this.settings.getSetting<boolean>(SETTINGS_KEY);

      let pendingSession = false;
      try {
        pendingSession = sessionStorage.getItem('myalibi:onboarding-pending') === '1';
      } catch {
        pendingSession = false;
      }

      if (value === false || (value == null && pendingSession)) {
        this.completed.set(false);
        this.open.set(true);
        return;
      }

      // `true` or missing → existing / returning user; never auto-show.
      this.completed.set(true);
      this.open.set(false);
      if (value !== true) {
        await this.settings.setSetting(SETTINGS_KEY, true);
      }
      try {
        sessionStorage.removeItem('myalibi:onboarding-pending');
      } catch {
        /* ignore */
      }
    } catch {
      this.completed.set(true);
      this.open.set(false);
    } finally {
      this.loaded.set(true);
    }
  }

  /**
   * Call after every successful sign-up (session or email-confirm) so the guide
   * appears once on the first authenticated shell load — not after a normal sign-in.
   */
  async markPendingAfterSignup(): Promise<void> {
    this.completed.set(false);
    this.loaded.set(false);
    try {
      sessionStorage.setItem('myalibi:onboarding-pending', '1');
    } catch {
      /* ignore */
    }
    if (!this.auth.isAuthenticated()) {
      return;
    }
    try {
      await this.settings.setSetting(SETTINGS_KEY, false);
    } catch {
      // sessionStorage pending flag is enough for first shell load
    }
  }

  /** Re-open the guide from Settings / account menu. */
  reopen(): void {
    this.open.set(true);
  }

  async skip(): Promise<void> {
    await this.finish();
  }

  async complete(): Promise<void> {
    await this.finish();
  }

  dismissWithoutSaving(): void {
    this.open.set(false);
  }

  private async finish(): Promise<void> {
    this.open.set(false);
    this.completed.set(true);
    try {
      sessionStorage.removeItem('myalibi:onboarding-pending');
    } catch {
      /* ignore */
    }
    if (!this.auth.isAuthenticated()) {
      return;
    }
    try {
      await this.settings.setSetting(SETTINGS_KEY, true);
    } catch {
      // Keep local completed so we don't loop every load if persist fails.
    }
  }
}
