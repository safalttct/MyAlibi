import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideFilter,
  LucideListChecks,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { format } from 'date-fns';
import { map } from 'rxjs';
import {
  DURATIONS,
  LeaveCategory,
  LeaveRecord,
  categoryMeta,
  durationToDays,
  isLeaveCategory,
} from '../../core/models/leave.models';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { LeaveRecordsStore } from '../../core/services/leave-records.store';
import { ToastService } from '../../core/services/toast.service';
import { serializeCsv } from '../../core/utils/csv';
import { fromIsoDate } from '../../core/utils/dates';
import { downloadText } from '../../core/utils/download';
import { downloadRecordsPdf } from '../../core/utils/export-records-pdf';
import { ExportMenu } from '../../shared/components/export-menu';
import { LeaveRecordDialog } from '../../shared/components/leave-record-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiField } from '../../shared/ui/ui-field';
import { UiDateField } from '../../shared/ui/ui-date-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

type SortKey = 'date' | 'title' | 'category' | 'days';

@Component({
  selector: 'app-leave-records-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    PageHeader,
    UiCard,
    UiBadge,
    UiButton,
    UiInput,
    UiDateField,
    UiSelect,
    UiField,
    UiSkeleton,
    UiEmptyState,
    LeaveRecordDialog,
    ExportMenu,
    LucidePlus,
    LucideSearch,
    LucidePencil,
    LucideTrash2,
    LucideArrowUp,
    LucideArrowDown,
    LucideFilter,
    LucideListChecks,
    LucideX,
  ],
  template: `
    <app-page-header title="Records" subtitle="Every leave and work-from-home entry">
      <div class="max-sm:order-2 max-sm:flex-1">
        <app-export-menu
          class="block w-full [&_button]:w-full sm:[&_button]:w-auto"
          [disabled]="filtered().length === 0"
          [loading]="exportingPdf()"
          (selected)="chooseExport($event)"
        />
      </div>
      <button uiButton size="sm" class="max-sm:order-1" (click)="openAdd()">
        <svg lucidePlus size="14"></svg> Add record
      </button>
    </app-page-header>

    <ui-card [padded]="false">
      <div class="border-b border-border p-3 sm:p-4">
        <div class="flex flex-wrap items-center gap-2">
          <label class="relative min-w-0 flex-1 sm:max-w-xs">
            <svg lucideSearch size="14" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"></svg>
            <input
              uiInput
              type="search"
              class="pl-9"
              placeholder="Search title or notes"
              [value]="search()"
              (input)="search.set(val($event)); page.set(1)"
            />
          </label>
          <button
            uiButton
            variant="outline"
            size="sm"
            type="button"
            class="sm:hidden"
            [attr.aria-expanded]="filtersOpen()"
            (click)="filtersOpen.update((v) => !v)"
          >
            <svg lucideFilter size="14"></svg> Filters
            @if (advancedFilterCount() > 0) {
              <span class="tabular-nums">({{ advancedFilterCount() }})</span>
            }
          </button>
          @if (hasFilters()) {
            <button uiButton variant="ghost" size="sm" type="button" (click)="clearFilters()">Clear</button>
          }
          <span class="ml-auto text-xs text-muted tabular-nums max-sm:w-full max-sm:pt-1"
            >{{ filtered().length }} record(s) · {{ totalDays() }} day(s)</span
          >
        </div>

        @if (filterChips().length > 0) {
          <div class="mt-2 flex flex-wrap gap-1.5">
            @for (chip of filterChips(); track chip.key) {
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-card-hover"
                (click)="clearChip(chip.key)"
              >
                {{ chip.label }}
                <svg lucideX size="12" class="opacity-60"></svg>
              </button>
            }
          </div>
        }

        <div
          class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          [class.max-sm:hidden]="!filtersOpen()"
        >
          <ui-field label="Category">
            <select uiSelect [value]="category()" (change)="setCategory(val($event))">
              <option value="">All categories</option>
              @for (c of categories(); track c.id) {
                <option [value]="c.id">{{ c.label }}</option>
              }
            </select>
          </ui-field>
          <ui-field label="Duration">
            <select uiSelect [value]="duration()" (change)="duration.set(val($event)); page.set(1)">
              <option value="">Any duration</option>
              @for (d of durations; track d) {
                <option [value]="d">{{ d }}</option>
              }
              <option value="none">Needs review</option>
            </select>
          </ui-field>
          <ui-field label="Month" hint="Clears from/to when set">
            <input
              uiInput
              type="month"
              [value]="month()"
              (input)="setMonth(val($event))"
            />
          </ui-field>
          <ui-field label="From date" hint="Clears month when set">
            <ui-date-field
              label="From date"
              placeholder="From"
              [value]="from() || null"
              [disabled]="!!month()"
              (valueChange)="setFrom($event)"
            />
          </ui-field>
          <ui-field label="To date">
            <ui-date-field
              label="To date"
              placeholder="To"
              [value]="to() || null"
              [disabled]="!!month()"
              (valueChange)="setTo($event)"
            />
          </ui-field>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-2 p-3 sm:p-4">@for (n of [1, 2, 3, 4, 5]; track n) { <ui-skeleton class="h-16 md:h-10" /> }</div>
      } @else if (error()) {
        <p class="m-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
      } @else if (filtered().length === 0) {
        <div class="p-4 sm:p-6">
          <ui-empty-state
            [title]="all().length === 0 ? 'No records yet' : 'No records match your filters'"
            [description]="all().length === 0 ? 'Add a record or import your CSV files from Settings → Data.' : 'Try clearing or adjusting the filters.'"
          >
            <svg emptyIcon lucideListChecks size="28"></svg>
            @if (all().length === 0) {
              <button uiButton size="sm" (click)="openAdd()"><svg lucidePlus size="14"></svg> Add record</button>
            } @else if (hasFilters()) {
              <button uiButton size="sm" variant="outline" (click)="clearFilters()">Clear filters</button>
            }
          </ui-empty-state>
        </div>
      } @else {
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-elevated/40 text-left text-xs text-muted">
                @for (col of columns; track col.key) {
                  <th class="px-4 py-3 font-medium" [attr.aria-sort]="sortKey() === col.key ? (sortDir() === 'asc' ? 'ascending' : 'descending') : 'none'">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" (click)="toggleSort(col.key)">
                      {{ col.label }}
                      @if (sortKey() === col.key) {
                        @if (sortDir() === 'asc') { <svg lucideArrowUp size="12"></svg> } @else { <svg lucideArrowDown size="12"></svg> }
                      }
                    </button>
                  </th>
                }
                <th class="px-4 py-3 font-medium">Duration</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of pageRows(); track r.id) {
                <tr class="border-b border-border/60 transition-colors last:border-0 hover:bg-card-hover">
                  <td class="px-4 py-3 whitespace-nowrap">{{ r.date | date: 'EEE, d MMM y' }}</td>
                  <td class="max-w-64 px-4 py-3">
                    <p class="truncate font-medium">{{ r.title }}</p>
                    @if (r.notes) { <p class="truncate text-xs text-muted">{{ r.notes }}</p> }
                  </td>
                  <td class="px-4 py-3"><ui-badge [category]="r.category">{{ r.category }}</ui-badge></td>
                  <td class="px-4 py-3 tabular-nums">{{ r.days ?? '–' }}</td>
                  <td class="px-4 py-3">
                    @if (r.status === 'needs_review') { <ui-badge tone="warning">Needs review</ui-badge> } @else { {{ r.duration }} }
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button uiButton variant="ghost" size="icon" [attr.aria-label]="'Edit ' + r.title" (click)="openEdit(r)"><svg lucidePencil size="14"></svg></button>
                    <button uiButton variant="ghost" size="icon" [attr.aria-label]="'Delete ' + r.title" (click)="remove(r)"><svg lucideTrash2 size="14"></svg></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <ul class="divide-y divide-border md:hidden">
          @for (r of pageRows(); track r.id) {
            <li class="flex items-start justify-between gap-2 py-3 pr-1 pl-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-sm font-medium">{{ r.title }}</p>
                  <span class="shrink-0 text-xs font-medium tabular-nums text-muted">{{ r.days ?? '–' }}d</span>
                </div>
                <p class="mt-0.5 text-xs text-muted">
                  {{ r.date | date: 'EEE, d MMM y' }} ·
                  @if (r.status === 'needs_review') { Needs review } @else { {{ r.duration }} }
                </p>
                <div class="mt-2"><ui-badge [category]="r.category">{{ r.category }}</ui-badge></div>
              </div>
              <div class="flex shrink-0">
                <button uiButton variant="ghost" size="icon" [attr.aria-label]="'Edit ' + r.title" (click)="openEdit(r)"><svg lucidePencil size="16"></svg></button>
                <button uiButton variant="ghost" size="icon" class="hover:text-danger" [attr.aria-label]="'Delete ' + r.title" (click)="remove(r)"><svg lucideTrash2 size="16"></svg></button>
              </div>
            </li>
          }
        </ul>

        <div class="flex items-center justify-between gap-3 border-t border-border px-3 py-3 text-xs text-muted sm:px-4">
          <span>Page {{ page() }} of {{ pageCount() }}</span>
          <div class="flex gap-2">
            <button uiButton variant="outline" size="sm" [disabled]="page() <= 1" (click)="page.set(page() - 1)">Previous</button>
            <button uiButton variant="outline" size="sm" [disabled]="page() >= pageCount()" (click)="page.set(page() + 1)">Next</button>
          </div>
        </div>
      }
    </ui-card>

    <app-leave-record-dialog
      [open]="dialogOpen()"
      [record]="editing()"
      (closed)="dialogOpen.set(false)"
    />
  `,
})
export class LeaveRecordsPage {
  private readonly store = inject(LeaveRecordsStore);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly prefs = inject(CategoryPreferencesService);
  protected readonly categories = this.prefs.enabledCategories;
  protected readonly durations = DURATIONS;
  protected readonly columns: readonly { key: SortKey; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'title', label: 'Entry' },
    { key: 'category', label: 'Category' },
    { key: 'days', label: 'Days' },
  ];
  private readonly pageSize = 10;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly all = this.store.records;

  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly duration = signal('');
  protected readonly month = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly sortKey = signal<SortKey>('date');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(1);
  protected readonly filtersOpen = signal(false);

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<LeaveRecord | null>(null);
  protected readonly exportingPdf = signal(false);

  private readonly queryCategory = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('category') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('category') ?? '' },
  );

  protected readonly hasFilters = computed(
    () =>
      !!(this.search() || this.category() || this.duration() || this.month() || this.from() || this.to()),
  );

  protected readonly advancedFilterCount = computed(() => {
    let n = 0;
    if (this.category()) n++;
    if (this.duration()) n++;
    if (this.month()) n++;
    if (this.from() || this.to()) n++;
    return n;
  });

  protected readonly filterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.search()) chips.push({ key: 'search', label: `Search: ${this.search()}` });
    if (this.category()) {
      const id = this.category() as LeaveCategory;
      chips.push({
        key: 'category',
        label: isLeaveCategory(id) ? categoryMeta(id).label : this.category(),
      });
    }
    if (this.duration()) {
      chips.push({
        key: 'duration',
        label: this.duration() === 'none' ? 'Needs review' : this.duration(),
      });
    }
    if (this.month()) chips.push({ key: 'month', label: `Month: ${this.month()}` });
    if (this.from()) chips.push({ key: 'from', label: `From: ${this.from()}` });
    if (this.to()) chips.push({ key: 'to', label: `To: ${this.to()}` });
    return chips;
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const category = this.category();
    const duration = this.duration();
    const month = this.month();
    const from = this.from();
    const to = this.to();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const key = this.sortKey();

    return this.all()
      .filter((r) => {
        if (q && !`${r.title} ${r.notes ?? ''}`.toLowerCase().includes(q)) return false;
        if (category && r.category !== category) return false;
        if (duration === 'none' ? r.duration !== null : duration && r.duration !== duration) return false;
        if (month && !r.date.startsWith(month)) return false;
        if (!month) {
          if (from && r.date < from) return false;
          if (to && r.date > to) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const cmp =
          key === 'days'
            ? (a.days ?? 0) - (b.days ?? 0)
            : String(a[key]).localeCompare(String(b[key]));
        return (cmp || a.date.localeCompare(b.date)) * dir;
      });
  });

  protected readonly totalDays = computed(() =>
    this.filtered().reduce((sum, r) => sum + (r.status === 'complete' ? durationToDays(r.duration) : 0), 0),
  );
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  protected readonly pageRows = computed(() => {
    const page = Math.min(this.page(), this.pageCount());
    return this.filtered().slice((page - 1) * this.pageSize, page * this.pageSize);
  });

  constructor() {
    void this.prefs.ensureLoaded();
    void this.load();
    effect(() => {
      const cat = this.queryCategory();
      if (cat && isLeaveCategory(cat)) {
        this.category.set(cat);
        this.filtersOpen.set(true);
        this.page.set(1);
      }
    });
  }

  protected async load(): Promise<void> {
    try {
      await this.store.ensureLoaded();
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load records.');
    } finally {
      this.loading.set(false);
    }
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setCategory(value: string): void {
    this.category.set(value);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: value || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setMonth(value: string): void {
    this.month.set(value);
    if (value) {
      this.from.set('');
      this.to.set('');
    }
    this.page.set(1);
  }

  protected setFrom(value: string): void {
    this.from.set(value);
    if (value) {
      this.month.set('');
    }
    this.page.set(1);
  }

  protected setTo(value: string): void {
    this.to.set(value);
    if (value) {
      this.month.set('');
    }
    this.page.set(1);
  }

  protected clearChip(key: string): void {
    switch (key) {
      case 'search':
        this.search.set('');
        break;
      case 'category':
        this.setCategory('');
        break;
      case 'duration':
        this.duration.set('');
        break;
      case 'month':
        this.month.set('');
        break;
      case 'from':
        this.from.set('');
        break;
      case 'to':
        this.to.set('');
        break;
    }
    this.page.set(1);
  }

  protected toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'date' ? 'desc' : 'asc');
    }
  }

  protected clearFilters(): void {
    this.search.set('');
    this.category.set('');
    this.duration.set('');
    this.month.set('');
    this.from.set('');
    this.to.set('');
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected openAdd(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(record: LeaveRecord): void {
    this.editing.set(record);
    this.dialogOpen.set(true);
  }

  protected async remove(record: LeaveRecord): Promise<void> {
    try {
      await this.store.remove(record);
    } catch {
      // Store already toasted.
    }
  }

  protected chooseExport(formatKind: 'csv' | 'pdf'): void {
    if (formatKind === 'csv') {
      this.exportCsv();
    } else {
      this.exportPdf();
    }
  }

  private exportCsv(): void {
    const rows = this.filtered().map((r) => {
      const d = fromIsoDate(r.date);
      return [r.title, format(d, 'MMMM d, yyyy'), r.category, format(d, 'MMM yyyy'), r.duration ?? '', r.notes ?? ''];
    });
    downloadText(
      `myalibi-records-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      serializeCsv([['Entry', 'Date', 'Category', 'Month', 'Type', 'Notes'], ...rows]),
      'text/csv',
    );
  }

  private exportPdf(): void {
    const rows = this.filtered();
    if (rows.length === 0 || this.exportingPdf()) {
      return;
    }
    this.exportingPdf.set(true);
    try {
      const bits: string[] = [];
      if (this.hasFilters()) {
        bits.push('Filtered view (matches current Records filters)');
      }
      downloadRecordsPdf(rows, {
        title: 'Leave & WFH records',
        subtitle: bits,
      });
      this.toast.success('PDF downloaded');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'PDF export failed.');
    } finally {
      this.exportingPdf.set(false);
    }
  }
}
