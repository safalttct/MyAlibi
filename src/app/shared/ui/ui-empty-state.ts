import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center',
  },
  template: `
    <div class="text-muted"><ng-content select="[emptyIcon]" /></div>
    <h3 class="text-sm font-semibold text-foreground">{{ title() }}</h3>
    @if (description()) {
      <p class="max-w-sm text-xs text-muted">{{ description() }}</p>
    }
    <div class="mt-2"><ng-content /></div>
  `,
})
export class UiEmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
