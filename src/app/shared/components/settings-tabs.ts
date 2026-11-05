import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-settings-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'block min-w-0 max-w-full overflow-hidden' },
  template: `
    <nav
      class="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-1 [&::-webkit-scrollbar]:hidden"
      aria-label="Settings"
    >
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="bg-primary-soft text-primary"
          class="flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:min-h-10 sm:flex-none"
        >
          {{ tab.label }}
        </a>
      }
    </nav>
  `,
})
export class SettingsTabs {
  protected readonly tabs = [
    { path: '/settings/allocations', label: 'Allocations' },
    { path: '/settings/share', label: 'Share to HR' },
    { path: '/settings/profile', label: 'Profile' },
    { path: '/settings/data', label: 'Data' },
    { path: '/settings/about', label: 'About' },
  ];
}
