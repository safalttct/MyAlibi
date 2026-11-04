import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4',
  },
  template: `
    <div class="min-w-0">
      @if (eyebrow()) {
        <p class="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{{ eyebrow() }}</p>
      }
      <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-[1.375rem]">
        {{ title() }}
      </h1>
      @if (subtitle()) {
        <p class="mt-1 text-sm text-muted">{{ subtitle() }}</p>
      }
    </div>
    <div
      class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>button]:max-sm:flex-1 [&>a]:max-sm:flex-1"
    >
      <ng-content />
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Optional section label above the H1 (e.g. “Settings”). */
  readonly eyebrow = input<string>('');
}
