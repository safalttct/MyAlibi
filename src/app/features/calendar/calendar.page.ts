import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucidePlus } from '@lucide/angular';
import { addMonths, format, startOfMonth } from 'date-fns';
import { LeaveCategory, LeaveRecord, categoryMeta } from '../../core/models/leave.models';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import { WEEKDAYS_MON_FIRST, buildMonthGrid } from '../../core/utils/calendar-grid';
import { fromIsoDate, todayIso } from '../../core/utils/dates';
import { LeaveRecordDialog } from '../../shared/components/leave-record-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    UiCard,
    UiBadge,
    UiButton,
    UiSkeleton,
    LeaveRecordDialog,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePlus,
  ],
  template: `
    <app-page-header title="Calendar" [subtitle]="label()">
      <div class="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <button uiButton variant="outline" size="icon" aria-label="Previous month" (click)="shift(-1)">
          <svg lucideChevronLeft size="16"></svg>
        </button>
        <button uiButton variant="outline" size="sm" class="flex-1 sm:flex-none" (click)="goToday()">Today</button>
        <button uiButton variant="outline" size="icon" aria-label="Next month" (click)="shift(1)">
          <svg lucideChevronRight size="16"></svg>
        </button>
      </div>
    </app-page-header>

    <div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Filter by category">
      <button type="button" class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
        [class]="filter() === '' ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-foreground'"
        (click)="filter.set('')">All</button>
      @for (c of categories(); track c.id) {
        <button type="button" class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
          [class]="filter() === c.id ? c.borderClass + ' ' + c.softBgClass + ' ' + c.textClass : 'border-border text-muted hover:text-foreground'"
          [attr.aria-pressed]="filter() === c.id"
          (click)="filter.set(c.id)">
          <span class="size-2 rounded-full" [class]="c.dotClass"></span>{{ c.label }}
        </button>
      }
    </div>

    <ui-card [padded]="false">
      <div class="grid grid-cols-7 border-b border-border bg-elevated/40 text-center text-[11px] font-medium text-muted sm:text-xs">
        @for (d of weekdays; track d) { <div class="py-2">{{ d }}</div> }
      </div>

      @if (loading()) {
        <ui-skeleton class="m-3 h-80 sm:m-4 sm:h-96" />
      } @else {
        <div class="grid grid-cols-7">
          @for (day of days(); track day.iso) {
            <div class="group relative min-h-14 border-r border-b border-border p-1 last:border-r-0 sm:min-h-28 sm:p-1.5"
              [class]="(day.inMonth ? '' : 'bg-background/50 ') + (day.iso === selected() ? 'max-sm:bg-accent-soft' : '')">
              <button type="button" class="absolute inset-0 z-10 sm:hidden"
                [attr.aria-label]="day.iso + (day.records.length ? ', ' + day.records.length + ' record(s)' : '')"
                [attr.aria-pressed]="day.iso === selected()"
                (click)="selected.set(day.iso)"></button>
              <div class="flex items-center justify-center sm:justify-between">
                <span class="flex size-6 items-center justify-center rounded-full text-xs"
                  [class]="day.iso === todayStr ? 'bg-accent font-semibold text-accent-foreground' : day.inMonth ? 'text-foreground' : 'text-muted/50'">
                  {{ day.date.getDate() }}
                </span>
                <button type="button" class="rounded p-0.5 text-muted opacity-0 max-sm:hidden transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  [attr.aria-label]="'Add record on ' + day.iso" (click)="openAdd(day.iso)">
                  <svg lucidePlus size="14"></svg>
                </button>
              </div>
              <div class="mt-1 flex h-1.5 justify-center gap-0.5 sm:hidden" aria-hidden="true">
                @for (r of day.records.slice(0, 3); track r.id) { <span class="size-1.5 rounded-full" [class]="meta(r.category).dotClass"></span> }
              </div>
              <ul class="mt-1 space-y-0.5 max-sm:hidden">
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

    <ui-card class="mt-3 sm:hidden" [title]="selectedLabel()" description="Selected day">
      <button cardActions uiButton size="sm" (click)="openAdd(selected())"><svg lucidePlus size="14"></svg> Add</button>
      @if (selectedRecords().length === 0) {
        <p class="py-4 text-center text-sm text-muted">Nothing on this day.</p>
      } @else {
        <ul class="-my-1 divide-y divide-border">
          @for (r of selectedRecords(); track r.id) {
            <li>
              <button type="button" class="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-card-hover" (click)="openEdit(r)">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ r.title }}</span>
                  <span class="text-xs text-muted">{{ r.duration ?? 'Needs review' }}</span>
                </span>
                <ui-badge [category]="r.category">{{ meta(r.category).short }}</ui-badge>
              </button>
            </li>
          }
        </ul>
      }
    </ui-card>

    @if (error()) {
      <p class="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
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
  private readonly prefs = inject(CategoryPreferencesService);

  protected readonly categories = this.prefs.enabledCategories;
  protected readonly weekdays = WEEKDAYS_MON_FIRST;
  protected readonly todayStr = todayIso();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly records = signal<LeaveRecord[]>([]);
  protected readonly month = signal(startOfMonth(new Date()));
  protected readonly filter = signal<'' | LeaveCategory>('');

  protected readonly selected = signal(todayIso());

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

  protected readonly selectedLabel = computed(() => format(fromIsoDate(this.selected()), 'EEEE, d MMMM'));
  protected readonly selectedRecords = computed(() => this.days().find((d) => d.iso === this.selected())?.records ?? []);

  constructor() {
    void this.prefs.ensureLoaded();
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
