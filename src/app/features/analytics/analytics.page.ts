import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { LucideChartColumn } from '@lucide/angular';
import { format } from 'date-fns';
import { CATEGORIES, LeaveBalance, MonthlyUsageRow } from '../../core/models/leave.models';
import { BalanceService } from '../../core/services/balance.service';
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
  ],
  template: `
    <app-page-header title="Analytics" [subtitle]="periodLabel()">
      <select uiSelect class="w-full sm:w-40" aria-label="Period type" [value]="mode()" (change)="setMode($event)">
        <option value="fiscal">Fiscal (Apr–Mar)</option>
        <option value="calendar">Calendar year</option>
      </select>
      <select uiSelect class="w-full sm:w-32" aria-label="Year" (change)="setYear($event)">
        @for (y of years; track y) { <option [value]="y" [selected]="y === year()">{{ mode() === 'fiscal' ? y + '–' + (y + 1) : y }}</option> }
      </select>
    </app-page-header>

    @if (error()) {
      <p class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
        @for (n of [1, 2, 3, 4]; track n) { <ui-skeleton class="h-60 sm:h-72" /> }
      </div>
    } @else {
      <section class="mb-4 grid grid-cols-3 gap-2.5 sm:gap-4">
        <ui-card><p class="text-xs font-medium text-muted">WFH days</p><p class="mt-1 text-xl sm:text-2xl font-semibold text-wfh tabular-nums">{{ totals().wfh }}</p></ui-card>
        <ui-card><p class="text-xs font-medium text-muted">Leave days</p><p class="mt-1 text-xl sm:text-2xl font-semibold text-casual tabular-nums">{{ totals().leave }}</p></ui-card>
        <ui-card><p class="text-xs font-medium text-muted">Busiest</p><p class="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{{ totals().busiest }}</p></ui-card>
      </section>

      @if (rows().length === 0 && previousRows().length === 0) {
        <ui-empty-state title="No usage in this period" description="Add records or pick another period.">
          <svg emptyIcon lucideChartColumn size="28"></svg>
        </ui-empty-state>
      } @else {
        <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <ui-card title="Monthly usage" description="Days per month, by category" class="lg:col-span-2">
            <ui-bar-chart [labels]="monthLabels()" [series]="monthlySeries()" [stacked]="true" ariaLabel="Monthly usage by category" />
          </ui-card>

          <ui-card title="Utilization" description="Used vs available for this period">
            <ul class="space-y-4">
              @for (u of utilization(); track u.meta.id) {
                <li>
                  <div class="mb-1 flex items-center justify-between text-xs">
                    <span class="flex items-center gap-2 text-foreground"><span class="size-2 rounded-full" [class]="u.meta.dotClass"></span>{{ u.meta.label }}</span>
                    <span class="text-muted tabular-nums">
                      @if (u.balance) { {{ u.balance.used }} / {{ u.balance.total_available }} · {{ u.balance.usage_percent }}% } @else { No allocation }
                    </span>
                  </div>
                  <ui-progress [value]="u.balance?.usage_percent ?? 0" [color]="u.meta.color" [negative]="u.balance?.is_negative ?? false" />
                </li>
              }
            </ul>
          </ui-card>

          <ui-card title="Period comparison" [description]="'Previous period vs this period'">
            <ui-bar-chart [labels]="categoryLabels" [series]="comparisonSeries()" [stacked]="false" ariaLabel="Comparison with previous period" />
          </ui-card>

          <ui-card title="Cumulative trend" description="Running total of days taken" class="lg:col-span-2">
            <ui-line-chart [labels]="monthLabels()" [series]="trendSeries()" ariaLabel="Cumulative days trend" />
          </ui-card>
        </div>
      }
    }
  `,
})
export class AnalyticsPage {
  private readonly balanceService = inject(BalanceService);
  private readonly toast = inject(ToastService);

  protected readonly categoryLabels = CATEGORIES.map((c) => c.short);
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

  private readonly months = computed(() => monthStarts(this.range().start));
  protected readonly monthLabels = computed(() => this.months().map((m) => format(fromIsoDate(m), 'MMM')));

  protected readonly monthlySeries = computed<ChartSeries[]>(() =>
    CATEGORIES.map((c) => ({
      name: c.label,
      color: c.color,
      values: this.months().map((m) =>
        this.rows().filter((r) => r.month === m && r.category === c.id).reduce((s, r) => s + r.used_days, 0),
      ),
    })),
  );

  protected readonly utilization = computed(() => {
    const r = this.range();
    return CATEGORIES.map((meta) => ({
      meta,
      balance:
        this.balances().find(
          (b) => b.category === meta.id && b.period_start <= r.end && b.period_end >= r.start,
        ) ?? null,
    }));
  });

  protected readonly comparisonSeries = computed<ChartSeries[]>(() => {
    const sum = (rows: MonthlyUsageRow[], id: string) =>
      rows.filter((r) => r.category === id).reduce((s, r) => s + r.used_days, 0);
    return [
      { name: 'Previous period', color: 'var(--muted)', values: CATEGORIES.map((c) => sum(this.previousRows(), c.id)) },
      { name: 'This period', color: 'var(--accent)', values: CATEGORIES.map((c) => sum(this.rows(), c.id)) },
    ];
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
    const top = [...perMonth.entries()].sort((a, b) => b[1] - a[1])[0];
    return { wfh, leave, busiest: top ? format(fromIsoDate(top[0]), 'MMM yyyy') : '–' };
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
