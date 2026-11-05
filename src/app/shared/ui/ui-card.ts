import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (title()) {
      <header class="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold tracking-tight text-foreground">{{ title() }}</h3>
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
      'block rounded-xl border border-border bg-card text-foreground ' +
      'shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out ' +
      (this.interactive()
        ? 'hover:-translate-y-0.5 hover:bg-card-hover hover:shadow-md active:translate-y-0'
        : ''),
  );

  protected readonly bodyClass = computed(() =>
    this.padded() ? (this.title() ? 'p-4 pt-3 sm:p-5 sm:pt-4' : 'p-4 sm:p-5') : '',
  );
}
