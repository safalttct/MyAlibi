import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideHouse,
  LucidePlus,
  LucideSettings,
  LucideSparkles,
  LucideTimerReset,
  LucideTriangleAlert,
} from '@lucide/angular';
import { addMonths, format, startOfMonth } from 'date-fns';
import {
  CategoryMeta,
  CompOffTransaction,
  LeaveBalance,
  LeaveCategory,
  LeaveRecord,
  categoryMeta,
} from '../../core/models/leave.models';
import { BalanceService } from '../../core/services/balance.service';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { CompOffService } from '../../core/services/comp-off.service';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import {
  COMP_OFF_EXPIRY_ALERT_DAYS,
  COMP_OFF_VALIDITY_DAYS,
  expiringCompOffLots,
  monthlyUsage,
  negativeWarnings,
  summarizeUsage,
} from '../../core/services/leave-calculation';
import { ToastService } from '../../core/services/toast.service';
import { WEEKDAYS_MON_FIRST, buildMonthGrid } from '../../core/utils/calendar-grid';
import { fromIsoDate, inRange, todayIso } from '../../core/utils/dates';
import { BalanceCard } from '../../shared/components/balance-card';
import { LeaveRecordDialog } from '../../shared/components/leave-record-dialog';
import { PageHeader } from '../../shared/components/page-header';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

