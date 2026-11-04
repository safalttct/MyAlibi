import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideEye } from '@lucide/angular';
import {
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
import { UiCard } from '../../shared/ui/ui-card';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

type RecordFilter = 'all' | 'leave' | 'wfh';

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
    LucideEye,
  ],
  host: { class: 'block min-h-dvh bg-background' },
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
          <div class="flex gap-1 rounded-lg border border-border bg-card p-0.5">
            @for (f of filters; track f.id) {
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                [class]="
                  filter() === f.id
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                "
                (click)="filter.set(f.id)"
              >
                {{ f.label }}
              </button>
            }
          </div>
        </div>

        @if (filteredRecords().length === 0) {
          <ui-card>
            <ui-empty-state title="No records" description="Nothing matched this filter for the current year." />
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
  protected readonly filter = signal<RecordFilter>('all');

  protected readonly filters: { id: RecordFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'leave', label: 'Leave' },
    { id: 'wfh', label: 'WFH' },
  ];

  protected readonly balances = computed(() => this.snapshot()?.balances ?? []);
  protected readonly fyLabel = computed(() => {
    const snap = this.snapshot();
    if (!snap) {
      return '';
    }
    return fiscalYearLabel({ start: snap.period_start, end: snap.period_end });
  });

  protected readonly filteredRecords = computed(() => {
    const rows = this.snapshot()?.records ?? [];
    const mode = this.filter();
    if (mode === 'all') {
      return rows;
    }
    if (mode === 'wfh') {
      return rows.filter((r) => normalizeCategory(r.category as never) === 'Work From Home');
    }
    return rows.filter((r) => normalizeCategory(r.category as never) !== 'Work From Home');
  });

  constructor() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.load(token);
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
