import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Styled native input/textarea. Works with reactive forms (`formControlName`). */
@Component({
  selector: 'input[uiInput], textarea[uiInput]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ' +
      'placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none ' +
      'focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 ' +
      'aria-[invalid=true]:border-danger',
  },
  template: '',
})
export class UiInput {}