interface BalanceRow {
  meta: CategoryMeta;
  balance: LeaveBalance | null;
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    PageHeader,
    BalanceCard,
    UiCard,
    UiBadge,
    UiButton,
    UiSkeleton,
    UiEmptyState,
    LeaveRecordDialog,
    LucidePlus,
    LucideHouse,
    LucideTimerReset,
    LucideChevronLeft,
    LucideChevronRight,
    LucideTriangleAlert,
    LucideSparkles,
    LucideSettings,
  ],
  template: `
    <app-page-header title="Dashboard" [subtitle]="subtitle()">
      <button uiButton size="sm" (click)="openAdd('Casual Leave')">
        <svg lucidePlus size="14"></svg> Add leave
      </button>
      <button uiButton variant="outline" size="sm" (click)="openAdd('Work From Home')">
        <svg lucideHouse size="14"></svg> WFH
      </button>
      @if (compOffRemaining() > 0) {
        <button uiButton variant="outline" size="sm" class="max-sm:hidden" (click)="openAdd('Compensatory Leave')">
          <svg lucideTimerReset size="14"></svg> Use comp off
        </button>
      }
    </app-page-header>

    @if (error()) {
      <p class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
    }

    @if (!loading() && showGettingStarted()) {
      <section
        class="mb-4 rounded-2xl border border-primary/25 bg-primary-soft p-4 sm:mb-5 sm:p-5"
        aria-label="Getting started"
      >
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg lucideSparkles size="18"></svg>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-sm font-semibold text-foreground">{{ gettingStartedTitle() }}</h2>
            <p class="mt-1 text-sm text-muted">{{ gettingStartedCopy() }}</p>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              @if (records().length === 0) {
                <button uiButton size="sm" class="max-sm:w-full" (click)="openAdd('Casual Leave')">
                  <svg lucidePlus size="14"></svg> Log today’s leave
                </button>
                <button uiButton variant="outline" size="sm" class="max-sm:w-full" (click)="openAdd('Work From Home')">
                  <svg lucideHouse size="14"></svg> Log WFH
                </button>
              }
              @if (!hasAllocations()) {
                <a uiButton variant="outline" size="sm" routerLink="/settings/allocations" class="max-sm:w-full">
                  <svg lucideSettings size="14"></svg> Set allocations
                </a>
              } @else if (records().length === 0) {
                <a uiButton variant="ghost" size="sm" routerLink="/settings/allocations" class="max-sm:w-full">
                  <svg lucideSettings size="14"></svg> Review allocations
                </a>
              }
            </div>
          </div>
        </div>
      </section>
    }

    @if (compOffExpiring().length > 0) {
      <section
        class="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm sm:px-4"
        role="status"
        aria-label="Comp Off expiring soon"
      >
        <div class="flex items-start gap-2">
          <svg lucideTriangleAlert size="16" class="mt-0.5 shrink-0 text-warning"></svg>
          <div class="min-w-0 flex-1">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-foreground">
                  {{ compOffExpiringTotal() }} Comp Off day{{ compOffExpiringTotal() === 1 ? '' : 's' }}
                  expiring within {{ alertDays }} days
                </p>
                <p class="mt-0.5 text-muted">
                  Use them before they lapse ({{ validityDays }}-day validity from approval).
                </p>
              </div>
              <a uiButton size="sm" variant="outline" routerLink="/comp-off" class="shrink-0 max-sm:w-full">
                <svg lucideTimerReset size="14"></svg> Open Comp Off
              </a>
            </div>
            <ul class="mt-2 space-y-1 text-muted">
              @for (lot of compOffExpiring(); track lot.expiry_date + lot.transaction_date + lot.days) {
                <li>
                  <span class="font-medium tabular-nums text-foreground">{{ lot.days }}</span>
                  day{{ lot.days === 1 ? '' : 's' }}
                  · expires {{ lot.expiry_date | date: 'd MMM y' }}
                  @if (lot.days_until_expiry === 0) {
                    <span class="text-warning"> (today)</span>
                  } @else if (lot.days_until_expiry === 1) {
                    <span class="text-warning"> (tomorrow)</span>
                  } @else {
                    <span> (in {{ lot.days_until_expiry }} days)</span>
                  }
                </li>
              }
            </ul>
          </div>
        </div>
      </section>
    }

    @if (warnings().length > 0) {
      <div class="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="alert">
        <svg lucideTriangleAlert size="16" class="mt-0.5 shrink-0"></svg>
        <ul>@for (w of warnings(); track w) { <li>{{ w }}</li> }</ul>
      </div>
    }

    <section aria-label="Balances" class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
      @if (loading()) {
        @for (n of [1, 2, 3, 4, 5]; track n) { <ui-skeleton class="h-32 sm:h-36" /> }
      } @else {
        @for (card of cards(); track card.meta.id) {
          <app-balance-card [meta]="card.meta" [balance]="card.balance" />
        }
      }
    </section>

    <div class="mt-4 grid gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-3">
      <ui-card title="This month" [description]="monthLabel">
        @if (loading()) {
          <ui-skeleton class="h-28" />
        } @else {
          <div class="grid grid-cols-2 gap-2.5 text-center sm:gap-3">
            <div class="rounded-xl bg-wfh/10 p-3">
              <p class="text-2xl font-semibold text-wfh tabular-nums">{{ monthSummary().wfhDays }}</p>
              <p class="text-xs text-muted">WFH days</p>
            </div>
            <div class="rounded-xl bg-casual/10 p-3">
              <p class="text-2xl font-semibold text-casual tabular-nums">{{ monthSummary().leaveDays }}</p>
              <p class="text-xs text-muted">Leave days</p>
            </div>
          </div>
          <ul class="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
            @for (row of monthByCategory(); track row.meta.id) {
              <li class="flex items-center justify-between text-sm">
                <span class="flex items-center gap-2 text-muted">
                  <span class="size-2 rounded-full" [class]="row.meta.dotClass"></span>{{ row.meta.label }}
                </span>
                <span class="font-medium tabular-nums">{{ row.days }}</span>
              </li>
            }
          </ul>
        }
      </ui-card>

      <ui-card title="Upcoming" description="Next scheduled days">
        @if (loading()) {
          <ui-skeleton class="h-28" />
        } @else if (upcoming().length === 0) {
          <ui-empty-state title="Nothing scheduled" description="Future leave and WFH days will show up here." class="border-0 py-6">
            <svg emptyIcon lucidePlus size="24"></svg>
          </ui-empty-state>
        } @else {
          <ul class="-my-1 divide-y divide-border">
            @for (r of upcoming(); track r.id) {
              <li><button type="button" class="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-card-hover" (click)="openEdit(r)">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ r.title }}</span>
                  <span class="text-xs text-muted">{{ r.date | date: 'EEE, d MMM' }} · {{ r.duration ?? 'Needs review' }}</span>
                </span>
                <ui-badge [category]="r.category">{{ short(r.category) }}</ui-badge>
              </button></li>
            }
          </ul>
        }
      </ui-card>

      <ui-card title="Recent" description="Latest entries">
        @if (loading()) {
          <ui-skeleton class="h-28" />
        } @else if (recent().length === 0) {
          <ui-empty-state title="No records yet" description="Add your first leave or WFH day." class="border-0 py-4">
            <svg emptyIcon lucidePlus size="24"></svg>
            <button uiButton size="sm" (click)="openAdd('Work From Home')"><svg lucidePlus size="14"></svg> Add record</button>
          </ui-empty-state>
        } @else {
          <ul class="-my-1 divide-y divide-border">
            @for (r of recent(); track r.id) {
              <li><button type="button" class="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-card-hover" (click)="openEdit(r)">
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium">{{ r.title }}</span>
                  <span class="text-xs text-muted">{{ r.date | date: 'EEE, d MMM y' }} · {{ r.duration ?? 'Needs review' }}</span>
                </span>
                <ui-badge [category]="r.category">{{ short(r.category) }}</ui-badge>
              </button></li>
            }
          </ul>
        }
      </ui-card>
    </div>

    <ui-card class="mt-3 sm:mt-4" title="Calendar" [description]="miniLabel()">
      <div cardActions class="-mt-1 -mr-1.5 flex gap-1">
        <button uiButton variant="ghost" size="icon" aria-label="Previous month" (click)="shiftMonth(-1)"><svg lucideChevronLeft size="16"></svg></button>
        <button uiButton variant="ghost" size="icon" aria-label="Next month" (click)="shiftMonth(1)"><svg lucideChevronRight size="16"></svg></button>
      </div>
      <div class="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-fg sm:gap-1">
        @for (d of weekdays; track d) { <span>{{ d }}</span> }
      </div>
      <div class="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1">
        @for (day of miniDays(); track day.iso) {
          <button type="button"
            class="flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg text-xs tabular-nums transition-colors hover:bg-card-hover sm:h-11 sm:gap-1"
            [class]="day.inMonth ? 'text-foreground' : 'text-muted-fg/50'"
            [class.ring-1]="day.iso === todayStr"
            [class.ring-accent]="day.iso === todayStr"
            [class.font-semibold]="day.iso === todayStr"
            [attr.aria-label]="'Add record on ' + day.iso"
            (click)="openAddOn(day.iso)">
            {{ day.date.getDate() }}
            <span class="flex h-1.5 gap-0.5">
              @for (meta of day.dots; track meta.id) { <span class="size-1.5 rounded-full" [class]="meta.dotClass"></span> }
            </span>
          </button>
        }
      </div>
    </ui-card>

    <app-leave-record-dialog
      [open]="dialogOpen()"
      [record]="editing()"
      [defaultCategory]="defaultCategory()"
      [defaultDate]="defaultDate()"
      (closed)="dialogOpen.set(false)"
      (saved)="load()"
    />
  `,
})
export class DashboardPage {
  private readonly balanceService = inject(BalanceService);
  private readonly recordsService = inject(LeaveRecordsService);
  private readonly compOffService = inject(CompOffService);
  private readonly toast = inject(ToastService);
  private readonly prefs = inject(CategoryPreferencesService);

