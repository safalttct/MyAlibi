import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucidePlus } from '@lucide/angular';
import { addMonths, format, startOfMonth } from 'date-fns';
import { CATEGORIES, LeaveCategory, LeaveRecord, categoryMeta } from '../../core/models/leave.models';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import { WEEKDAYS_MON_FIRST, buildMonthGrid } from '../../core/utils/calendar-grid';
import { todayIso } from '../../core/utils/dates';
import { LeaveRecordDialog } from '../../shared/components/leave-record-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    UiCard,
    UiButton,
    UiSkeleton,
    LeaveRecordDialog,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePlus,
  ],
  template: `
    <app-page-header title="Calendar" [subtitle]="label()">
      <button uiButton variant="outline" size="icon" aria-label="Previous month" (click)="shift(-1)">
        <svg lucideChevronLeft size="16"></svg>
      </button>
      <button uiButton variant="outline" size="sm" (click)="goToday()">Today</button>
      <button uiButton variant="outline" size="icon" aria-label="Next month" (click)="shift(1)">
        <svg lucideChevronRight size="16"></svg>
      </button>
    </app-page-header>

    <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      <button type="button" class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        [class]="filter() === '' ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-foreground'"
        (click)="filter.set('')">All</button>
      @for (c of categories; track c.id) {
        <button type="button" class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          [class]="filter() === c.id ? c.borderClass + ' ' + c.softBgClass + ' ' + c.textClass : 'border-border text-muted hover:text-foreground'"
          [attr.aria-pressed]="filter() === c.id"
          (click)="filter.set(c.id)">
          <span class="size-2 rounded-full" [class]="c.dotClass"></span>{{ c.label }}
        </button>
      }
    </div>

    <ui-card [padded]="false">
      <div class="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted">
        @for (d of weekdays; track d) { <div class="py-2">{{ d }}</div> }
      </div>

      @if (loading()) {
        <ui-skeleton class="m-4 h-96" />
      } @else {
        <div class="grid grid-cols-7">
          @for (day of days(); track day.iso) {
            <div class="group relative min-h-20 border-r border-b border-border p-1 last:border-r-0 sm:min-h-28 sm:p-1.5"
              [class]="day.inMonth ? '' : 'bg-background/50'">
              <div class="flex items-center justify-between">
                <span class="flex size-6 items-center justify-center rounded-full text-xs"
                  [class]="day.iso === todayStr ? 'bg-accent font-semibold text-accent-foreground' : day.inMonth ? 'text-foreground' : 'text-muted/50'">
                  {{ day.date.getDate() }}
                </span>
                <button type="button" class="rounded p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  [attr.aria-label]="'Add record on ' + day.iso" (click)="openAdd(day.iso)">
                  <svg lucidePlus size="14"></svg>
                </button>
              </div>
              <ul class="mt-1 space-y-0.5">
                @for (r of day.records; track r.id) {
                  <li>
                    <button type="button"
                      class="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight font-medium sm:text-xs"
                      [class]="meta(r.category).softBgClass + ' ' + meta(r.category).textClass"
                      [attr.title]="r.title + ' · ' + (r.duration ?? 'Needs review')"
                      (click)="openEdit(r)">
                      <span class="truncate">{{ meta(r.category).short }}</span>
                      @if (r.duration === 'Half Day') { <span class="ml-auto shrink-0" aria-label="Half day">½</span> }
                      @if (r.status === 'needs_review') { <span class="ml-auto shrink-0" aria-label="Needs review">!</span> }
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      }
    </ui-card>

    @if (error()) {
      <p class="mt-3 text-sm text-danger" role="alert">{{ error() }}</p>
    }

    <app-leave-record-dialog
      [open]="dialogOpen()"
      [record]="editing()"
      [defaultDate]="defaultDate()"
      [defaultCategory]="filter() || null"
      (closed)="dialogOpen.set(false)"
      (saved)="load()"
    />
  `,
})
export class CalendarPage {
  private readonly service = inject(LeaveRecordsService);

  protected readonly categories = CATEGORIES;
  protected readonly weekdays = WEEKDAYS_MON_FIRST;
  protected readonly todayStr = todayIso();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly records = signal<LeaveRecord[]>([]);
  protected readonly month = signal(startOfMonth(new Date()));
  protected readonly filter = signal<'' | LeaveCategory>('');

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<LeaveRecord | null>(null);
  protected readonly defaultDate = signal<string | null>(null);

  protected readonly label = computed(() => format(this.month(), 'MMMM yyyy'));

  protected readonly days = computed(() => {
    const filter = this.filter();
    const byDate = new Map<string, LeaveRecord[]>();
    for (const r of this.records()) {
      if (filter && r.category !== filter) {
        continue;
      }
      byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
    }
    return buildMonthGrid(this.month()).map((day) => ({ ...day, records: byDate.get(day.iso) ?? [] }));
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.records.set(await this.service.list());
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load records.');
    } finally {
      this.loading.set(false);
    }
  }

  protected meta(category: LeaveCategory) {
    return categoryMeta(category);
  }

  protected shift(delta: number): void {
    this.month.update((m) => addMonths(m, delta));
  }

  protected goToday(): void {
    this.month.set(startOfMonth(new Date()));
  }

  protected openAdd(date: string): void {
    this.editing.set(null);
    this.defaultDate.set(date);
    this.dialogOpen.set(true);
  }

  protected openEdit(record: LeaveRecord): void {
    this.editing.set(record);
    this.dialogOpen.set(true);
  }
}
