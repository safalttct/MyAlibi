import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

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

  /** Load completion flag and open the guide for first-time users. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded() || !this.auth.isAuthenticated()) {
      return;
    }
    try {
      const value = await this.settings.getSetting<boolean>(SETTINGS_KEY);
      const done = value === true;
      this.completed.set(done);
      if (!done) {
        this.open.set(true);
      }
    } catch {
      // Fail closed for the guide — don't block the app.
      this.completed.set(true);
    } finally {
      this.loaded.set(true);
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