  protected readonly today = new Date();
  protected readonly todayStr = todayIso();
  protected readonly todayLabel = format(this.today, 'EEEE, d MMMM y');
  protected readonly weekdays = WEEKDAYS_MON_FIRST;
  protected readonly monthLabel = format(this.today, 'MMMM yyyy');
  protected readonly validityDays = COMP_OFF_VALIDITY_DAYS;
  protected readonly alertDays = COMP_OFF_EXPIRY_ALERT_DAYS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly balances = signal<LeaveBalance[]>([]);
  protected readonly records = signal<LeaveRecord[]>([]);
  private readonly compOffTransactions = signal<CompOffTransaction[]>([]);
  private readonly miniMonth = signal(startOfMonth(new Date()));

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<LeaveRecord | null>(null);
  protected readonly defaultCategory = signal<LeaveCategory | null>(null);
  protected readonly defaultDate = signal<string | null>(null);

  protected readonly cards = computed<BalanceRow[]>(() => {
    const all = this.balances();
    const categories = this.prefs.enabledCategories();
    return categories.map((meta) => {
      const rows = all.filter((b) => b.category === meta.id);
      const current =
        rows.find((b) => inRange(this.todayStr, b.period_start, b.period_end)) ??
        rows.sort((a, b) => b.period_start.localeCompare(a.period_start))[0] ??
        null;
      return { meta, balance: current };
    });
  });

  protected readonly subtitle = computed(() => {
    const period = this.cards().find((c) => c.balance)?.balance;
    if (!period) {
      return this.todayLabel;
    }
    const start = format(fromIsoDate(period.period_start), 'd MMM y');
    const end = format(fromIsoDate(period.period_end), 'd MMM y');
    return `Leave year ${start} – ${end}`;
  });

