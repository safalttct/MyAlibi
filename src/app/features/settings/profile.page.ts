import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideBookOpen, LucideDownload, LucideLogOut } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingGuideService } from '../../core/services/onboarding-guide.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';
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
  imports: [
    ReactiveFormsModule,
    PageHeader,
    SettingsTabs,
    UiCard,
    UiButton,
    UiField,
    UiInput,
    UiSelect,
    UiSkeleton,
    LucideLogOut,
    LucideBookOpen,
    LucideDownload,
  ],
  template: `
    <app-page-header title="Settings" subtitle="Your profile and account" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <div class="grid max-w-xl gap-4">
      <ui-card title="Profile">
        @if (loading()) {
          <ui-skeleton class="h-40" />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="grid gap-4">
            <ui-field label="Display name" [error]="nameError()">
              <input uiInput type="text" formControlName="display_name" maxlength="80" placeholder="Your name" />
            </ui-field>
            <ui-field label="Timezone">
              <select uiSelect formControlName="timezone">
                @for (tz of zones(); track tz) {
                  <option [value]="tz">{{ tz }}</option>
                }
              </select>
            </ui-field>
            @if (error()) {
              <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {{ error() }}
              </p>
            }
            <div class="flex justify-end">
              <button uiButton type="submit" class="max-sm:w-full" [loading]="saving()">Save profile</button>
            </div>
          </form>
        }
      </ui-card>

      <ui-card title="Help" description="Install on your phone or replay the guide">
        <div class="flex flex-col gap-2 sm:flex-row">
          @if (pwa.canInstall() && !pwa.isStandalone()) {
            <button uiButton type="button" class="max-sm:w-full" (click)="installApp()">
              <svg lucideDownload size="16"></svg>
              Install app
            </button>
          }
          <button uiButton type="button" variant="outline" class="max-sm:w-full" (click)="onboarding.reopen()">
            <svg lucideBookOpen size="16"></svg>
            Show guide
          </button>
        </div>
        @if (!pwa.isStandalone() && !pwa.canInstall()) {
          <p class="mt-3 text-xs text-muted">
            On iPhone: Safari → Share → Add to Home Screen. On Android Chrome: menu → Install app /
            Add to Home screen.
          </p>
        }
        @if (pwa.isStandalone()) {
          <p class="mt-3 text-xs text-muted">Running as an installed app.</p>
        }
      </ui-card>

      <ui-card title="Account" description="Signed in as this email">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">{{ auth.user()?.email }}</p>
            <p class="mt-0.5 text-xs text-muted">Use Sign out on shared devices</p>
          </div>
          <button
            uiButton
            type="button"
            variant="outline"
            class="max-sm:w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            (click)="auth.signOut()"
          >
            <svg lucideLogOut size="16"></svg>
            Sign out
          </button>
        </div>
      </ui-card>
    </div>
  `,
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly onboarding = inject(OnboardingGuideService);
  protected readonly pwa = inject(PwaInstallService);

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

  protected async installApp(): Promise<void> {
    const outcome = await this.pwa.promptInstall();
    if (outcome === 'accepted') {
      this.toast.success('MyAlibi installed');
    } else if (outcome === 'unavailable') {
      this.toast.info('Use your browser menu → Add to Home Screen / Install app');
    }
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
