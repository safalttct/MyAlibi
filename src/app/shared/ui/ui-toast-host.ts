import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideX } from '@lucide/angular';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'ui-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideX],
  host: {
    class:
      'pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4',
    'aria-live': 'polite',
  },
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div
        class="motion-scale-in pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-xl"
        role="status"
      >
        @switch (toast.kind) {
          @case ('success') {
            <svg lucideCircleCheck size="18" class="mt-0.5 shrink-0 text-success"></svg>
          }
          @case ('error') {
            <svg lucideCircleAlert size="18" class="mt-0.5 shrink-0 text-danger"></svg>
          }
          @default {
            <svg lucideInfo size="18" class="mt-0.5 shrink-0 text-accent"></svg>
          }
        }
        <p class="min-w-0 flex-1 text-foreground">{{ toast.message }}</p>
        @if (toast.action; as action) {
          <button
            type="button"
            class="shrink-0 text-xs font-semibold text-primary transition-colors hover:underline active:scale-95"
            (click)="runAction(toast.id, action.run)"
          >
            {{ action.label }}
          </button>
        }
        <button
          type="button"
          class="shrink-0 text-muted transition-colors hover:text-foreground active:scale-95"
          aria-label="Dismiss"
          (click)="toasts.dismiss(toast.id)"
        >
          <svg lucideX size="16"></svg>
        </button>
      </div>
    }
  `,
})
export class UiToastHost {
  protected readonly toasts = inject(ToastService);

  protected runAction(id: number, run: () => void | Promise<void>): void {
    this.toasts.dismiss(id);
    void Promise.resolve(run());
  }
}
