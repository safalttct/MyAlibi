import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LucideChartColumn, LucideTrendingDown, LucideTrendingUp } from '@lucide/angular';
import { format } from 'date-fns';
import {
  CATEGORIES,
  CategoryMeta,
  LeaveBalance,
  MonthlyUsageRow,
} from '../../core/models/leave.models';
import { BalanceService } from '../../core/services/balance.service';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { DateRange, fiscalYearRange, fromIsoDate, monthStarts } from '../../core/utils/dates';
import { PageHeader } from '../../shared/components/page-header';
import { ChartSeries } from '../../shared/ui/chart-utils';
import { UiBarChart } from '../../shared/ui/ui-bar-chart';
import { UiCard } from '../../shared/ui/ui-card';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiLineChart } from '../../shared/ui/ui-line-chart';
import { UiProgress } from '../../shared/ui/ui-progress';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

type PeriodMode = 'fiscal' | 'calendar';

interface TypeBreakdown {
  meta: CategoryMeta;
  days: number;
  percent: number;
}

interface ComparisonRow {
  meta: CategoryMeta;
  previous: number;
  current: number;
  delta: number;
}

function rangeFor(mode: PeriodMode, year: number): DateRange {
  return mode === 'fiscal'
    ? { start: `${year}-04-01`, end: `${year + 1}-03-31` }
    : { start: `${year}-01-01`, end: `${year}-12-31` };
}

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    UiCard,
    UiSelect,
    UiSkeleton,
    UiProgress,
    UiEmptyState,
    UiBarChart,
    UiLineChart,
    LucideChartColumn,
    LucideTrendingUp,
    LucideTrendingDown,
  ],
  host: { class: 'block min-w-0 max-w-full' },
  template: `
    <app-page-header title="Analytics" [subtitle]="periodLabel()">
      <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
        <select
          uiSelect
          class="min-w-0 sm:w-44"
          aria-label="Period type"
          [value]="mode()"
          (change)="setMode($event)"
        >
          <option value="fiscal">Fiscal (Apr–Mar)</option>
          <option value="calendar">Calendar year</option>
        </select>
        <select uiSelect class="min-w-0 sm:w-32" aria-label="Year" (change)="setYear($event)">
          @for (y of years; track y) {
            <option [value]="y" [selected]="y === year()">
              {{ mode() === 'fiscal' ? y + '–' + (y + 1) : y }}
            </option>
          }
        </select>
      </div>
    </app-page-header>

    @if (error()) {
      <p
        class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        role="alert"
      >
        {{ error() }}
      </p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:gap-4">
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
          @for (n of [1, 2, 3, 4]; track n) {
            <ui-skeleton class="h-24" />
          }
        </div>
        <ui-skeleton class="h-64" />
        <ui-skeleton class="h-48" />
      </div>
    } @else {
      <!-- Summary -->
      <section class="mb-4 grid grid-cols-2 gap-2.5 sm:mb-5 sm:grid-cols-4 sm:gap-3" aria-label="Summary">
        <article class="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Total days</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {{ totals().total }}
          </p>
          <p class="mt-1 text-[11px] text-muted">WFH + leave this period</p>
        </article>
        <article class="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">WFH</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-wfh">
            {{ totals().wfh }}
          </p>
          <p class="mt-1 text-[11px] text-muted tabular-nums">{{ totals().wfhShare }}% of total</p>
        </article>
        <article class="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Leave</p>
          <p class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-casual">
            {{ totals().leave }}
          </p>
          <p class="mt-1 text-[11px] text-muted tabular-nums">{{ totals().leaveShare }}% of total</p>
        </article>
        <article class="rounded-xl border border-border bg-card p-3.5 sm:p-4">
          <p class="text-[11px] font-medium tracking-wide text-muted uppercase">Busiest month</p>
          <p class="mt-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {{ totals().busiest }}
          </p>
          <p class="mt-1 text-[11px] text-muted tabular-nums">
            @if (totals().busiestDays > 0) {
              {{ totals().busiestDays }} day(s)
            } @else {
              No usage yet
            }
          </p>
        </article>
      </section>

      @if (rows().length === 0 && previousRows().length === 0) {
        <ui-empty-state title="No usage in this period" description="Add records or pick another period.">
          <svg emptyIcon lucideChartColumn size="28"></svg>
        </ui-empty-state>
      } @else {
        <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <!-- Primary: days per month -->
          <ui-card
            title="Days per month"
            description="WFH and leave taken each month"
            class="min-w-0 lg:col-span-2"
          >
            <ui-bar-chart
              [labels]="monthLabels()"
              [series]="monthlySeries()"
              [stacked]="true"
              ariaLabel="Days per month by WFH and leave"
            />
          </ui-card>

          <!-- Breakdown by type -->
          <ui-card title="By leave type" description="Share of days taken this period">
            @if (typeBreakdown().length === 0) {
              <p class="text-sm text-muted">No days recorded in this period.</p>
            } @else {
              <ul class="space-y-3.5">
                @for (row of typeBreakdown(); track row.meta.id) {
                  <li>
                    <div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span class="flex min-w-0 items-center gap-2 text-foreground">
                        <span class="size-2.5 shrink-0 rounded-full" [class]="row.meta.dotClass"></span>
                        <span class="truncate">{{ row.meta.label }}</span>
                      </span>
                      <span class="shrink-0 text-xs text-muted tabular-nums">
                        {{ row.days }} day(s) · {{ row.percent }}%
                      </span>
                    </div>
                    <ui-progress [value]="row.percent" [color]="row.meta.color" />
                  </li>
                }
              </ul>
            }
          </ui-card>

          <!-- Utilization -->
          <ui-card title="Balance left" description="Used vs available for enabled types">
            @if (utilization().length === 0) {
              <p class="text-sm text-muted">No allocations for this period yet.</p>
            } @else {
              <ul class="space-y-3.5">
                @for (u of utilization(); track u.meta.id) {
                  <li>
                    <div class="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span class="flex min-w-0 items-center gap-2 text-foreground">
                        <span class="size-2.5 shrink-0 rounded-full" [class]="u.meta.dotClass"></span>
                        <span class="truncate">{{ u.meta.label }}</span>
                      </span>
                      <span class="shrink-0 text-xs text-muted tabular-nums">
                        @if (u.balance) {
                          {{ u.balance.used }} / {{ u.balance.total_available }} ·
                          {{ u.balance.usage_percent }}%
                        } @else {
                          No allocation
                        }
                      </span>
                    </div>
                    <ui-progress
                      [value]="u.balance?.usage_percent ?? 0"
                      [color]="u.meta.color"
                      [negative]="u.balance?.is_negative ?? false"
                    />
                  </li>
                }
              </ul>
            }
          </ui-card>

          <!-- Period comparison as readable list -->
          <ui-card
            title="Vs last period"
            [description]="comparisonHint()"
            class="min-w-0 lg:col-span-2"
          >
            @if (comparisonRows().length === 0) {
              <p class="text-sm text-muted">Not enough history to compare yet.</p>
            } @else {
              <!-- Mobile-friendly rows -->
              <ul class="divide-y divide-border">
                @for (row of comparisonRows(); track row.meta.id) {
                  <li class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="size-2.5 shrink-0 rounded-full" [class]="row.meta.dotClass"></span>
                      <span class="truncate text-sm font-medium text-foreground">{{ row.meta.label }}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums sm:justify-end">
                      <span class="text-muted">
                        Prev
                        <span class="ml-1 font-medium text-foreground">{{ row.previous }}</span>
                      </span>
                      <span class="text-muted">
                        Now
                        <span class="ml-1 font-medium text-foreground">{{ row.current }}</span>
                      </span>
                      <span
                        class="inline-flex items-center gap-0.5 font-medium"
                        [class.text-success]="row.delta < 0"
                        [class.text-danger]="row.delta > 0"
                        [class.text-muted]="row.delta === 0"
                      >
                        @if (row.delta > 0) {
                          <svg lucideTrendingUp size="12"></svg>
                          +{{ row.delta }}
                        } @else if (row.delta < 0) {
                          <svg lucideTrendingDown size="12"></svg>
                          {{ row.delta }}
                        } @else {
                          Same
                        }
                      </span>
                    </div>
                  </li>
                }
              </ul>
            }
          </ui-card>

          <!-- Cumulative trend -->
          <ui-card
            title="Running total"
            description="How days add up across the year"
            class="min-w-0 lg:col-span-2"
          >
            <ui-line-chart
              [labels]="monthLabels()"
              [series]="trendSeries()"
              ariaLabel="Cumulative WFH and leave days"
            />
          </ui-card>
        </div>
      }
    }
  `,
})
export class AnalyticsPage {
  private readonly balanceService = inject(BalanceService);
  private readonly prefs = inject(CategoryPreferencesService);
  private readonly toast = inject(ToastService);

