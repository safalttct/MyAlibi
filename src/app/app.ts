import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
}
