import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';

/**
 * Accessible modal. Near full-screen sheet on mobile, centered card from `sm`.
 * Sticky footer: body scrolls; Cancel/Add stay visible on short viewports.
 */
@Component({
  selector: 'ui-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          class="motion-fade-in absolute inset-0 cursor-default bg-overlay backdrop-blur-sm"
          aria-label="Close dialog"
          tabindex="-1"
          (click)="closed.emit()"
        ></button>
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          class="glass-panel glass-panel-strong motion-dialog-in relative z-10 flex min-h-0 w-full flex-col overflow-hidden rounded-t-2xl border shadow-md max-h-[min(96dvh,calc(100dvh-0.5rem))] sm:max-h-[90dvh] sm:rounded-2xl"
          [class]="widthClass()"
        >
          <header
            class="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4"
          >
            <div class="min-w-0">
              <h2 class="text-base font-semibold tracking-tight text-foreground">{{ title() }}</h2>
              @if (description()) {
                <p class="mt-0.5 text-xs text-muted">{{ description() }}</p>
              }
            </div>
            <button
              type="button"
              class="-mr-2 -mt-1.5 touch-target rounded-lg text-muted transition-colors hover:bg-card-hover hover:text-foreground active:scale-95 sm:-mt-1 sm:min-h-9 sm:min-w-9"
              aria-label="Close"
              (click)="closed.emit()"
            >
              <svg lucideX size="18"></svg>
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
            <ng-content />
          </div>
          <footer
            class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/70 bg-[var(--glass-bg-strong)] px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))] sm:px-5 empty:hidden"
          >
            <ng-content select="[dialogFooter]" />
          </footer>
        </div>
      </div>
    }
  `,
})
export class UiDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closed = output<void>();

  protected widthClass(): string {
    return { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl' }[this.size()];
  }

  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
