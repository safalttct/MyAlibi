import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CATEGORIES,
  CategoryMeta,
  DEFAULT_ENABLED_CATEGORIES,
  LeaveCategory,
  normalizeCategory,
} from '../models/leave.models';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

const SETTINGS_KEY = 'enabled_leave_categories';

@Injectable({ providedIn: 'root' })
export class CategoryPreferencesService {
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);

  private readonly enabledIds = signal<ReadonlySet<string>>(new Set(DEFAULT_ENABLED_CATEGORIES));
  private readonly loaded = signal(false);
  private readonly saving = signal(false);

  readonly ready = computed(() => this.loaded());
  readonly enabledCategories = computed(() =>
    CATEGORIES.filter((c) => this.enabledIds().has(c.id)),
  );

  isEnabled(category: LeaveCategory): boolean {
    return this.enabledIds().has(normalizeCategory(category));
  }

  /** Load prefs for the signed-in user. Safe to call repeatedly. */
  async ensureLoaded(): Promise<void> {
    if (this.loaded() || !this.auth.isAuthenticated()) {
      return;
    }
    try {
      const stored = await this.settings.getSetting<string[]>(SETTINGS_KEY);
      if (Array.isArray(stored) && stored.length > 0) {
        const valid = stored
          .map((c) => normalizeCategory(c as LeaveCategory))
          .filter((c) => CATEGORIES.some((m) => m.id === c));
        if (valid.length > 0) {
          this.enabledIds.set(new Set(valid));
        }
      }
    } catch {
      // Keep defaults if settings cannot be read.
    } finally {
      this.loaded.set(true);
    }
  }

  async setEnabled(category: CategoryMeta['id'], enabled: boolean): Promise<void> {
    const next = new Set(this.enabledIds());
    if (enabled) {
      next.add(category);
    } else {
      next.delete(category);
    }
    // Never allow an empty set — keep at least one type on.
    if (next.size === 0) {
      next.add('Casual Leave');
    }
    this.enabledIds.set(next);
    await this.persist();
  }

  async resetToDefaults(): Promise<void> {
    this.enabledIds.set(new Set(DEFAULT_ENABLED_CATEGORIES));
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (this.saving() || !this.auth.isAuthenticated()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.settings.setSetting(SETTINGS_KEY, [...this.enabledIds()]);
    } finally {
      this.saving.set(false);
    }
  }
}
