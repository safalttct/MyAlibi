import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingGuideService } from '../../core/services/onboarding-guide.service';
import { isChunkLoadError, recoverFromStaleChunk } from '../../core/utils/chunk-reload';
import { AppFooter } from '../../shared/components/app-footer';
import { AppLogo } from '../../shared/components/app-logo';
import { ThemeToggle } from '../../shared/components/theme-toggle';
import { UiButton } from '../../shared/ui/ui-button';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiPasswordInput } from '../../shared/ui/ui-password-input';

type Mode = 'signin' | 'signup' | 'reset' | 'update';

const passwordMatch = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!confirm) {
    return null;
  }
  return password === confirm ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppLogo,
    AppFooter,
    ThemeToggle,
    UiButton,
    UiField,
    UiInput,
    UiPasswordInput,
  ],
  template: `
    <div class="relative flex min-h-dvh flex-col overflow-x-hidden bg-background px-4 py-8 pb-[max(1.5rem,var(--safe-bottom))] sm:py-10">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary-soft),_transparent_55%)]"
        aria-hidden="true"
      ></div>
      <div class="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <app-theme-toggle />
      </div>
      <div class="relative z-[1] flex flex-1 items-center justify-center">
      @if (!configured) {
        <section class="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-md sm:p-8">
          <div class="mb-6 flex justify-center">
            <app-logo class="[&_img]:object-center" size="xl" />
          </div>
          <h1 class="text-lg font-semibold tracking-tight text-foreground">Supabase not configured</h1>
          <p class="mt-2 text-sm text-muted">
            Set <code class="rounded bg-elevated px-1 py-0.5 text-xs">NG_APP_SUPABASE_URL</code> and
            <code class="rounded bg-elevated px-1 py-0.5 text-xs">NG_APP_SUPABASE_PUBLISHABLE_KEY</code>.
          </p>
          <ol class="mx-auto mt-5 max-w-sm list-decimal space-y-2 pl-5 text-left text-sm text-muted">
            <li>Local: copy <code class="text-xs">.env.example</code> to <code class="text-xs">.env</code> and fill in the keys.</li>
            <li>Vercel: add both variables under Project Settings → Environment Variables, then redeploy.</li>
            <li>Run <code class="text-xs">pnpm start</code> locally, or open the new deployment.</li>
          </ol>
        </section>
      } @else {
        <section class="w-full max-w-sm">
          <div class="mb-8 flex flex-col items-center gap-3 text-center">
            <app-logo class="[&_img]:mx-auto [&_img]:object-center" size="xl" />
            <p class="text-sm text-muted">Your personal leave &amp; WFH tracker</p>
          </div>

          <div class="rounded-2xl border border-border bg-card p-5 shadow-md sm:p-6">
            @if (mode() === 'signin' || mode() === 'signup') {
              <div
                class="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1 text-sm font-medium"
                role="tablist"
                aria-label="Account mode"
              >
                <button
                  type="button"
                  role="tab"
                  id="login-tab-signin"
                  aria-controls="login-panel"
                  [attr.aria-selected]="mode() === 'signin'"
                  class="min-h-10 rounded-lg transition-colors"
                  [class]="
                    mode() === 'signin'
                      ? 'bg-primary-soft text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  (click)="setMode('signin')"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  id="login-tab-signup"
                  aria-controls="login-panel"
                  [attr.aria-selected]="mode() === 'signup'"
                  class="min-h-10 rounded-lg transition-colors"
                  [class]="
                    mode() === 'signup'
                      ? 'bg-primary-soft text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  (click)="setMode('signup')"
                >
                  Create account
                </button>
              </div>
            } @else if (mode() === 'reset') {
              <div class="mb-5">
                <h2 class="text-base font-semibold tracking-tight text-foreground">Reset password</h2>
                <p class="mt-1 text-sm text-muted">We’ll email you a link to choose a new password.</p>
              </div>
            } @else {
              <div class="mb-5">
                <h2 class="text-base font-semibold tracking-tight text-foreground">Choose a new password</h2>
                <p class="mt-1 text-sm text-muted">You’re signed in via the reset link. Set a new password to continue.</p>
              </div>
            }

            <form
              id="login-panel"
              role="tabpanel"
              [attr.aria-labelledby]="
                mode() === 'signin' ? 'login-tab-signin' : mode() === 'signup' ? 'login-tab-signup' : null
              "
              [formGroup]="form"
              (ngSubmit)="submit()"
              class="grid gap-4"
              novalidate
            >
              @if (mode() === 'signin' || mode() === 'signup' || mode() === 'reset') {
                <ui-field label="Email" [error]="fieldError('email')" [required]="true">
                  <input
                    uiInput
                    type="email"
                    formControlName="email"
                    autocomplete="email"
                    inputmode="email"
                    placeholder="you@example.com"
                    [attr.aria-invalid]="!!fieldError('email')"
                  />
                </ui-field>
              }

              @if (mode() === 'signin' || mode() === 'signup' || mode() === 'update') {
                <ui-field
                  [label]="mode() === 'update' ? 'New password' : 'Password'"
                  [error]="fieldError('password')"
                  [required]="true"
                >
                  <ui-password-input
                    formControlName="password"
                    [autocomplete]="passwordAutocomplete()"
                    placeholder="At least 6 characters"
                    [invalid]="!!fieldError('password')"
                  />
                </ui-field>
              }

              @if (mode() === 'signup' || mode() === 'update') {
                <ui-field label="Confirm password" [error]="confirmError()" [required]="true">
                  <ui-password-input
                    formControlName="confirmPassword"
                    autocomplete="new-password"
                    placeholder="Re-enter password"
                    [invalid]="!!confirmError()"
                  />
                </ui-field>
              }

              @if (mode() === 'signin') {
                <div class="-mt-1 flex justify-end">
                  <button
                    type="button"
                    class="text-xs font-medium text-primary hover:underline"
                    (click)="setMode('reset')"
                  >
                    Forgot password?
                  </button>
                </div>
              }

              @if (error()) {
                <p
                  class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
                  role="alert"
                >
                  {{ error() }}
                </p>
              }
              @if (info()) {
                <p
                  class="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
                  role="status"
                >
                  {{ info() }}
                </p>
              }

              <button uiButton type="submit" size="lg" class="mt-1 w-full" [loading]="busy()">
                {{ submitLabel() }}
              </button>

              @if (mode() === 'reset') {
                <button
                  type="button"
                  class="text-sm font-medium text-muted-foreground hover:text-foreground"
                  (click)="setMode('signin')"
                >
                  Back to sign in
                </button>
              }
            </form>
          </div>
        </section>
      }
      </div>
      <app-footer class="mx-auto w-full max-w-sm pt-6" [showAbout]="false" />
    </div>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingGuideService);

  protected readonly configured = environment.configured;
  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  private readonly submitted = signal(false);

  protected readonly form = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
    },
    { validators: passwordMatch },
  );

  protected readonly submitLabel = computed(() => {
    switch (this.mode()) {
      case 'signup':
        return 'Create account';
      case 'reset':
        return 'Send reset link';
      case 'update':
        return 'Save new password';
      default:
        return 'Sign in';
    }
  });

  protected readonly passwordAutocomplete = computed(() =>
    this.mode() === 'signin' ? 'current-password' : 'new-password',
  );

  constructor() {
    effect(() => {
      if (this.auth.passwordRecovery()) {
        this.setMode('update');
      }
    });
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.info.set(null);
    this.submitted.set(false);
    this.form.controls.confirmPassword.reset('');

    if (mode === 'reset') {
      this.form.controls.password.clearValidators();
      this.form.controls.confirmPassword.clearValidators();
      this.form.controls.email.setValidators([Validators.required, Validators.email]);
    } else if (mode === 'update') {
      this.form.controls.email.clearValidators();
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.controls.confirmPassword.setValidators([Validators.required]);
    } else {
      this.form.controls.email.setValidators([Validators.required, Validators.email]);
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
      if (mode === 'signup') {
        this.form.controls.confirmPassword.setValidators([Validators.required]);
      } else {
        this.form.controls.confirmPassword.clearValidators();
      }
    }
    this.form.controls.email.updateValueAndValidity();
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.confirmPassword.updateValueAndValidity();
  }

  protected fieldError(name: 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || this.submitted()) || !control.errors) {
      return null;
    }
    if (control.errors['required']) {
      return 'Required';
    }
    return name === 'email' ? 'Enter a valid email address' : 'Use at least 6 characters';
  }

  protected confirmError(): string | null {
    const control = this.form.controls.confirmPassword;
    const show = control.touched || this.submitted();
    if (!show) {
      return null;
    }
    if (control.errors?.['required']) {
      return 'Required';
    }
    if (this.form.errors?.['passwordMismatch']) {
      return 'Passwords do not match';
    }
    return null;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.busy()) {
      return;
    }

    const mode = this.mode();
    if ((mode === 'signup' || mode === 'update') && this.form.errors?.['passwordMismatch']) {
      return;
    }
    if (mode !== 'update' && this.form.controls.email.invalid) {
      return;
    }
    if (mode !== 'reset' && this.form.controls.password.invalid) {
      return;
    }
    if ((mode === 'signup' || mode === 'update') && this.form.controls.confirmPassword.invalid) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const { email, password } = this.form.getRawValue();

      if (mode === 'reset') {
        const result = await this.auth.requestPasswordReset(email.trim());
        if (result.error) {
          this.error.set(result.error);
        } else {
          this.info.set('If an account exists for that email, a reset link is on the way.');
        }
        return;
      }

      if (mode === 'update') {
        const result = await this.auth.updatePassword(password);
        if (result.error) {
          this.error.set(result.error);
        } else {
          this.info.set('Password updated. You’re all set.');
          await this.goHome();
        }
        return;
      }

      if (mode === 'signin') {
        const result = await this.auth.signIn(email.trim(), password);
        if (result.error) {
          this.error.set(result.error);
        } else {
          await this.goHome();
        }
        return;
      }

      const result = await this.auth.signUp(email.trim(), password);
      if (result.error) {
        this.error.set(result.error);
      } else if (result.needsConfirmation) {
        // Pending flag survives email confirm → first sign-in still opens the guide.
        await this.onboarding.markPendingAfterSignup();
        this.info.set('Account created. Check your email to confirm your address, then sign in.');
        this.setMode('signin');
      } else {
        await this.onboarding.markPendingAfterSignup();
        await this.goHome();
      }
    } catch (e) {
      if (isChunkLoadError(e) && this.auth.isAuthenticated()) {
        recoverFromStaleChunk('/dashboard');
        return;
      }
      this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Full document navigation into the app shell.
   * Soft router loads can 404 stale Vite chunks after a rebuild while the
   * login page is still open — a hard assign always picks up the new graph.
   */
  private async goHome(): Promise<void> {
    recoverFromStaleChunk('/dashboard');
  }
}
