import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SettingsService } from '../../core/services/settings.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

function timezones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, SettingsTabs, UiCard, UiButton, UiField, UiInput, UiSelect, UiSkeleton],
  template: `
    <app-page-header title="Settings" subtitle="Your profile" />
    <app-settings-tabs class="mb-6" />

    <ui-card class="max-w-xl">
      @if (loading()) {
        <ui-skeleton class="h-40" />
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="grid gap-4">
          <ui-field label="Display name" [error]="nameError()">
            <input uiInput type="text" formControlName="display_name" maxlength="80" placeholder="Your name" />
          </ui-field>
          <ui-field label="Timezone">
            <select uiSelect formControlName="timezone">
              @for (tz of zones(); track tz) { <option [value]="tz">{{ tz }}</option> }
            </select>
          </ui-field>
          @if (error()) {
            <p class="text-sm text-danger" role="alert">{{ error() }}</p>
          }
          <div class="flex justify-end">
            <button uiButton type="submit" [loading]="saving()">Save profile</button>
          </div>
        </form>
      }
    </ui-card>
  `,
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly zones = signal<string[]>(timezones('Asia/Kolkata'));

  protected readonly form = this.fb.group({
    display_name: ['', [Validators.maxLength(80)]],
    timezone: ['Asia/Kolkata', Validators.required],
  });

  constructor() {
    void this.load();
  }

  protected nameError(): string | null {
    return this.form.controls.display_name.errors ? 'Use 80 characters or fewer' : null;
  }

  private async load(): Promise<void> {
    try {
      const profile = await this.settings.getProfile();
      const timezone = profile?.timezone ?? 'Asia/Kolkata';
      this.zones.set(timezones(timezone));
      this.form.reset({ display_name: profile?.display_name ?? '', timezone });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const { display_name, timezone } = this.form.getRawValue();
      await this.settings.updateProfile({ display_name: display_name.trim() || null, timezone });
      this.toast.success('Profile saved');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      this.saving.set(false);
    }
  }
}
