import { NgTemplateOutlet } from '@angular/common';
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
} from '@lucide/angular';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

interface NavItem {
  path: string;
  label: string;
  icon: 'dashboard' | 'records' | 'calendar' | 'analytics' | 'compoff' | 'settings';
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideLayoutDashboard,
    LucideListChecks,
    LucideCalendar,
    LucideChartColumn,
    LucideTimer,
    LucideSettings,
    LucideSun,
    LucideMoon,
    LucideLogOut,
  ],
  template: `
    <ng-template #navIcon let-name let-size="size">
      @switch (name) {
        @case ('dashboard') { <svg lucideLayoutDashboard [size]="size"></svg> }
        @case ('records') { <svg lucideListChecks [size]="size"></svg> }
        @case ('calendar') { <svg lucideCalendar [size]="size"></svg> }
        @case ('analytics') { <svg lucideChartColumn [size]="size"></svg> }
        @case ('compoff') { <svg lucideTimer [size]="size"></svg> }
        @case ('settings') { <svg lucideSettings [size]="size"></svg> }
      }
    </ng-template>

    <div class="min-h-dvh bg-background text-foreground">
      <!-- Desktop sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar md:flex"
      >
        <div class="flex items-center gap-2.5 px-5 py-5">
          <span class="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">M</span>
          <span class="text-base font-semibold tracking-tight">MyAlibi</span>
        </div>

        <nav class="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-accent/15 text-accent"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            >
              <ng-container *ngTemplateOutlet="navIcon; context: { $implicit: item.icon, size: 18 }" />
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="flex items-center justify-between gap-2 border-t border-border p-3">
          <p class="truncate text-xs text-muted" [title]="auth.user()?.email ?? ''">
            {{ auth.user()?.email }}
          </p>
          <div class="flex shrink-0 gap-1">
            <button type="button" class="rounded-md p-2 text-muted hover:bg-card-hover hover:text-foreground"
              [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
              (click)="theme.toggle()">
              @if (theme.theme() === 'dark') { <svg lucideSun size="16"></svg> } @else { <svg lucideMoon size="16"></svg> }
            </button>
            <button type="button" class="rounded-md p-2 text-muted hover:bg-card-hover hover:text-foreground"
              aria-label="Sign out" (click)="auth.signOut()">
              <svg lucideLogOut size="16"></svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Mobile top bar -->
      <header
        class="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden"
      >
        <div class="flex items-center gap-2">
          <span class="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-foreground">M</span>
          <span class="font-semibold tracking-tight">MyAlibi</span>
        </div>
        <div class="flex gap-1">
          <button type="button" class="rounded-md p-2 text-muted hover:bg-card-hover"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            (click)="theme.toggle()">
            @if (theme.theme() === 'dark') { <svg lucideSun size="18"></svg> } @else { <svg lucideMoon size="18"></svg> }
          </button>
          <button type="button" class="rounded-md p-2 text-muted hover:bg-card-hover" aria-label="Sign out"
            (click)="auth.signOut()">
            <svg lucideLogOut size="18"></svg>
          </button>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 md:ml-60 md:max-w-none md:px-8 md:pt-8 md:pb-10">
        <div class="mx-auto max-w-6xl"><router-outlet /></div>
      </main>

      <!-- Mobile bottom nav -->
      <nav
        class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-sidebar/95 backdrop-blur md:hidden"
        aria-label="Primary mobile"
      >
        @for (item of nav; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="text-accent"
            class="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-muted"
          >
            <ng-container *ngTemplateOutlet="navIcon; context: { $implicit: item.icon, size: 20 }" />
            {{ item.label }}
          </a>
        }
      </nav>
    </div>
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly nav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/records', label: 'Records', icon: 'records' },
    { path: '/calendar', label: 'Calendar', icon: 'calendar' },
    { path: '/analytics', label: 'Analytics', icon: 'analytics' },
    { path: '/comp-off', label: 'Comp Off', icon: 'compoff' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
}
