import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Styled native select; <option> children are projected as usual. */
@Component({
  selector: 'select[uiSelect]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ' +
      'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ' +
      'disabled:cursor-not-allowed disabled:opacity-50',
  },
  template: '<ng-content />',
})
export class UiSelect {}
