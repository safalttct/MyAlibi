import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';

/** Simple accessible modal: backdrop, Escape to close, scrollable body, footer slot. */
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
          class="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
          aria-label="Close dialog"
          tabindex="-1"
          (click)="closed.emit()"
        ></button>
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          class="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
          [class]="widthClass()"
        >
          <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 class="text-base font-semibold text-foreground">{{ title() }}</h2>
              @if (description()) {
                <p class="mt-0.5 text-xs text-muted">{{ description() }}</p>
              }
            </div>
            <button
              type="button"
              class="rounded-md p-1 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
              aria-label="Close"
              (click)="closed.emit()"
            >
              <svg lucideX size="18"></svg>
            </button>
          </header>
          <div class="overflow-y-auto px-5 py-4"><ng-content /></div>
          <footer class="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3 empty:hidden">
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
    return { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[this.size()];
  }

  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