  protected readonly warnings = computed(() =>
    negativeWarnings(this.cards().flatMap((c) => (c.balance ? [c.balance] : []))),
  );

  protected readonly compOffExpiring = computed(() =>
    expiringCompOffLots(this.compOffTransactions(), this.todayStr, this.alertDays),
  );

  protected readonly compOffExpiringTotal = computed(() =>
    this.compOffExpiring().reduce((sum, lot) => sum + lot.days, 0),
  );

  protected readonly hasAllocations = computed(() =>
    this.balances().some((b) => Number(b.annual_allocation) > 0 || Number(b.total_available) > 0),
  );

  protected readonly compOffRemaining = computed(() => {
    const row = this.cards().find((c) => c.meta.id === 'Compensatory Leave')?.balance;
    return row ? Number(row.remaining) || 0 : 0;
  });

  /** Empty entitlements or zero records → show first-run coach. */
  protected readonly showGettingStarted = computed(
    () => !this.hasAllocations() || this.records().length === 0,
  );

  protected readonly gettingStartedTitle = computed(() => {
    if (!this.hasAllocations() && this.records().length === 0) {
      return 'Get set up';
    }
    if (this.records().length === 0) {
      return 'Log your first day';
    }
    return 'Finish getting started';
  });

  protected readonly gettingStartedCopy = computed(() => {
    if (!this.hasAllocations() && this.records().length === 0) {
      return 'Set entitlements, then log leave or WFH to start tracking.';
    }
    if (!this.hasAllocations()) {
      return 'Add your leave year entitlements so balances stay accurate.';
    }
    return 'Your year defaults are ready — add a leave or WFH day to begin.';
  });

  private readonly monthRange = computed(() => {
    const ym = this.todayStr.slice(0, 7);
    return { start: `${ym}-01`, end: `${ym}-31` };
  });

  protected readonly monthSummary = computed(() =>
    summarizeUsage(this.records().filter((r) => inRange(r.date, this.monthRange().start, this.monthRange().end))),
  );

  protected readonly monthByCategory = computed(() => {
    const rows = monthlyUsage(this.records(), this.monthRange());
    return this.prefs.enabledCategories().map((meta) => ({
      meta,
      days: rows.filter((r) => r.category === meta.id).reduce((s, r) => s + r.used_days, 0),
    }));
  });

  protected readonly upcoming = computed(() =>
    this.records()
      .filter((r) => r.date > this.todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
  );

  protected readonly recent = computed(() =>
    this.records()
      .filter((r) => r.date <= this.todayStr)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
  );

  protected readonly miniLabel = computed(() => format(this.miniMonth(), 'MMMM yyyy'));

  protected readonly miniDays = computed(() => {
    const byDate = new Map<string, Set<LeaveCategory>>();
    for (const r of this.records()) {
      const set = byDate.get(r.date) ?? new Set<LeaveCategory>();
      set.add(r.category);
      byDate.set(r.date, set);
    }
    return buildMonthGrid(this.miniMonth()).map((day) => ({
      ...day,
      dots: this.prefs.enabledCategories().filter((c) => byDate.get(day.iso)?.has(c.id)),
    }));
  });

  constructor() {
    void this.prefs.ensureLoaded();
    void this.load();
  }

  protected async load(): Promise<void> {
    try {
      const [balances, records, compOff] = await Promise.all([
        this.balanceService.fetchBalances(),
        this.recordsService.list(),
        this.compOffService.list(),
      ]);
      this.balances.set(balances);
      this.records.set(records);
      this.compOffTransactions.set(compOff);
      this.error.set(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load dashboard data.';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  protected short(category: LeaveCategory): string {
    return categoryMeta(category).short;
  }

  protected shiftMonth(delta: number): void {
    this.miniMonth.update((m) => addMonths(m, delta));
  }

  protected openAdd(category: LeaveCategory): void {
    this.editing.set(null);
    this.defaultCategory.set(category);
    this.defaultDate.set(this.todayStr);
    this.dialogOpen.set(true);
  }

  protected openAddOn(date: string): void {
    this.editing.set(null);
    this.defaultCategory.set('Work From Home');
    this.defaultDate.set(date);
    this.dialogOpen.set(true);
  }

  protected openEdit(record: LeaveRecord): void {
    this.editing.set(record);
    this.dialogOpen.set(true);
  }
}
