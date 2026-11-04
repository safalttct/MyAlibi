import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Label + control + error wrapper for form fields. */
@Component({
  selector: 'ui-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-medium text-muted">
        {{ label() }}@if (required()) {<span class="text-danger"> *</span>}
      </span>
      <ng-content />
    </label>
    @if (error()) {
      <p class="mt-1 text-xs text-danger" role="alert">{{ error() }}</p>
    } @else if (hint()) {
      <p class="mt-1 text-xs text-muted">{{ hint() }}</p>
    }
  `,
})
export class UiField {
  readonly label = input.required<string>();
  readonly error = input<string | null>(null);
  readonly hint = input<string>('');
  readonly required = input(false);
}
