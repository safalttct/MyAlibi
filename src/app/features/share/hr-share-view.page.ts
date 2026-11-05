import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideEye, LucideX } from '@lucide/angular';
import {
  LeaveCategory,
  LeaveDuration,
  categoryMeta,
  isLeaveCategory,
  normalizeCategory,
} from '../../core/models/leave.models';
import { HrShareRecord, HrShareService, HrShareSnapshotOk } from '../../core/services/hr-share.service';
import { fiscalYearLabel } from '../../core/utils/dates';
import { AppFooter } from '../../shared/components/app-footer';
import { AppLogo } from '../../shared/components/app-logo';
import { ThemeToggle } from '../../shared/components/theme-toggle';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

type KindFilter = 'all' | 'leave' | 'wfh';

@Component({
  selector: 'app-hr-share-view-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    AppLogo,
    AppFooter,
    ThemeToggle,
    UiCard,
    UiBadge,
    UiSkeleton,
    UiEmptyState,
    UiButton,
    UiField,
    UiInput,
    UiSelect,
    LucideEye,
    LucideX,
  ],
  host: { class: 'block min-h-dvh overflow-x-hidden bg-background' },
  template: `
    <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <app-logo size="md" />
          <p class="mt-3 text-sm text-muted">Shared leave summary for HR cross-check</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 self-start">
          <span
            class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted"
          >
            <svg lucideEye size="14"></svg>
            View only
          </span>
          <app-theme-toggle size="sm" />
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4">
          <ui-skeleton class="h-24" />
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (n of [1, 2, 3]; track n) {
              <ui-skeleton class="h-28" />
            }
          </div>
          <ui-skeleton class="h-64" />
        </div>
      } @else if (error()) {
        <ui-card>
          <ui-empty-state
            title="Link unavailable"
            description="This share link is invalid, expired, or was revoked. Ask the employee for a new link."
          />
        </ui-card>
      } @else if (snapshot(); as snap) {
        <section class="mb-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {{ snap.employee_name }}
              </h1>
              <p class="mt-1 text-sm text-muted">
                {{ fyLabel() }} · {{ snap.period_start }} → {{ snap.period_end }}
              </p>
            </div>
            <p class="text-xs text-muted">
              Generated {{ snap.generated_at | date: 'medium' }}
            </p>
          </div>
        </section>

        <h2 class="mb-3 text-sm font-semibold text-foreground">Balances</h2>
        @if (balances().length === 0) {
          <ui-card class="mb-6">
            <p class="text-sm text-muted">No allocations for this financial year yet.</p>
          </ui-card>
        } @else {
          <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (b of balances(); track b.category) {
              <article class="rounded-xl border border-border bg-card p-4">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-xs font-medium tracking-wide text-muted uppercase">
                    {{ labelFor(b.category) }}
                  </h3>
                  <span class="size-2 rounded-full" [style.background]="colorFor(b.category)"></span>
                </div>
                <p
                  class="mt-3 text-2xl font-semibold tabular-nums tracking-tight"
                  [class.text-danger]="b.is_negative"
                  [style.color]="b.is_negative ? null : colorFor(b.category)"
                >
                  {{ b.remaining }}
                  <span class="ml-1 text-sm font-medium text-muted">left</span>
                </p>
                <p class="mt-2 text-xs text-muted tabular-nums">
                  {{ b.used }} used of {{ b.total_available }}
                </p>
              </article>
            }
          </div>
        }

        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-foreground">Records</h2>
          <span class="text-xs text-muted tabular-nums">
            {{ filteredRecords().length }} of {{ allRecords().length }} record(s)
          </span>
        </div>

        <div class="mb-4 rounded-xl border border-border bg-card p-3 sm:p-4">
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex gap-1 rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Record kind">
              @for (f of kindFilters; track f.id) {
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  [class]="
                    kind() === f.id
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  (click)="setKind(f.id)"
                >
                  {{ f.label }}
                </button>
              }
            </div>
            @if (hasFilters()) {
              <button uiButton variant="ghost" size="sm" type="button" (click)="clearFilters()">
                Clear
              </button>
            }
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

          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ui-field label="Category">
              <select uiSelect [value]="category()" (change)="category.set(val($event))">
                <option value="">All categories</option>
                @for (c of categoryOptions(); track c) {
                  <option [value]="c">{{ labelFor(c) }}</option>
                }
              </select>
            </ui-field>
            <ui-field label="Duration">
              <select uiSelect [value]="duration()" (change)="duration.set(val($event))">
                <option value="">Any duration</option>
                @for (d of durations; track d) {
                  <option [value]="d">{{ d }}</option>
                }
                <option value="none">Needs review</option>
              </select>
            </ui-field>
            <ui-field label="Month">
              <input uiInput type="month" [value]="month()" (input)="month.set(val($event))" />
            </ui-field>
          </div>
        </div>

        @if (filteredRecords().length === 0) {
          <ui-card>
            <ui-empty-state
              [title]="allRecords().length === 0 ? 'No records' : 'No records match your filters'"
              [description]="
                allRecords().length === 0
                  ? 'Nothing logged for the current year.'
                  : 'Try clearing or adjusting the filters.'
              "
            >
              @if (hasFilters()) {
                <button uiButton size="sm" variant="outline" type="button" (click)="clearFilters()">
                  Clear filters
                </button>
              }
            </ui-empty-state>
          </ui-card>
        } @else {
          <ui-card [padded]="false">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[36rem] text-left text-sm">
                <thead class="border-b border-border text-xs text-muted">
                  <tr>
                    <th class="px-4 py-3 font-medium sm:px-5">Date</th>
                    <th class="px-4 py-3 font-medium sm:px-5">Type</th>
                    <th class="px-4 py-3 font-medium sm:px-5">Title</th>
                    <th class="px-4 py-3 font-medium sm:px-5">Duration</th>
                    <th class="px-4 py-3 font-medium sm:px-5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of filteredRecords(); track trackRecord($index, r)) {
                    <tr class="border-b border-border/70 last:border-0">
                      <td class="px-4 py-3 whitespace-nowrap tabular-nums sm:px-5">
                        {{ r.date | date: 'mediumDate' }}
                      </td>
                      <td class="px-4 py-3 sm:px-5">
                        <span class="inline-flex items-center gap-1.5">
                          <span
                            class="size-2 shrink-0 rounded-full"
                            [style.background]="colorFor(r.category)"
                          ></span>
                          {{ labelFor(r.category) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 sm:px-5">{{ r.title }}</td>
                      <td class="px-4 py-3 whitespace-nowrap sm:px-5">
                        {{ r.duration ?? '—' }}
                        @if (r.days != null) {
                          <span class="text-muted">({{ r.days }})</span>
                        }
                      </td>
                      <td class="px-4 py-3 sm:px-5">
                        <ui-badge [tone]="r.status === 'complete' ? 'success' : 'warning'">
                          {{ r.status === 'complete' ? 'Complete' : 'Needs review' }}
                        </ui-badge>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </ui-card>
        }

        <p class="mt-6 text-center text-xs text-muted">
          MyAlibi share link · read-only · for reconciliation only
        </p>
        <app-footer class="mt-6" />
      }
    </div>
  `,
})
export class HrShareViewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly shares = inject(HrShareService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly snapshot = signal<HrShareSnapshotOk | null>(null);

  protected readonly kind = signal<KindFilter>('all');
  protected readonly category = signal('');
  protected readonly duration = signal('');
  protected readonly month = signal('');

  protected readonly kindFilters: { id: KindFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'leave', label: 'Leave' },
    { id: 'wfh', label: 'WFH' },
  ];

  protected readonly durations: LeaveDuration[] = ['Full Day', 'Half Day'];

  protected readonly balances = computed(() => this.snapshot()?.balances ?? []);
  protected readonly allRecords = computed(() => this.snapshot()?.records ?? []);

  protected readonly fyLabel = computed(() => {
    const snap = this.snapshot();
    if (!snap) {
      return '';
    }
    return fiscalYearLabel({ start: snap.period_start, end: snap.period_end });
  });

  /** Categories that appear in this snapshot (records or balances). */
  protected readonly categoryOptions = computed(() => {
    const ids = new Set<string>();
    for (const b of this.balances()) {
      ids.add(normalizeCategory(b.category as LeaveCategory));
    }
    for (const r of this.allRecords()) {
      ids.add(normalizeCategory(r.category as LeaveCategory));
    }
    return [...ids].sort((a, b) => this.labelFor(a).localeCompare(this.labelFor(b)));
  });

  protected readonly hasFilters = computed(
    () => !!(this.kind() !== 'all' || this.category() || this.duration() || this.month()),
  );

  protected readonly filterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.kind() === 'leave') chips.push({ key: 'kind', label: 'Leave only' });
    if (this.kind() === 'wfh') chips.push({ key: 'kind', label: 'WFH only' });
    if (this.category()) chips.push({ key: 'category', label: this.labelFor(this.category()) });
    if (this.duration() === 'none') chips.push({ key: 'duration', label: 'Needs review' });
    else if (this.duration()) chips.push({ key: 'duration', label: this.duration() });
    if (this.month()) chips.push({ key: 'month', label: `Month: ${this.month()}` });
    return chips;
  });

  protected readonly filteredRecords = computed(() => {
    const kind = this.kind();
    const category = this.category();
    const duration = this.duration();
    const month = this.month();

    return this.allRecords().filter((r) => {
      const cat = normalizeCategory(r.category as LeaveCategory);
      const isWfh = cat === 'Work From Home';

      if (kind === 'wfh' && !isWfh) return false;
      if (kind === 'leave' && isWfh) return false;
      if (category && cat !== category) return false;

      if (duration === 'none') {
        if (r.duration) return false;
      } else if (duration && r.duration !== duration) {
        return false;
      }

      if (month && !r.date.startsWith(month)) return false;
      return true;
    });
  });

  constructor() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.load(token);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setKind(next: KindFilter): void {
    this.kind.set(next);
    // Kind and a specific opposing category conflict — clear category when switching kinds.
    const cat = this.category();
    if (!cat) return;
    const isWfh = cat === 'Work From Home';
    if (next === 'wfh' && !isWfh) this.category.set('');
    if (next === 'leave' && isWfh) this.category.set('');
  }

  protected clearFilters(): void {
    this.kind.set('all');
    this.category.set('');
    this.duration.set('');
    this.month.set('');
  }

  protected clearChip(key: string): void {
    switch (key) {
      case 'kind':
        this.kind.set('all');
        break;
      case 'category':
        this.category.set('');
        break;
      case 'duration':
        this.duration.set('');
        break;
      case 'month':
        this.month.set('');
        break;
    }
  }

  protected labelFor(category: string): string {
    if (!isLeaveCategory(category)) {
      return category;
    }
    return categoryMeta(category).label;
  }

  protected colorFor(category: string): string {
    if (!isLeaveCategory(category)) {
      return 'var(--muted-foreground)';
    }
    return categoryMeta(category).color;
  }

  protected trackRecord(index: number, row: HrShareRecord): string {
    return `${row.date}-${row.category}-${row.title}-${index}`;
  }

  private async load(token: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const snap = await this.shares.fetchSnapshot(token);
      if (!snap.ok) {
        this.error.set(true);
        this.snapshot.set(null);
        return;
      }
      this.snapshot.set(snap);
    } catch {
      this.error.set(true);
      this.snapshot.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
