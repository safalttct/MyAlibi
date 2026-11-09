import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideLightbulb, LucideX } from '@lucide/angular';
import { CoachTipId, CoachTipsService } from '../../core/services/coach-tips.service';

@Component({
  selector: 'ui-coach-tip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideLightbulb, LucideX],
  template: `
    @if (visible()) {
      <aside
        class="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary-soft/80 px-3 py-2.5 text-sm text-foreground"
        role="status"
      >
        <span class="mt-0.5 shrink-0 text-primary" aria-hidden="true">
          <svg lucideLightbulb size="16" strokeWidth="1.75"></svg>
        </span>
        <div class="min-w-0 flex-1">
          @if (title()) {
            <p class="font-medium text-foreground">{{ title() }}</p>
          }
          <p [class]="title() ? 'mt-0.5 text-xs text-muted' : 'text-xs text-muted sm:text-sm'">
            {{ message() }}
          </p>
          <div class="mt-2 empty:hidden"><ng-content /></div>
        </div>
        <button
          type="button"
          class="-mr-1 -mt-0.5 touch-target shrink-0 rounded-lg text-muted transition-colors hover:bg-card-hover hover:text-foreground sm:min-h-8 sm:min-w-8"
          [attr.aria-label]="dismissLabel()"
          (click)="onDismiss()"
        >
          <svg lucideX size="14"></svg>
        </button>
      </aside>
    }
  `,
})
export class UiCoachTip {
  private readonly coach = inject(CoachTipsService);

  /** Stable id — once dismissed, tip stays hidden on this device. */
  readonly tipId = input.required<CoachTipId>();
  readonly message = input.required<string>();
  readonly title = input('');
  readonly dismissLabel = input('Dismiss tip');
  /** Extra gate (e.g. only on mobile / only when condition holds). */
  readonly when = input(true);

  readonly dismissed = output<void>();

  protected readonly visible = computed(
    () => this.when() && this.coach.isVisible(this.tipId()),
  );

  protected onDismiss(): void {
    this.coach.dismiss(this.tipId());
    this.dismissed.emit();
  }
}
