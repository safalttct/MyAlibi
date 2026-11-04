import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <footer class="border-t border-border pt-3 text-center text-[11px] leading-snug text-muted">
      <p class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <span>&copy; {{ year }} MyAlibi</span>
        <span aria-hidden="true">·</span>
        <span>Developed for Tamimah Team</span>
        <span aria-hidden="true">·</span>
        <a routerLink="/settings/about" class="text-muted transition-colors hover:text-foreground hover:underline">
          About
        </a>
        <span aria-hidden="true">·</span>
        <span class="tabular-nums">v{{ version }}</span>
      </p>
    </footer>
  `,
})
export class AppFooter {
  protected readonly version = environment.version || '0.0.0';
  protected readonly year = new Date().getFullYear();
}