  protected readonly mode = signal<PeriodMode>('fiscal');
  protected readonly year = signal(Number(fiscalYearRange(new Date()).start.slice(0, 4)));
  protected readonly years = (() => {
    const current = Number(fiscalYearRange(new Date()).start.slice(0, 4));
    return [current + 1, current, current - 1, current - 2];
  })();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<MonthlyUsageRow[]>([]);
  protected readonly previousRows = signal<MonthlyUsageRow[]>([]);
  private readonly balances = signal<LeaveBalance[]>([]);
  private requestId = 0;

  protected readonly range = computed(() => rangeFor(this.mode(), this.year()));
  private readonly previousRange = computed(() => rangeFor(this.mode(), this.year() - 1));

  protected readonly periodLabel = computed(() => {
    const r = this.range();
    return `${format(fromIsoDate(r.start), 'd MMM yyyy')} – ${format(fromIsoDate(r.end), 'd MMM yyyy')}`;
  });

  protected readonly comparisonHint = computed(() => {
    const prev = this.previousRange();
    return `Compared with ${format(fromIsoDate(prev.start), 'MMM yyyy')} – ${format(fromIsoDate(prev.end), 'MMM yyyy')}`;
  });

  private readonly months = computed(() => monthStarts(this.range().start));
  protected readonly monthLabels = computed(() => this.months().map((m) => format(fromIsoDate(m), 'MMM')));

