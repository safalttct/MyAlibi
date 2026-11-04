import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-settings-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'block' },
  template: `
    <nav class="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1" aria-label="Settings">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="bg-accent/15 text-accent"
          class="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-foreground"
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
    { path: '/settings/profile', label: 'Profile' },
    { path: '/settings/data', label: 'Data' },
  ];
}
