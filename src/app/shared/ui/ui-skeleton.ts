import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block animate-pulse rounded-md bg-border/70',
    'aria-hidden': 'true',
  },
  template: '',
})
export class UiSkeleton {}
