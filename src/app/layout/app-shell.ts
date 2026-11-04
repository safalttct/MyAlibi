import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendar,
  LucideChartColumn,
  LucideLayoutDashboard,
  LucideListChecks,
  LucideLogOut,
  LucideMoon,
  LucideSettings,
  LucideSun,
  LucideTimer,
  LucideUserRound,
} from '@lucide/angular';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { AppLogo } from '../shared/components/app-logo';

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
  ],
  template: `
    <div class="min-h-dvh bg-background text-foreground">
      <!-- Desktop sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface md:flex"
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
              routerLinkActive="bg-primary-soft text-primary"
              [routerLinkActiveOptions]="item.path === '/settings' ? { exact: false } : { exact: true }"
              class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <span class="text-current opacity-80 group-[.bg-primary-soft]:opacity-100">
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

        <div class="space-y-2 border-t border-border p-3">
          <div class="flex items-center gap-2 rounded-lg bg-primary-soft/80 px-2.5 py-2">
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
          <div class="flex gap-1">
            <button
              type="button"
              class="touch-target flex-1 rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
              (click)="theme.toggle()"
            >
              @if (theme.theme() === 'dark') {
                <svg lucideSun size="16"></svg>
              } @else {
                <svg lucideMoon size="16"></svg>
              }
            </button>
            <button
              type="button"
              class="touch-target flex-1 rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              aria-label="Sign out"
              (click)="auth.signOut()"
            >
              <svg lucideLogOut size="16"></svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Mobile top bar -->
      <header
        class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md md:hidden"
      >
        <a routerLink="/dashboard" class="outline-none" aria-label="MyAlibi home">
          <app-logo size="md" />
        </a>
        <div class="flex items-center gap-0.5">
          <a
            routerLink="/settings/profile"
            class="touch-target rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            aria-label="Profile and settings"
          >
            <svg lucideSettings size="18" strokeWidth="1.75"></svg>
          </a>
          <button
            type="button"
            class="touch-target rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            (click)="theme.toggle()"
          >
            @if (theme.theme() === 'dark') {
              <svg lucideSun size="18"></svg>
            } @else {
              <svg lucideMoon size="18"></svg>
            }
          </button>
        </div>
      </header>

      <main class="md:ml-60">
        <div class="page-shell safe-pb-nav px-4 pt-5 sm:px-6 md:px-8 md:pt-8 md:pb-10">
          <router-outlet />
        </div>
      </main>

      <!-- Mobile bottom navigation -->
      <nav
        class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
        style="padding-bottom: var(--safe-bottom)"
        aria-label="Primary mobile"
      >
        <div class="grid h-16 grid-cols-4">
          @for (item of mobileNav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="text-primary"
              class="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors"
            >
              @switch (item.icon) {
                @case ('dashboard') { <svg lucideLayoutDashboard size="20" strokeWidth="1.75"></svg> }
                @case ('records') { <svg lucideListChecks size="20" strokeWidth="1.75"></svg> }
                @case ('calendar') { <svg lucideCalendar size="20" strokeWidth="1.75"></svg> }
                @case ('analytics') { <svg lucideChartColumn size="20" strokeWidth="1.75"></svg> }
              }
              <span>{{ item.short }}</span>
            </a>
          }
        </div>
      </nav>
    </div>
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly primaryNav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', short: 'Home', icon: 'dashboard', mobile: true },
    { path: '/records', label: 'Records', short: 'Records', icon: 'records', mobile: true },
    { path: '/calendar', label: 'Calendar', short: 'Calendar', icon: 'calendar', mobile: true },
    { path: '/analytics', label: 'Analytics', short: 'Analytics', icon: 'analytics', mobile: true },
    { path: '/comp-off', label: 'Comp Off', short: 'Comp', icon: 'compoff' },
    { path: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' },
  ];

  protected readonly mobileNav = this.primaryNav.filter((n) => n.mobile);
}
