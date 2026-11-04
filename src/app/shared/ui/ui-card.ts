import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (title()) {
      <header class="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h3 class="text-sm font-semibold text-foreground">{{ title() }}</h3>
          @if (description()) {
            <p class="mt-0.5 text-xs text-muted">{{ description() }}</p>
          }
        </div>
        <ng-content select="[cardActions]" />
      </header>
    }
    <div [class]="bodyClass()"><ng-content /></div>
  `,
})
export class UiCard {
  readonly title = input<string>('');
  readonly description = input<string>('');
  readonly padded = input(true);
  readonly interactive = input(false);

  protected readonly classes = computed(
    () =>
      'block rounded-xl border border-border bg-card text-foreground shadow-sm ' +
      (this.interactive() ? 'transition-colors hover:bg-card-hover' : ''),
  );

  protected readonly bodyClass = computed(() =>
    this.padded() ? (this.title() ? 'p-5 pt-4' : 'p-5') : '',
  );
}
