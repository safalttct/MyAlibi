import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { pageview } from '@vercel/analytics';
import { filter } from 'rxjs/operators';
import { PwaInstallService } from './core/services/pwa-install.service';
import { ThemeService } from './core/services/theme.service';
import { UiToastHost } from './shared/ui/ui-toast-host';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, UiToastHost],
  templateUrl: './app.html',
})
export class App {
  /** Instantiated eagerly so the persisted theme is applied on startup. */
  protected readonly theme = inject(ThemeService);
  /** Listen for install prompts as soon as the shell boots. */
  protected readonly pwa = inject(PwaInstallService);

  constructor() {
    const router = inject(Router);
    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        pageview({ path: e.urlAfterRedirects });
      });
  }
}
