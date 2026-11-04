import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-2 w-full overflow-hidden rounded-full bg-border/70',
    role: 'progressbar',
    '[attr.aria-valuenow]': 'clamped()',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
  },
  template: `
    <div
      class="h-full rounded-full transition-[width] duration-500"
      [style.width.%]="clamped()"
      [style.background-color]="negative() ? 'var(--danger)' : color()"
    ></div>
  `,
})
export class UiProgress {
  /** Percentage; values above 100 are clamped for display. */
  readonly value = input(0);
  readonly color = input('var(--accent)');
  readonly negative = input(false);

  protected readonly clamped = computed(() => {
    const v = this.value();
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  });
}
