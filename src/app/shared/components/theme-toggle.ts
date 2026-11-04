import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideSun, LucideMoon],
  template: `
    <button
      type="button"
      class="inline-flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      [class]="size() === 'sm' ? 'size-9' : 'size-10'"
      [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      (click)="theme.toggle()"
    >
      @if (theme.theme() === 'dark') {
        <svg lucideSun [size]="iconSize()"></svg>
      } @else {
        <svg lucideMoon [size]="iconSize()"></svg>
      }
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  readonly size = input<'sm' | 'md'>('md');

  protected iconSize(): number {
    return this.size() === 'sm' ? 16 : 18;
  }
}