  /** Categories that are enabled or have usage in either period. */
  private readonly activeCategories = computed(() => {
    const enabled = new Set(this.prefs.enabledCategories().map((c) => c.id));
    const used = new Set<string>();
    for (const r of this.rows()) {
      if (r.used_days > 0) used.add(r.category);
    }
    for (const r of this.previousRows()) {
      if (r.used_days > 0) used.add(r.category);
    }
    return CATEGORIES.filter((c) => enabled.has(c.id) || used.has(c.id));
  });

  /** Simple 2-series monthly chart: WFH vs all other leave. */
  protected readonly monthlySeries = computed<ChartSeries[]>(() => {
    const months = this.months();
    const rows = this.rows();
    const wfh: number[] = [];
    const leave: number[] = [];
    for (const m of months) {
      let w = 0;
      let l = 0;
      for (const r of rows) {
        if (r.month !== m) continue;
        if (r.category === 'Work From Home') w += r.used_days;
        else l += r.used_days;
      }
      wfh.push(w);
      leave.push(l);
    }
    return [
      { name: 'WFH', color: 'var(--wfh)', values: wfh },
      { name: 'Leave', color: 'var(--casual)', values: leave },
    ];
  });

  protected readonly typeBreakdown = computed<TypeBreakdown[]>(() => {
    const rows = this.rows();
    const total = rows.reduce((s, r) => s + r.used_days, 0);
    if (total <= 0) return [];

    const byId = new Map<string, number>();
    for (const r of rows) {
      byId.set(r.category, (byId.get(r.category) ?? 0) + r.used_days);
    }

    return this.activeCategories()
      .map((meta) => {
        const days = byId.get(meta.id) ?? 0;
        return {
          meta,
          days,
          percent: Math.round((days / total) * 100),
        };
      })
      .filter((r) => r.days > 0)
      .sort((a, b) => b.days - a.days);
  });

