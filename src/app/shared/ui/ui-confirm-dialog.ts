import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiButton } from './ui-button';
import { UiDialog } from './ui-dialog';

@Component({
  selector: 'ui-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiDialog, UiButton],
  template: `
    <ui-dialog [open]="open()" [title]="title()" size="sm" (closed)="cancelled.emit()">
      <p class="text-sm text-muted">{{ message() }}</p>
      <ng-container dialogFooter>
        <button uiButton variant="ghost" type="button" (click)="cancelled.emit()">Cancel</button>
        <button
          uiButton
          type="button"
          [variant]="destructive() ? 'danger' : 'primary'"
          [loading]="loading()"
          (click)="confirmed.emit()"
        >
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class UiConfirmDialog {
  readonly open = input(false);
  readonly title = input('Are you sure?');
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly destructive = input(true);
  readonly loading = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
