import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AppLogo } from '../../shared/components/app-logo';
import { AuthService } from '../../core/services/auth.service';
import { UiButton } from '../../shared/ui/ui-button';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';

type Mode = 'signin' | 'signup';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppLogo, UiButton, UiField, UiInput],
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-background px-4 py-10 pb-[max(2.5rem,var(--safe-bottom))]">
      @if (!configured) {
        <section class="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <div class="mb-5 flex justify-center"><app-logo size="lg" /></div>
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
          <div class="mb-7 flex flex-col items-center gap-3 text-center">
            <app-logo size="lg" />
            <p class="text-sm text-muted">Your personal leave &amp; WFH tracker</p>
          </div>

          <div class="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div class="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1 text-sm font-medium" role="tablist">
              <button type="button" role="tab" [attr.aria-selected]="mode() === 'signin'"
                class="min-h-10 rounded-lg transition-colors"
                [class]="mode() === 'signin' ? 'bg-primary-soft text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                (click)="setMode('signin')">Sign in</button>
              <button type="button" role="tab" [attr.aria-selected]="mode() === 'signup'"
                class="min-h-10 rounded-lg transition-colors"
                [class]="mode() === 'signup' ? 'bg-primary-soft text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                (click)="setMode('signup')">Create account</button>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4" novalidate>
              <ui-field label="Email" [error]="fieldError('email')">
                <input uiInput type="email" formControlName="email" autocomplete="email" inputmode="email" placeholder="you@example.com" />
              </ui-field>
              <ui-field label="Password" [error]="fieldError('password')">
                <input uiInput type="password" formControlName="password"
                  [attr.autocomplete]="mode() === 'signin' ? 'current-password' : 'new-password'"
                  placeholder="At least 6 characters" />
              </ui-field>

              @if (error()) {
                <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
              }
              @if (info()) {
                <p class="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success" role="status">{{ info() }}</p>
              }

              <button uiButton type="submit" size="lg" class="mt-1 w-full" [loading]="busy()">
                {{ mode() === 'signin' ? 'Sign in' : 'Create account' }}
              </button>
            </form>
          </div>
        </section>
      }
    </div>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly configured = environment.configured;
  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  private readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.info.set(null);
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

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      const result =
        this.mode() === 'signin'
          ? await this.auth.signIn(email.trim(), password)
          : await this.auth.signUp(email.trim(), password);
      if (result.error) {
        this.error.set(result.error);
      } else if (result.needsConfirmation) {
        this.info.set('Account created. Check your email to confirm your address, then sign in.');
        this.mode.set('signin');
      } else {
        await this.router.navigate(['/dashboard']);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
