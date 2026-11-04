import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideDownload,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideTrash2,
} from '@lucide/angular';
import { format } from 'date-fns';
import {
  CATEGORIES,
  DURATIONS,
  LeaveRecord,
  durationToDays,
} from '../../core/models/leave.models';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import { ToastService } from '../../core/services/toast.service';
import { serializeCsv } from '../../core/utils/csv';
import { fromIsoDate } from '../../core/utils/dates';
import { downloadText } from '../../core/utils/download';
import { LeaveRecordDialog } from '../../shared/components/leave-record-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
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
    UiSelect,
    UiSkeleton,
    UiEmptyState,
    UiConfirmDialog,
    LeaveRecordDialog,
    LucidePlus,
    LucideDownload,
    LucideSearch,
    LucidePencil,
    LucideTrash2,
    LucideArrowUp,
    LucideArrowDown,
  ],
  template: `
    <app-page-header title="Records" subtitle="Every leave and work-from-home entry">
      <button uiButton variant="outline" size="sm" (click)="exportCsv()" [disabled]="filtered().length === 0">
        <svg lucideDownload size="14"></svg> Export
      </button>
      <button uiButton size="sm" (click)="openAdd()"><svg lucidePlus size="14"></svg> Add record</button>
    </app-page-header>

    <ui-card [padded]="false">
      <div class="grid grid-cols-1 gap-2.5 border-b border-border p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-6">
        <label class="relative sm:col-span-2">
          <span class="sr-only">Search</span>
          <svg lucideSearch size="14" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"></svg>
          <input uiInput type="search" class="pl-9" placeholder="Search title or notes" [value]="search()"
            (input)="search.set(val($event)); page.set(1)" />
        </label>
        <select uiSelect aria-label="Category" [value]="category()" (change)="category.set(val($event)); page.set(1)">
          <option value="">All categories</option>
          @for (c of categories; track c.id) { <option [value]="c.id">{{ c.label }}</option> }
        </select>
        <select uiSelect aria-label="Duration" [value]="duration()" (change)="duration.set(val($event)); page.set(1)">
          <option value="">Any duration</option>
          @for (d of durations; track d) { <option [value]="d">{{ d }}</option> }
          <option value="none">Needs review</option>
        </select>
        <input uiInput type="month" aria-label="Month" [value]="month()" (input)="month.set(val($event)); page.set(1)" />
        <div class="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3">
          <input uiInput type="date" aria-label="From date" [value]="from()" (input)="from.set(val($event)); page.set(1)" />
          <input uiInput type="date" aria-label="To date" [value]="to()" (input)="to.set(val($event)); page.set(1)" />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-3">
          <span class="text-xs text-muted tabular-nums">{{ filtered().length }} record(s) · {{ totalDays() }} day(s)</span>
          @if (hasFilters()) {
            <button uiButton variant="ghost" size="sm" (click)="clearFilters()">Clear filters</button>
          }
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
            [description]="all().length === 0 ? 'Add a record or import your CSV files from Settings → Data.' : 'Try clearing or adjusting the filters.'">
            @if (all().length === 0) {
              <button uiButton size="sm" (click)="openAdd()"><svg lucidePlus size="14"></svg> Add record</button>
            }
          </ui-empty-state>
        </div>
      } @else {
        <!-- Desktop table -->
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
                    <button uiButton variant="ghost" size="icon" [attr.aria-label]="'Delete ' + r.title" (click)="askDelete(r)"><svg lucideTrash2 size="14"></svg></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
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
                <button uiButton variant="ghost" size="icon" class="hover:text-danger" [attr.aria-label]="'Delete ' + r.title" (click)="askDelete(r)"><svg lucideTrash2 size="16"></svg></button>
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
      (saved)="load()"
    />

    <ui-confirm-dialog
      [open]="deleting() !== null"
      title="Delete record?"
      [message]="'Delete “' + (deleting()?.title ?? '') + '”? This cannot be undone.'"
      confirmLabel="Delete"
      [loading]="busy()"
      (cancelled)="deleting.set(null)"
      (confirmed)="confirmDelete()"
    />
  `,
})
export class LeaveRecordsPage {
  private readonly service = inject(LeaveRecordsService);
  private readonly toast = inject(ToastService);

  protected readonly categories = CATEGORIES;
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
  protected readonly all = signal<LeaveRecord[]>([]);

  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly duration = signal('');
  protected readonly month = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly sortKey = signal<SortKey>('date');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(1);

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<LeaveRecord | null>(null);
  protected readonly deleting = signal<LeaveRecord | null>(null);
  protected readonly busy = signal(false);

  protected readonly hasFilters = computed(
    () =>
      !!(this.search() || this.category() || this.duration() || this.month() || this.from() || this.to()),
  );

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
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
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
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      this.all.set(await this.service.list());
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
  }

  protected openAdd(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(record: LeaveRecord): void {
    this.editing.set(record);
    this.dialogOpen.set(true);
  }

  protected askDelete(record: LeaveRecord): void {
    this.deleting.set(record);
  }

  protected async confirmDelete(): Promise<void> {
    const record = this.deleting();
    if (!record) {
      return;
    }
    this.busy.set(true);
    try {
      await this.service.delete(record.id);
      this.toast.success('Record deleted');
      this.deleting.set(null);
      await this.load();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not delete the record.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Exports the filtered rows in the same shape the importer understands. */
  protected exportCsv(): void {
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
}
