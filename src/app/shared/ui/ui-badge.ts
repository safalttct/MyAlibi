import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LeaveCategory, categoryMeta } from '../../core/models/leave.models';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-card-hover text-muted border-border',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  info: 'bg-accent/15 text-accent border-accent/30',
};

@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (category()) {
      <span class="size-1.5 rounded-full" [class]="dot()"></span>
    }
    <ng-content />
  `,
})
export class UiBadge {
  readonly tone = input<BadgeTone>('neutral');
  /** When set, colors the badge with the category palette. */
  readonly category = input<LeaveCategory | null>(null);

  protected readonly dot = computed(() => {
    const c = this.category();
    return c ? categoryMeta(c).dotClass : '';
  });

  protected readonly classes = computed(() => {
    const c = this.category();
    const palette = c
      ? `${categoryMeta(c).softBgClass} ${categoryMeta(c).textClass} ${categoryMeta(c).borderClass}`
      : TONES[this.tone()];
    return `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${palette}`;
  });
}