  protected readonly utilization = computed(() => {
    const r = this.range();
    const enabled = new Set(this.prefs.enabledCategories().map((c) => c.id));
    return CATEGORIES.filter((meta) => enabled.has(meta.id))
      .map((meta) => ({
        meta,
        balance:
          this.balances().find(
            (b) => b.category === meta.id && b.period_start <= r.end && b.period_end >= r.start,
          ) ?? null,
      }))
      .filter((u) => u.balance != null);
  });

  protected readonly comparisonRows = computed<ComparisonRow[]>(() => {
    const sum = (rows: MonthlyUsageRow[], id: string) =>
      rows.filter((r) => r.category === id).reduce((s, r) => s + r.used_days, 0);

    return this.activeCategories()
      .map((meta) => {
        const previous = sum(this.previousRows(), meta.id);
        const current = sum(this.rows(), meta.id);
        return { meta, previous, current, delta: current - previous };
      })
      .filter((r) => r.previous > 0 || r.current > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current);
  });

  protected readonly trendSeries = computed<ChartSeries[]>(() => {
    const cumulative = (predicate: (category: string) => boolean): number[] => {
      let running = 0;
      return this.months().map((m) => {
        running += this.rows()
          .filter((r) => r.month === m && predicate(r.category))
          .reduce((s, r) => s + r.used_days, 0);
        return running;
      });
    };
    return [
      { name: 'WFH', color: 'var(--wfh)', values: cumulative((c) => c === 'Work From Home') },
      { name: 'Leave', color: 'var(--casual)', values: cumulative((c) => c !== 'Work From Home') },
    ];
  });

  protected readonly totals = computed(() => {
    const perMonth = new Map<string, number>();
    let wfh = 0;
    let leave = 0;
    for (const r of this.rows()) {
      if (r.category === 'Work From Home') wfh += r.used_days;
      else leave += r.used_days;
      perMonth.set(r.month, (perMonth.get(r.month) ?? 0) + r.used_days);
    }
    const total = wfh + leave;
    const top = [...perMonth.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      wfh,
      leave,
      total,
      wfhShare: total > 0 ? Math.round((wfh / total) * 100) : 0,
      leaveShare: total > 0 ? Math.round((leave / total) * 100) : 0,
      busiest: top && top[1] > 0 ? format(fromIsoDate(top[0]), 'MMM yyyy') : '—',
      busiestDays: top?.[1] ?? 0,
    };
  });

  constructor() {
    effect(() => {
      const range = this.range();
      const previous = this.previousRange();
      untracked(() => void this.load(range, previous));
    });
  }

  protected setMode(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as PeriodMode);
  }

  protected setYear(event: Event): void {
    this.year.set(Number((event.target as HTMLSelectElement).value));
  }

  private async load(range: DateRange, previous: DateRange): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    try {
      await this.prefs.ensureLoaded();
      const [rows, previousRows, balances] = await Promise.all([
        this.balanceService.monthlyUsage(range.start, range.end),
        this.balanceService.monthlyUsage(previous.start, previous.end),
        this.balanceService.fetchBalances(),
      ]);
      if (id !== this.requestId) {
        return;
      }
      this.rows.set(rows);
      this.previousRows.set(previousRows);
      this.balances.set(balances);
      this.error.set(null);
    } catch (e) {
      if (id === this.requestId) {
        const message = e instanceof Error ? e.message : 'Could not load analytics.';
        this.error.set(message);
        this.toast.error(message);
      }
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
