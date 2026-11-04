import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4',
  },
  template: `
    <div class="min-w-0">
      <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-[1.375rem]">
        {{ title() }}
      </h1>
      @if (subtitle()) {
        <p class="mt-1 text-sm text-muted">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex flex-wrap items-center gap-2"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
