import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCalendar } from '@lucide/angular';
import { format } from 'date-fns';
import { fromIsoDate, todayIso } from '../../core/utils/dates';
import { DatePickerMode, UiDatePicker } from './ui-date-picker';

/**
 * Date / date-range field with branded picker.
 * Renders in a body-level overlay so parent dialogs (overflow/transform) cannot clip it.
 */
@Component({
  selector: 'ui-date-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiDatePicker, LucideCalendar],
  host: {
    class: 'relative block',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <button
      #trigger
      type="button"
      class="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-hover focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
      [disabled]="disabled()"
      [attr.aria-expanded]="open()"
      [attr.aria-haspopup]="'dialog'"
      (click)="toggle()"
    >
      <svg lucideCalendar size="16" class="shrink-0 text-muted"></svg>
      <span class="min-w-0 flex-1 truncate" [class.text-muted]="!hasValue()">
        {{ labelText() }}
      </span>
    </button>

    <ng-template #panel>
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="dialogTitle()"
        class="motion-scale-in w-[min(20.5rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-md"
        (pointerdown)="$event.stopPropagation()"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="font-display text-sm font-semibold">{{ dialogTitle() }}</p>
          <button type="button" class="text-xs font-medium text-primary" (click)="close()">
            Done
          </button>
        </div>
        <ui-date-picker
          #panelPicker
          [mode]="mode()"
          [value]="value()"
          [start]="start()"
          [end]="end()"
          [min]="min()"
          [max]="max()"
          (valueChange)="onSingle($event)"
          (rangeChange)="onRange($event)"
        />
      </div>
    </ng-template>
  `,
})
export class UiDateField {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);

  readonly mode = input<DatePickerMode>('single');
  readonly value = input<string | null>(null);
  readonly start = input<string | null>(null);
  readonly end = input<string | null>(null);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly placeholder = input('Pick a date');
  readonly disabled = input(false);
  readonly label = input('');

  readonly valueChange = output<string>();
  readonly rangeChange = output<{ start: string; end: string }>();

  protected readonly open = signal(false);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelTpl = viewChild.required<TemplateRef<unknown>>('panel');
  private readonly panelPicker = viewChild<UiDatePicker>('panelPicker');

  private overlayRef: OverlayRef | null = null;

  protected readonly hasValue = computed(() => {
    if (this.mode() === 'range') {
      return !!(this.start() && this.end());
    }
    return !!this.value();
  });

  protected readonly labelText = computed(() => {
    if (this.mode() === 'range') {
      const s = this.start();
      const e = this.end();
      if (s && e) {
        return `${format(fromIsoDate(s), 'd MMM yyyy')} – ${format(fromIsoDate(e), 'd MMM yyyy')}`;
      }
      if (s) {
        return `${format(fromIsoDate(s), 'd MMM yyyy')} – …`;
      }
      return this.placeholder();
    }
    const v = this.value();
    return v ? format(fromIsoDate(v), 'EEE, d MMM yyyy') : this.placeholder();
  });

  protected readonly dialogTitle = computed(
    () => this.label() || (this.mode() === 'range' ? 'Date range' : 'Pick a date'),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.teardownOverlay());
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    if (this.open()) {
      this.close();
      return;
    }
    this.openPicker();
  }

  protected close(): void {
    this.open.set(false);
    this.teardownOverlay();
  }

  protected onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  protected onSingle(iso: string): void {
    this.valueChange.emit(iso);
    this.close();
  }

  protected onRange(range: { start: string; end: string }): void {
    this.rangeChange.emit(range);
    this.close();
  }

  private openPicker(): void {
    this.teardownOverlay();
    const triggerEl = this.trigger()?.nativeElement ?? this.host.nativeElement;

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(triggerEl)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(12)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 6,
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -6,
        },
        {
          originX: 'center',
          originY: 'center',
          overlayX: 'center',
          overlayY: 'center',
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'bg-overlay/60',
      panelClass: 'myalibi-date-overlay',
    });

    this.overlayRef.attach(new TemplatePortal(this.panelTpl(), this.vcr));
    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.open.set(true);

    queueMicrotask(() => {
      const seed =
        this.mode() === 'range' ? this.start() || this.end() : this.value();
      this.panelPicker()?.showMonthFor(seed || todayIso());
    });
  }

  private teardownOverlay(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
