import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <footer class="border-t border-border pt-3 text-center text-[11px] leading-snug text-muted">
      <p class="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <span>&copy; {{ year }} MyAlibi</span>
        <span aria-hidden="true">·</span>
        <span>Developed for Tamimah team</span>
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
