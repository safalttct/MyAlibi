import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { addMonths, format, startOfMonth } from 'date-fns';
import { holidaysOn } from '../../core/data/public-holidays';
import { WEEKDAYS_MON_FIRST, buildMonthGrid } from '../../core/utils/calendar-grid';
import {
  applyRangeClick,
  clampIso,
  isInRange,
  isRangeEndpoint,
} from '../../core/utils/date-range-selection';
import { fromIsoDate, todayIso } from '../../core/utils/dates';

export type DatePickerMode = 'single' | 'range';

/** Month grid used inside date fields (single or range). */
@Component({
  selector: 'ui-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronLeft, LucideChevronRight],
  host: { class: 'block' },
  template: `
    <div class="select-none">
      <div class="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          class="touch-target rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Previous month"
          (click)="shiftMonth(-1)"
        >
          <svg lucideChevronLeft size="18"></svg>
        </button>
        <p class="font-display text-sm font-semibold tracking-tight">{{ monthLabel() }}</p>
        <button
          type="button"
          class="touch-target rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Next month"
          (click)="shiftMonth(1)"
        >
          <svg lucideChevronRight size="18"></svg>
        </button>
      </div>

      <div class="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted">
        @for (d of weekdays; track d) {
          <span class="py-1">{{ d }}</span>
        }
      </div>

      <div class="mt-0.5 grid grid-cols-7 gap-0.5" role="grid" [attr.aria-label]="monthLabel()">
        @for (day of days(); track day.iso) {
          <button
            type="button"
            role="gridcell"
            class="relative flex h-10 flex-col items-center justify-center rounded-lg text-xs tabular-nums transition-colors"
            [disabled]="day.disabled"
            [attr.aria-selected]="day.selected || day.endpoint"
            [attr.aria-label]="day.aria"
            [class]="day.cellClass"
            (click)="pick(day.iso, day.disabled)"
          >
            {{ day.date.getDate() }}
            @if (day.holiday) {
              <span class="absolute bottom-1 size-1 rounded-full bg-holiday" aria-hidden="true"></span>
            }
          </button>
        }
      </div>

      @if (mode() === 'range' && rangeHint()) {
        <p class="mt-3 text-center text-[11px] text-muted">{{ rangeHint() }}</p>
      }
    </div>
  `,
})
export class UiDatePicker {
  readonly mode = input<DatePickerMode>('single');
  readonly value = input<string | null>(null);
  readonly start = input<string | null>(null);
  readonly end = input<string | null>(null);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);

  readonly valueChange = output<string>();
  readonly rangeChange = output<{ start: string; end: string }>();

  protected readonly weekdays = WEEKDAYS_MON_FIRST;
  private readonly viewMonth = signal(startOfMonth(new Date()));

  /** Pending range start while waiting for end click. */
  private readonly pendingStart = signal<string | null>(null);

  protected readonly monthLabel = computed(() => format(this.viewMonth(), 'MMMM yyyy'));

  protected readonly rangeHint = computed(() => {
    if (this.mode() !== 'range') {
      return null;
    }
    const pending = this.pendingStart();
    if (pending) {
      return `Start ${format(fromIsoDate(pending), 'd MMM')} — pick end date`;
    }
    const s = this.start();
    const e = this.end();
    if (s && e) {
      return `${format(fromIsoDate(s), 'd MMM')} – ${format(fromIsoDate(e), 'd MMM')}`;
    }
    return 'Pick a start date';
  });

  protected readonly days = computed(() => {
    const mode = this.mode();
    const selected = this.value();
    const start = this.start();
    const end = this.end();
    const pending = this.pendingStart();
    const rangeStart = pending ?? start;
    const rangeEnd = pending ? null : end;
    const min = this.min();
    const max = this.max();
    const today = todayIso();

    return buildMonthGrid(this.viewMonth()).map((day) => {
      const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
      const holiday = holidaysOn(day.iso).length > 0;
      const disabled =
        !day.inMonth ||
        (!!min && day.iso < min) ||
        (!!max && day.iso > max);

      const endpoint =
        mode === 'single'
          ? day.iso === selected
          : isRangeEndpoint(day.iso, rangeStart, rangeEnd ?? pending);
      const inRange =
        mode === 'range' && isInRange(day.iso, rangeStart, rangeEnd);
      const isToday = day.iso === today;

      const parts: string[] = [];
      if (disabled) {
        parts.push('opacity-30 cursor-not-allowed');
      } else {
        parts.push('hover:bg-surface-hover');
      }
      if (!day.inMonth) {
        parts.push('text-muted/40');
      } else if (weekend || holiday) {
        parts.push('text-muted');
      } else {
        parts.push('text-foreground');
      }
      if (inRange && !endpoint) {
        parts.push('bg-primary-soft');
      }
      if (endpoint) {
        parts.push('bg-primary text-primary-foreground font-semibold hover:bg-primary');
      } else if (isToday) {
        parts.push('ring-1 ring-ring font-semibold');
      }

      const holidayNames = holidaysOn(day.iso)
        .map((h) => h.name)
        .join(', ');
      const aria = [
        format(day.date, 'EEEE d MMMM yyyy'),
        holidayNames || null,
        endpoint ? 'selected' : null,
      ]
        .filter(Boolean)
        .join(', ');

      return {
        ...day,
        weekend,
        holiday,
        disabled,
        selected: mode === 'single' && day.iso === selected,
        endpoint,
        cellClass: parts.join(' '),
        aria,
      };
    });
  });

  /** Jump calendar to a date (ISO). Called by the field when opening. */
  showMonthFor(iso: string | null | undefined): void {
    const target = iso || todayIso();
    this.viewMonth.set(startOfMonth(fromIsoDate(target)));
    this.pendingStart.set(null);
  }

  protected shiftMonth(delta: number): void {
    this.viewMonth.update((m) => addMonths(m, delta));
  }

  protected pick(iso: string, disabled: boolean): void {
    if (disabled) {
      return;
    }
    const clamped = clampIso(iso, this.min(), this.max());

    if (this.mode() === 'single') {
      this.valueChange.emit(clamped);
      return;
    }

    const rangeStart = this.pendingStart() ?? this.start();
    const rangeEnd = this.pendingStart() ? null : this.end();
    const result = applyRangeClick(clamped, rangeStart, rangeEnd);
    if (!result.complete) {
      this.pendingStart.set(result.start);
      return;
    }
    this.pendingStart.set(null);
    this.rangeChange.emit({ start: result.start, end: result.end! });
  }
}
