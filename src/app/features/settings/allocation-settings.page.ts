import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideInfo } from '@lucide/angular';
import {
  CATEGORIES,
  CategoryMeta,
  LeaveAllocation,
  LeaveBalance,
} from '../../core/models/leave.models';
import { AllocationService } from '../../core/services/allocation.service';
import { BalanceService } from '../../core/services/balance.service';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { FiscalYearService } from '../../core/services/fiscal-year.service';
import { ToastService } from '../../core/services/toast.service';
import {
  DateRange,
  fiscalYearLabel,
  fiscalYearRange,
  isSamePeriod,
} from '../../core/utils/dates';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';
import { UiSwitch } from '../../shared/ui/ui-switch';

@Component({
  selector: 'app-allocation-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeader,
    SettingsTabs,
    UiCard,
    UiButton,
    UiField,
    UiInput,
    UiSkeleton,
    UiConfirmDialog,
    UiSwitch,
    UiSelect,
    LucideInfo,
  ],
  template: `
    <app-page-header title="Settings" subtitle="Allocations per leave category and period" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <ui-card class="mb-4" title="Financial year" [description]="fyDescription()">
      <div class="grid gap-4 sm:grid-cols-3">
        <ui-field label="Fiscal year">
          <select uiSelect [value]="periodKey()" (change)="onPeriodSelect(val($event))">
            @for (p of periodOptions(); track p.start) {
              <option [value]="p.start + '|' + p.end">
                {{ labelFor(p) }}{{ isCurrent(p) ? ' · current' : '' }}
              </option>
            }
          </select>
        </ui-field>
        <ui-field label="Period start">
          <input uiInput type="date" [value]="periodStart()" readonly class="opacity-80" />
        </ui-field>
        <ui-field label="Period end">
          <input uiInput type="date" [value]="periodEnd()" readonly class="opacity-80" />
        </ui-field>
      </div>
      <p class="mt-3 text-xs leading-relaxed text-muted">
        Leave years run Apr 1 – Mar 31. When a new year begins, MyAlibi opens it automatically and
        carries remaining days where policy allows (Comp Off does not carry). Past years stay available here.
      </p>
      @if (!isViewingCurrent()) {
        <div class="mt-3">
          <button uiButton variant="outline" size="sm" type="button" (click)="useFiscalYear()">
            Jump to current year
          </button>
        </div>
      }
    </ui-card>

    @if (error()) {
      <p class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
        {{ error() }}
      </p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
        @for (n of [1, 2, 3, 4]; track n) {
          <ui-skeleton class="h-48" />
        }
      </div>
    } @else {
      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
        @for (row of rows; track row.meta.id) {
          <div [class.opacity-60]="!prefs.isEnabled(row.meta.id)">
          <ui-card>
            <form [formGroup]="row.form" (ngSubmit)="save(row)" class="grid gap-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span class="size-2.5 shrink-0 rounded-full" [class]="row.meta.dotClass"></span>
                      {{ row.meta.label }}
                    </h2>
                    <button
                      type="button"
                      class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      [attr.aria-label]="'Policy info for ' + row.meta.label"
                      [attr.aria-expanded]="infoOpen() === row.meta.id"
                      (click)="toggleInfo(row.meta.id)"
                    >
                      <svg lucideInfo size="15" strokeWidth="1.75"></svg>
                    </button>
                    @if (balanceFor(row.meta); as b) {
                      <span
                        class="text-xs text-muted tabular-nums sm:ml-auto"
                        [class.text-danger]="b.is_negative"
                      >
                        Used {{ b.used }} · Remaining {{ b.remaining }}
                      </span>
                    }
                  </div>
                  @if (infoOpen() === row.meta.id) {
                    <p class="mt-2 rounded-lg border border-border bg-background/80 px-2.5 py-2 text-xs leading-relaxed text-muted">
                      {{ row.meta.policyHint }}
                      @if (row.meta.defaultAnnual > 0) {
                        <span class="mt-1 block text-muted-foreground">HR default: {{ row.meta.defaultAnnual }} days/year</span>
                      }
                    </p>
                  }
                </div>
                <ui-switch
                  class="mt-0.5 shrink-0"
                  [ariaLabel]="'Enable ' + row.meta.label"
                  [checked]="prefs.isEnabled(row.meta.id)"
                  (checkedChange)="onToggle(row.meta, $event)"
                />
              </div>

              @if (prefs.isEnabled(row.meta.id)) {
                <div class="grid gap-3 sm:grid-cols-2">
                  <ui-field label="Opening balance">
                    <input uiInput type="number" step="0.5" min="0" formControlName="opening_balance" />
                  </ui-field>
                  @if (row.meta.allocationMode === 'standard' || row.meta.allocationMode === 'discretionary') {
                    <ui-field
                      [label]="row.meta.allocationMode === 'discretionary' ? 'Budget (optional)' : 'Annual allocation'"
                    >
                      <input uiInput type="number" step="0.5" min="0" formControlName="annual_allocation" />
                    </ui-field>
                    <ui-field label="Carry forward">
                      <input uiInput type="number" step="0.5" min="0" formControlName="carry_forward_allocation" />
                    </ui-field>
                    <ui-field label="Carry forward expiry">
                      <input uiInput type="date" formControlName="carry_forward_expiry" />
                    </ui-field>
                  }
                  @if (row.meta.allocationMode === 'comp') {
                    <p class="text-xs text-muted sm:col-span-1 sm:self-end sm:pb-2">
                      Comp off is ledger-driven; set opening balance only.
                    </p>
                  }
                  @if (row.meta.allocationMode === 'unpaid') {
                    <p class="text-xs text-muted sm:col-span-1 sm:self-end sm:pb-2">
                      LOP is unpaid — keep allocation at 0 and log days as records.
                    </p>
                  }
                </div>

                <div class="flex justify-between gap-2">
                  <div>
                    @if (row.existing()) {
                      <button
                        uiButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        class="text-danger"
                        (click)="deleting.set(row)"
                      >
                        Remove
                      </button>
                    }
                  </div>
                  <button uiButton size="sm" type="submit" [loading]="row.saving()" [disabled]="!!periodError()">
                    {{ row.existing() ? 'Update' : 'Save' }}
                  </button>
                </div>
              } @else {
                <p class="text-xs text-muted">Off — hidden from dashboard and new records. Toggle on to edit allocations.</p>
              }
            </form>
          </ui-card>
          </div>
        }
      </div>
    }

    <ui-confirm-dialog
      [open]="deleting() !== null"
      title="Remove allocation?"
      message="This removes the allocation for the selected period. Records stay untouched."
      confirmLabel="Remove"
      (cancelled)="deleting.set(null)"
      (confirmed)="confirmDelete()"
    />
  `,
})
export class AllocationSettingsPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly allocations = inject(AllocationService);
  private readonly balanceService = inject(BalanceService);
  private readonly toast = inject(ToastService);
  protected readonly prefs = inject(CategoryPreferencesService);
  private readonly fiscalYear = inject(FiscalYearService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal<AllocationRow | null>(null);
  protected readonly infoOpen = signal<string | null>(null);

  private readonly fiscal = fiscalYearRange(new Date());
  protected readonly periodStart = signal(this.fiscal.start);
  protected readonly periodEnd = signal(this.fiscal.end);
  protected readonly periodOptions = signal<DateRange[]>([this.fiscal]);
  private readonly existing = signal<LeaveAllocation[]>([]);
  private readonly balances = signal<LeaveBalance[]>([]);

  protected readonly periodKey = computed(() => `${this.periodStart()}|${this.periodEnd()}`);
  protected readonly isViewingCurrent = computed(() =>
    isSamePeriod(
      { start: this.periodStart(), end: this.periodEnd() },
      this.fiscalYear.currentPeriod(),
    ),
  );
  protected readonly fyDescription = computed(() =>
    this.isViewingCurrent()
      ? `${fiscalYearLabel({ start: this.periodStart(), end: this.periodEnd() })} is the active leave year`
      : `Viewing ${fiscalYearLabel({ start: this.periodStart(), end: this.periodEnd() })} (not the active year)`,
  );

  protected readonly rows: AllocationRow[] = CATEGORIES.map((meta) => ({
    meta,
    existing: signal<LeaveAllocation | null>(null),
    saving: signal(false),
    form: this.fb.group({
      opening_balance: [0, [Validators.min(0)]],
      annual_allocation: [meta.defaultAnnual, [Validators.min(0)]],
      carry_forward_allocation: [0, [Validators.min(0)]],
      carry_forward_expiry: [''],
    }),
  }));

  constructor() {
    effect(() => {
      const start = this.periodStart();
      const end = this.periodEnd();
      const existing = this.existing();
      untracked(() => this.populate(start, end, existing));
    });
    void this.bootstrap();
  }

  protected periodError(): string | null {
    return this.periodStart() && this.periodEnd() && this.periodEnd() >= this.periodStart()
      ? null
      : 'End must be on or after start';
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected labelFor(period: DateRange): string {
    return fiscalYearLabel(period);
  }

  protected isCurrent(period: DateRange): boolean {
    return isSamePeriod(period, this.fiscalYear.currentPeriod());
  }

  protected onPeriodSelect(value: string): void {
    const [start, end] = value.split('|');
    if (start && end) {
      this.periodStart.set(start);
      this.periodEnd.set(end);
    }
  }

  protected useFiscalYear(): void {
    const range = this.fiscalYear.currentPeriod();
    this.periodStart.set(range.start);
    this.periodEnd.set(range.end);
  }

  protected toggleInfo(id: string): void {
    this.infoOpen.update((current) => (current === id ? null : id));
  }

  protected balanceFor(meta: CategoryMeta): LeaveBalance | null {
    return (
      this.balances().find(
        (b) =>
          b.category === meta.id &&
          b.period_start === this.periodStart() &&
          b.period_end === this.periodEnd(),
      ) ?? null
    );
  }

  protected async onToggle(meta: CategoryMeta, enabled: boolean): Promise<void> {
    try {
      await this.prefs.setEnabled(meta.id, enabled);
      this.toast.success(enabled ? `${meta.label} enabled` : `${meta.label} hidden`);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not update leave type.');
    }
  }

  private populate(start: string, end: string, existing: LeaveAllocation[]): void {
    for (const row of this.rows) {
      const match =
        existing.find(
          (a) => a.category === row.meta.id && a.period_start === start && a.period_end === end,
        ) ?? null;
      row.existing.set(match);
      row.form.reset({
        opening_balance: match?.opening_balance ?? 0,
        annual_allocation: match?.annual_allocation ?? row.meta.defaultAnnual,
        carry_forward_allocation: match?.carry_forward_allocation ?? 0,
        carry_forward_expiry: match?.carry_forward_expiry ?? '',
      });
    }
  }

  private async bootstrap(): Promise<void> {
    await this.prefs.ensureLoaded();
    await this.fiscalYear.ensureCurrentFiscalYear();
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const [existing, balances, periods] = await Promise.all([
        this.allocations.list(),
        this.balanceService.fetchBalances(),
        this.fiscalYear.listPeriods(),
      ]);
      this.balances.set(balances);
      this.existing.set(existing);
      this.periodOptions.set(periods);
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load allocations.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(row: AllocationRow): Promise<void> {
    if (!this.prefs.isEnabled(row.meta.id)) {
      return;
    }
    row.form.markAllAsTouched();
    if (row.form.invalid || this.periodError() || row.saving()) {
      return;
    }
    const v = row.form.getRawValue();
    row.saving.set(true);
    try {
      const isComp = row.meta.allocationMode === 'comp';
      const isUnpaid = row.meta.allocationMode === 'unpaid';
      await this.allocations.upsert({
        category: row.meta.id,
        period_start: this.periodStart(),
        period_end: this.periodEnd(),
        opening_balance: Number(v.opening_balance) || 0,
        annual_allocation: isComp || isUnpaid ? 0 : Number(v.annual_allocation) || 0,
        carry_forward_allocation: isComp || isUnpaid ? 0 : Number(v.carry_forward_allocation) || 0,
        carry_forward_expiry: isComp || isUnpaid ? null : v.carry_forward_expiry || null,
      });
      this.toast.success(`${row.meta.label} allocation saved`);
      await this.load();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not save the allocation.');
    } finally {
      row.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const row = this.deleting();
    const existing = row?.existing();
    if (!existing) {
      this.deleting.set(null);
      return;
    }
    try {
      await this.allocations.delete(existing.id);
      this.toast.success('Allocation removed');
      this.deleting.set(null);
      await this.load();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not remove the allocation.');
    }
  }
}

interface AllocationRow {
  meta: CategoryMeta;
  existing: WritableSignal<LeaveAllocation | null>;
  saving: WritableSignal<boolean>;
  form: FormGroup<{
    opening_balance: FormControl<number>;
    annual_allocation: FormControl<number>;
    carry_forward_allocation: FormControl<number>;
    carry_forward_expiry: FormControl<string>;
  }>;
}
