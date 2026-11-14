import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideChevronDown, LucideDownload, LucideFileText } from '@lucide/angular';
import { UiButton } from '../ui/ui-button';

export type ExportMenuFormat = 'csv' | 'pdf';

/**
 * Single Export control with CSV / PDF dropdown.
 * Used on Records and Settings → Data.
 */
@Component({
  selector: 'app-export-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, LucideDownload, LucideFileText, LucideChevronDown],
  host: {
    '[class]':
      "'relative inline-flex ' + (open() ? 'z-50' : 'z-auto')",
  },
  template: `
    <button
      uiButton
      [variant]="variant()"
      [size]="size()"
      type="button"
      class="w-full sm:w-auto"
      [disabled]="disabled()"
      [loading]="loading()"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
      (click)="toggle($event)"
    >
      <svg lucideDownload size="14"></svg> {{ label() }}
      <svg lucideChevronDown size="14" class="opacity-70"></svg>
    </button>
    @if (open()) {
      <div
        role="menu"
        class="absolute top-full right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-md"
        (click)="$event.stopPropagation()"
        (keydown)="onMenuKey($event)"
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none"
          (click)="pick('csv')"
        >
          <svg lucideFileText size="14" class="text-muted"></svg> CSV
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none"
          (click)="pick('pdf')"
        >
          <svg lucideDownload size="14" class="text-muted"></svg> PDF
        </button>
      </div>
    }
  `,
})
export class ExportMenu {
  readonly label = input('Export');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly variant = input<'outline' | 'secondary' | 'ghost'>('outline');
  readonly size = input<'sm' | 'md'>('sm');

  readonly selected = output<ExportMenuFormat>();

  protected readonly open = signal(false);

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.open.update((v) => !v);
  }

  protected pick(format: ExportMenuFormat): void {
    this.open.set(false);
    this.selected.emit(format);
  }

  protected onMenuKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.open.set(false);
    }
  }
}
