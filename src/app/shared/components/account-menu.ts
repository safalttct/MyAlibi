import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideDatabase,
  LucideLogOut,
  LucideMoon,
  LucideSettings,
  LucideSun,
  LucideTimer,
  LucideUserRound,
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UiDialog } from '../ui/ui-dialog';

/**
 * Mobile-first account / “More” sheet: Comp Off, Settings, theme, sign out.
 */
@Component({
  selector: 'app-account-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiDialog,
    LucideTimer,
    LucideSettings,
    LucideDatabase,
    LucideUserRound,
    LucideSun,
    LucideMoon,
    LucideLogOut,
  ],
  template: `
    <ui-dialog
      [open]="open()"
      title="Account"
      [description]="auth.user()?.email ?? 'Signed in'"
      size="sm"
      (closed)="closed.emit()"
    >
      <div class="grid gap-1">
        <a
          routerLink="/comp-off"
          class="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          (click)="closed.emit()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-comp/15 text-comp">
            <svg lucideTimer size="18" strokeWidth="1.75"></svg>
          </span>
          Comp Off
        </a>
        <a
          routerLink="/settings/allocations"
          class="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          (click)="closed.emit()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <svg lucideSettings size="18" strokeWidth="1.75"></svg>
          </span>
          Allocations
        </a>
        <a
          routerLink="/settings/profile"
          class="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          (click)="closed.emit()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <svg lucideUserRound size="18" strokeWidth="1.75"></svg>
          </span>
          Profile
        </a>
        <a
          routerLink="/settings/data"
          class="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          (click)="closed.emit()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <svg lucideDatabase size="18" strokeWidth="1.75"></svg>
          </span>
          Data &amp; import
        </a>
      </div>

      <div class="mt-3 grid gap-1 border-t border-border pt-3">
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          (click)="theme.toggle()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
            @if (theme.theme() === 'dark') {
              <svg lucideSun size="18"></svg>
            } @else {
              <svg lucideMoon size="18"></svg>
            }
          </span>
          {{ theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }}
        </button>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          (click)="signOut()"
        >
          <span class="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <svg lucideLogOut size="18"></svg>
          </span>
          Sign out
        </button>
      </div>
    </ui-dialog>
  `,
})
export class AccountMenu {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected async signOut(): Promise<void> {
    this.closed.emit();
    await this.auth.signOut();
  }
}
