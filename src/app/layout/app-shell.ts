import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendar,
  LucideChartColumn,
  LucideEllipsis,
  LucideLayoutDashboard,
  LucideListChecks,
  LucideLogOut,
  LucideMoon,
  LucideSettings,
  LucideSun,
  LucideTimer,
  LucideUserRound,
} from '@lucide/angular';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';
import { CategoryPreferencesService } from '../core/services/category-preferences.service';
import { FiscalYearService } from '../core/services/fiscal-year.service';
import { OnboardingGuideService } from '../core/services/onboarding-guide.service';
import { ThemeService } from '../core/services/theme.service';
import { ToastService } from '../core/services/toast.service';
import { AccountMenu } from '../shared/components/account-menu';
import { AppFooter } from '../shared/components/app-footer';
import { AppLogo } from '../shared/components/app-logo';
import { OnboardingGuide } from '../shared/components/onboarding-guide';

interface NavItem {
  path: string;
  label: string;
  short: string;
  icon: 'dashboard' | 'records' | 'calendar' | 'analytics' | 'compoff' | 'settings';
  mobile?: boolean;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AppLogo,
    AppFooter,
    AccountMenu,
    OnboardingGuide,
    LucideLayoutDashboard,
    LucideListChecks,
    LucideCalendar,
    LucideChartColumn,
    LucideTimer,
    LucideSettings,
    LucideSun,
    LucideMoon,
    LucideLogOut,
    LucideUserRound,
    LucideEllipsis,
  ],
  template: `
    <div class="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <!-- Desktop sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg-strong)] shadow-sm backdrop-blur-xl backdrop-saturate-150 md:flex"
        aria-label="Application"
      >
        <div class="flex h-[4.25rem] items-center px-5">
          <a routerLink="/dashboard" class="outline-none" aria-label="MyAlibi home">
            <app-logo size="md" />
          </a>
        </div>

        <nav class="flex flex-1 flex-col gap-0.5 px-3 pb-3" aria-label="Primary">
          @for (item of primaryNav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="nav-active"
              [routerLinkActiveOptions]="item.path === '/settings' ? { exact: false } : { exact: true }"
              class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:bg-surface-hover/80 hover:text-foreground"
            >
              <span class="text-current opacity-80 group-[.nav-active]:opacity-100">
                @switch (item.icon) {
                  @case ('dashboard') { <svg lucideLayoutDashboard size="18" strokeWidth="1.75"></svg> }
                  @case ('records') { <svg lucideListChecks size="18" strokeWidth="1.75"></svg> }
                  @case ('calendar') { <svg lucideCalendar size="18" strokeWidth="1.75"></svg> }
                  @case ('analytics') { <svg lucideChartColumn size="18" strokeWidth="1.75"></svg> }
                  @case ('compoff') { <svg lucideTimer size="18" strokeWidth="1.75"></svg> }
                  @case ('settings') { <svg lucideSettings size="18" strokeWidth="1.75"></svg> }
                }
              </span>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="space-y-2 border-t border-border/60 p-3">
          <div class="flex items-center gap-2 rounded-lg border border-border/50 bg-primary-soft/60 px-2.5 py-2">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <svg lucideUserRound size="16"></svg>
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-foreground" [title]="auth.user()?.email ?? ''">
                {{ auth.user()?.email }}
              </p>
              <p class="text-[11px] text-muted-foreground">Signed in</p>
            </div>
          </div>
          <button
            type="button"
            class="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            (click)="theme.toggle()"
          >
            @if (theme.theme() === 'dark') {
              <svg lucideSun size="16"></svg>
              Light mode
            } @else {
              <svg lucideMoon size="16"></svg>
              Dark mode
            }
          </button>
          <button
            type="button"
            class="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            (click)="auth.signOut()"
          >
            <svg lucideLogOut size="16"></svg>
            Sign out
          </button>
        </div>
      </aside>

      <!-- Mobile top bar -->
      <header
        class="glass-chrome sticky top-0 z-30 flex h-14 items-center justify-between border-b px-3 md:hidden"
        [class.glass-chrome-scrolled]="headerScrolled()"
      >
        <a routerLink="/dashboard" class="min-w-0 outline-none" aria-label="MyAlibi home">
          <app-logo size="md" />
        </a>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="touch-target rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:scale-95"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            (click)="theme.toggle()"
          >
            @if (theme.theme() === 'dark') {
              <svg lucideSun size="18"></svg>
            } @else {
              <svg lucideMoon size="18"></svg>
            }
          </button>
          <button
            type="button"
            class="touch-target rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:scale-95"
            aria-label="Account menu"
            (click)="moreOpen.set(true)"
          >
            <svg lucideUserRound size="18" strokeWidth="1.75"></svg>
          </button>
        </div>
      </header>

      <main class="surface-ambient md:ml-60 md:min-h-dvh">
        <div
          class="page-shell safe-pb-nav flex min-h-0 flex-col px-4 pt-5 sm:px-6 md:min-h-dvh md:px-8 md:pt-8 md:pb-8"
        >
          <div class="min-w-0 flex-1">
            <router-outlet />
          </div>
          <app-footer class="mt-4 shrink-0 md:mt-6" />
        </div>
      </main>

      <!-- Mobile bottom navigation -->
      <nav
        class="glass-chrome fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
        style="padding-bottom: var(--safe-bottom)"
        aria-label="Primary mobile"
      >
        <div class="grid h-16 grid-cols-5">
          @for (item of mobileNav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="text-primary"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground transition-[color,background-color,transform] duration-200 active:scale-95"
              [class.bg-primary-soft]="rla.isActive"
            >
              @switch (item.icon) {
                @case ('dashboard') { <svg lucideLayoutDashboard size="20" strokeWidth="1.75"></svg> }
                @case ('records') { <svg lucideListChecks size="20" strokeWidth="1.75"></svg> }
                @case ('calendar') { <svg lucideCalendar size="20" strokeWidth="1.75"></svg> }
                @case ('compoff') { <svg lucideTimer size="20" strokeWidth="1.75"></svg> }
              }
              <span>{{ item.short }}</span>
            </a>
          }
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-[color,background-color,transform] duration-200 active:scale-95"
            [class]="moreActive() || moreOpen() ? 'bg-primary-soft text-primary' : 'text-muted-foreground'"
            aria-label="More menu"
            [attr.aria-expanded]="moreOpen()"
            (click)="moreOpen.set(true)"
          >
            <svg lucideEllipsis size="20" strokeWidth="1.75"></svg>
            <span>More</span>
          </button>
        </div>
      </nav>

      <app-account-menu [open]="moreOpen()" (closed)="moreOpen.set(false)" />
      <app-onboarding-guide />
    </div>
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoryPrefs = inject(CategoryPreferencesService);
  private readonly fiscalYear = inject(FiscalYearService);
  private readonly onboarding = inject(OnboardingGuideService);
  private readonly toast = inject(ToastService);

  protected readonly moreOpen = signal(false);
  protected readonly moreActive = signal(false);
  protected readonly headerScrolled = signal(false);

  protected readonly primaryNav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', short: 'Home', icon: 'dashboard', mobile: true },
    { path: '/records', label: 'Records', short: 'Records', icon: 'records', mobile: true },
    { path: '/calendar', label: 'Calendar', short: 'Calendar', icon: 'calendar', mobile: true },
    { path: '/comp-off', label: 'Comp Off', short: 'Comp', icon: 'compoff', mobile: true },
    { path: '/analytics', label: 'Analytics', short: 'Stats', icon: 'analytics' },
    { path: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' },
  ];

  protected readonly mobileNav = this.primaryNav.filter((n) => n.mobile);

  constructor() {
    void this.bootstrapApp();
    this.syncMoreActive(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.syncMoreActive(e.urlAfterRedirects));

    const onScroll = () => this.headerScrolled.set(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  }

  private async bootstrapApp(): Promise<void> {
    await this.categoryPrefs.ensureLoaded();
    const result = await this.fiscalYear.ensureCurrentFiscalYear();
    if (result?.created) {
      const label = this.fiscalYear.currentLabel();
      this.toast.success(
        result.firstSeed
          ? `Started ${label} with team defaults`
          : `Started ${label} — entitlements rolled over`,
      );
    }
    await this.onboarding.ensureLoaded();
  }

  private syncMoreActive(url: string): void {
    this.moreActive.set(url.startsWith('/analytics') || url.startsWith('/settings'));
  }
}
