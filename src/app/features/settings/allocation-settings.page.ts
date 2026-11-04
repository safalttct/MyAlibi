import { ChangeDetectionStrategy, Component, WritableSignal, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CATEGORIES,
  CategoryMeta,
  LeaveAllocation,
  LeaveBalance,
} from '../../core/models/leave.models';
import { AllocationService } from '../../core/services/allocation.service';
import { BalanceService } from '../../core/services/balance.service';
import { ToastService } from '../../core/services/toast.service';
import { fiscalYearRange } from '../../core/utils/dates';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

@Component({
  selector: 'app-allocation-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, SettingsTabs, UiCard, UiButton, UiField, UiInput, UiSkeleton, UiConfirmDialog],
  template: `
    <app-page-header title="Settings" subtitle="Allocations per leave category and period" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <ui-card class="mb-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <ui-field label="Period start"><input uiInput type="date" [value]="periodStart()" (input)="periodStart.set(val($event))" /></ui-field>
        <ui-field label="Period end" [error]="periodError()"><input uiInput type="date" [value]="periodEnd()" (input)="periodEnd.set(val($event))" /></ui-field>
        <div class="flex items-end">
          <button uiButton variant="outline" type="button" class="max-sm:w-full" (click)="useFiscalYear()">Current fiscal year (Apr–Mar)</button>
        </div>
      </div>
    </ui-card>

    @if (error()) {
      <p class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">@for (n of [1, 2, 3, 4]; track n) { <ui-skeleton class="h-56" /> }</div>
    } @else {
      <div class="grid gap-3 sm:gap-4 lg:grid-cols-2">
        @for (row of rows; track row.meta.id) {
          <ui-card>
            <form [formGroup]="row.form" (ngSubmit)="save(row)" class="grid gap-4">
              <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 class="flex items-center gap-2 text-sm font-semibold">
                  <span class="size-2.5 rounded-full" [class]="row.meta.dotClass"></span>{{ row.meta.label }}
                </h2>
                @if (balanceFor(row.meta); as b) {
                  <span class="text-xs text-muted tabular-nums" [class.text-danger]="b.is_negative">
                    Used {{ b.used }} · Remaining {{ b.remaining }}
                  </span>
                }
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <ui-field label="Opening balance"><input uiInput type="number" step="0.5" min="0" formControlName="opening_balance" /></ui-field>
                @if (row.meta.id !== 'Compensatory Leave') {
                  <ui-field label="Annual allocation"><input uiInput type="number" step="0.5" min="0" formControlName="annual_allocation" /></ui-field>
                  <ui-field label="Carry forward"><input uiInput type="number" step="0.5" min="0" formControlName="carry_forward_allocation" /></ui-field>
                  <ui-field label="Carry forward expiry"><input uiInput type="date" formControlName="carry_forward_expiry" /></ui-field>
                }
              </div>
              @if (row.meta.id === 'Compensatory Leave') {
                <p class="text-xs text-muted">Comp off is driven by the ledger; only the opening balance is set here.</p>
              }

              <div class="flex justify-between gap-2">
                <div>
                  @if (row.existing()) {
                    <button uiButton variant="ghost" size="sm" type="button" class="text-danger" (click)="deleting.set(row)">Remove</button>
                  }
                </div>
                <button uiButton size="sm" type="submit" [loading]="row.saving()" [disabled]="!!periodError()">
                  {{ row.existing() ? 'Update' : 'Save' }}
                </button>
              </div>
            </form>
          </ui-card>
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

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal<AllocationRow | null>(null);

  private readonly fiscal = fiscalYearRange(new Date());
  protected readonly periodStart = signal(this.fiscal.start);
  protected readonly periodEnd = signal(this.fiscal.end);
  private readonly existing = signal<LeaveAllocation[]>([]);
  private readonly balances = signal<LeaveBalance[]>([]);

  protected readonly rows: AllocationRow[] = CATEGORIES.map((meta) => ({
    meta,
    existing: signal<LeaveAllocation | null>(null),
    saving: signal(false),
    form: this.fb.group({
      opening_balance: [0, [Validators.min(0)]],
      annual_allocation: [0, [Validators.min(0)]],
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
    void this.load();
  }

  protected periodError(): string | null {
    return this.periodStart() && this.periodEnd() && this.periodEnd() >= this.periodStart()
      ? null
      : 'End must be on or after start';
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected useFiscalYear(): void {
    const range = fiscalYearRange(new Date());
    this.periodStart.set(range.start);
    this.periodEnd.set(range.end);
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

  private populate(start: string, end: string, existing: LeaveAllocation[]): void {
    for (const row of this.rows) {
      const match =
        existing.find(
          (a) => a.category === row.meta.id && a.period_start === start && a.period_end === end,
        ) ?? null;
      row.existing.set(match);
      row.form.reset({
        opening_balance: match?.opening_balance ?? 0,
        annual_allocation: match?.annual_allocation ?? 0,
        carry_forward_allocation: match?.carry_forward_allocation ?? 0,
        carry_forward_expiry: match?.carry_forward_expiry ?? '',
      });
    }
  }

  private async load(): Promise<void> {
    try {
      const [existing, balances] = await Promise.all([
        this.allocations.list(),
        this.balanceService.fetchBalances(),
      ]);
      this.balances.set(balances);
      this.existing.set(existing);
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load allocations.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(row: AllocationRow): Promise<void> {
    row.form.markAllAsTouched();
    if (row.form.invalid || this.periodError() || row.saving()) {
      return;
    }
    const v = row.form.getRawValue();
    row.saving.set(true);
    try {
      await this.allocations.upsert({
        category: row.meta.id,
        period_start: this.periodStart(),
        period_end: this.periodEnd(),
        opening_balance: Number(v.opening_balance) || 0,
        annual_allocation: row.meta.id === 'Compensatory Leave' ? 0 : Number(v.annual_allocation) || 0,
        carry_forward_allocation:
          row.meta.id === 'Compensatory Leave' ? 0 : Number(v.carry_forward_allocation) || 0,
        carry_forward_expiry: v.carry_forward_expiry || null,
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
