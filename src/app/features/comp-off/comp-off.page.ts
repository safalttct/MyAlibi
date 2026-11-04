import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideMinus, LucidePlus, LucideSlidersHorizontal, LucideTrash2 } from '@lucide/angular';
import { startWith } from 'rxjs';
import { CompOffTransaction, CompOffType, LeaveBalance } from '../../core/models/leave.models';
import { BalanceService } from '../../core/services/balance.service';
import { CompOffService } from '../../core/services/comp-off.service';
import { LeaveCalculationService } from '../../core/services/leave-calculation.service';
import { ToastService } from '../../core/services/toast.service';
import { todayIso } from '../../core/utils/dates';
import { PageHeader } from '../../shared/components/page-header';
import { UiBadge } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiDialog } from '../../shared/ui/ui-dialog';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

const nonZero = (control: AbstractControl): ValidationErrors | null =>
  Number(control.value) === 0 || control.value === null ? { nonZero: true } : null;

const TYPE_LABEL: Record<CompOffType, string> = {
  earned: 'Earn comp off',
  used: 'Use comp off',
  adjustment: 'Adjust balance',
};

@Component({
  selector: 'app-comp-off-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeader,
    UiCard,
    UiBadge,
    UiButton,
    UiDialog,
    UiConfirmDialog,
    UiEmptyState,
    UiField,
    UiInput,
    UiSkeleton,
    LucidePlus,
    LucideMinus,
    LucideSlidersHorizontal,
    LucideTrash2,
  ],
  template: `
    <app-page-header title="Comp Off" subtitle="Earn, use and adjust compensatory leave">
      <button uiButton size="sm" (click)="openForm('earned')"><svg lucidePlus size="14"></svg> Earn</button>
      <button uiButton variant="outline" size="sm" (click)="openForm('used')"><svg lucideMinus size="14"></svg> Use</button>
      <button uiButton variant="outline" size="sm" class="max-sm:basis-full" (click)="openForm('adjustment')">
        <svg lucideSlidersHorizontal size="14"></svg> Adjust
      </button>
    </app-page-header>

    @if (error()) {
      <p class="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ error() }}</p>
    }

    <section class="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <ui-card><p class="text-xs font-medium text-muted">Available</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums" [class]="summary().remaining < 0 ? 'text-danger' : 'text-comp'">{{ summary().remaining }}</p></ui-card>
      <ui-card><p class="text-xs font-medium text-muted">Credited</p><p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{{ summary().earned }}</p></ui-card>
      <ui-card><p class="text-xs font-medium text-muted">Used</p><p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{{ summary().used }}</p></ui-card>
      <ui-card><p class="text-xs font-medium text-muted">Expiring in 30 days</p><p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-warning">{{ summary().expiring }}</p></ui-card>
    </section>

    <ui-card title="Ledger" description="Newest first, with running balance" [padded]="false">
      @if (loading()) {
        <div class="space-y-2 p-3 sm:p-4">@for (n of [1, 2, 3, 4]; track n) { <ui-skeleton class="h-14 md:h-10" /> }</div>
      } @else if (ledger().length === 0) {
        <div class="p-4 sm:p-6">
          <ui-empty-state title="No comp-off activity" description="Record the days you earned to start the ledger.">
            <button uiButton size="sm" (click)="openForm('earned')"><svg lucidePlus size="14"></svg> Earn comp off</button>
          </ui-empty-state>
        </div>
      } @else {
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-y border-border bg-elevated/40 text-left text-xs text-muted">
                <th class="px-4 py-3 font-medium">Date</th>
                <th class="px-4 py-3 font-medium">Type</th>
                <th class="px-4 py-3 text-right font-medium">Days</th>
                <th class="px-4 py-3 text-right font-medium">Balance</th>
                <th class="px-4 py-3 font-medium">Expiry</th>
                <th class="px-4 py-3 font-medium">Notes</th>
                <th class="px-4 py-3 text-right font-medium"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @if (opening() !== 0) {
                <tr class="border-b border-border/60 text-muted"><td class="px-4 py-3" colspan="3">Opening balance</td><td class="px-4 py-3 text-right tabular-nums">{{ opening() }}</td><td colspan="3"></td></tr>
              }
              @for (row of ledgerDesc(); track row.transaction.id) {
                <tr class="border-b border-border/60 transition-colors last:border-0 hover:bg-card-hover">
                  <td class="px-4 py-3 whitespace-nowrap">{{ row.transaction.transaction_date | date: 'd MMM y' }}</td>
                  <td class="px-4 py-3">
                    <ui-badge [tone]="row.transaction.type === 'earned' ? 'success' : row.transaction.type === 'used' ? 'info' : 'neutral'">{{ row.transaction.type }}</ui-badge>
                    @if (row.transaction.leave_record_id) { <span class="ml-1 text-xs text-muted">via leave record</span> }
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums" [class]="row.delta < 0 ? 'text-danger' : row.delta > 0 ? 'text-success' : 'text-muted'">
                    {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
                  </td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums" [class]="row.running < 0 ? 'text-danger' : ''">{{ row.running }}</td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    @if (row.transaction.expiry_date) {
                      {{ row.transaction.expiry_date | date: 'd MMM y' }}
                      @if (row.expired) { <ui-badge tone="danger">expired</ui-badge> }
                    } @else { <span class="text-muted">–</span> }
                  </td>
                  <td class="max-w-56 truncate px-4 py-3 text-muted">{{ row.transaction.notes }}</td>
                  <td class="px-4 py-3 text-right">
                    @if (!row.transaction.leave_record_id) {
                      <button uiButton variant="ghost" size="icon" aria-label="Delete entry" (click)="deleting.set(row.transaction)"><svg lucideTrash2 size="14"></svg></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <ul class="divide-y divide-border md:hidden">
          @if (opening() !== 0) {
            <li class="flex items-center justify-between px-4 py-3 text-sm text-muted">
              <span>Opening balance</span><span class="tabular-nums">{{ opening() }}</span>
            </li>
          }
          @for (row of ledgerDesc(); track row.transaction.id) {
            <li class="flex items-start justify-between gap-2 py-3 pr-1 pl-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <ui-badge [tone]="row.transaction.type === 'earned' ? 'success' : row.transaction.type === 'used' ? 'info' : 'neutral'">{{ row.transaction.type }}</ui-badge>
                  <span class="text-sm font-medium tabular-nums" [class]="row.delta < 0 ? 'text-danger' : row.delta > 0 ? 'text-success' : 'text-muted'">
                    {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}d
                  </span>
                  @if (row.expired) { <ui-badge tone="danger">expired</ui-badge> }
                </div>
                <p class="mt-1 text-xs text-muted">
                  {{ row.transaction.transaction_date | date: 'd MMM y' }}
                  @if (row.transaction.expiry_date) { · expires {{ row.transaction.expiry_date | date: 'd MMM y' }} }
                  · balance <span class="font-medium tabular-nums" [class]="row.running < 0 ? 'text-danger' : 'text-foreground'">{{ row.running }}</span>
                </p>
                @if (row.transaction.notes) { <p class="mt-0.5 truncate text-xs text-muted">{{ row.transaction.notes }}</p> }
                @if (row.transaction.leave_record_id) { <p class="mt-0.5 text-xs text-muted">via leave record</p> }
              </div>
              @if (!row.transaction.leave_record_id) {
                <button uiButton variant="ghost" size="icon" class="shrink-0 hover:text-danger" aria-label="Delete entry" (click)="deleting.set(row.transaction)"><svg lucideTrash2 size="16"></svg></button>
              }
            </li>
          }
        </ul>
      }
    </ui-card>

    <ui-dialog [open]="formType() !== null" [title]="formTitle()" (closed)="formType.set(null)">
      <form [formGroup]="form" id="comp-off-form" class="grid gap-4" (ngSubmit)="submit()">
        <div class="grid gap-4 sm:grid-cols-2">
          <ui-field label="Date" [required]="true"><input uiInput type="date" formControlName="date" /></ui-field>
          <ui-field label="Days" [required]="true" [error]="daysError()"
            [hint]="formType() === 'adjustment' ? 'Use a negative number to deduct' : ''">
            <input uiInput type="number" step="0.5" formControlName="days" />
          </ui-field>
        </div>
        @if (formType() === 'earned') {
          <ui-field label="Expiry date" hint="Optional. Earned days stop counting after this date.">
            <input uiInput type="date" formControlName="expiry" />
          </ui-field>
        }
        <ui-field label="Notes"><textarea uiInput rows="2" formControlName="notes" placeholder="Optional"></textarea></ui-field>
        @if (formError()) {
          <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ formError() }}</p>
        }
      </form>
      <ng-container dialogFooter>
        <button uiButton variant="ghost" type="button" (click)="formType.set(null)">Cancel</button>
        <button uiButton type="submit" form="comp-off-form" [loading]="saving()">Save</button>
      </ng-container>
    </ui-dialog>

    <ui-confirm-dialog
      [open]="deleting() !== null"
      title="Delete ledger entry?"
      message="The balance will be recalculated without this entry."
      confirmLabel="Delete"
      [loading]="saving()"
      (cancelled)="deleting.set(null)"
      (confirmed)="confirmDelete()"
    />
  `,
})
export class CompOffPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly compOff = inject(CompOffService);
  private readonly balances = inject(BalanceService);
  private readonly calc = inject(LeaveCalculationService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly transactions = signal<CompOffTransaction[]>([]);
  private readonly balance = signal<LeaveBalance | null>(null);

  protected readonly formType = signal<CompOffType | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly deleting = signal<CompOffTransaction | null>(null);
  private readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    date: [todayIso(), Validators.required],
    days: [1, [Validators.required, nonZero]],
    expiry: [''],
    notes: [''],
  });

  private readonly daysValue = toSignal(
    this.form.controls.days.valueChanges.pipe(startWith(this.form.controls.days.value)),
    { initialValue: 1 },
  );

  protected readonly opening = computed(() => this.balance()?.opening_balance ?? 0);
  protected readonly ledger = computed(() =>
    this.calc.compOffLedger(this.transactions(), this.opening()),
  );
  protected readonly ledgerDesc = computed(() => [...this.ledger()].reverse());
  protected readonly formTitle = computed(() => TYPE_LABEL[this.formType() ?? 'earned']);

  protected readonly summary = computed(() => {
    const today = todayIso();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const soonIso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const bal = this.calc.computeCompOffBalance(
      { category: 'Compensatory Leave', period_start: `${today.slice(0, 4)}-01-01`, period_end: `${today.slice(0, 4)}-12-31`, opening_balance: this.opening(), annual_allocation: 0, carry_forward_allocation: 0, carry_forward_expiry: null },
      this.transactions(),
      today,
    );
    const expiring = this.transactions()
      .filter((t) => t.type === 'earned' && t.expiry_date && t.expiry_date >= today && t.expiry_date <= soonIso)
      .reduce((s, t) => s + t.days, 0);
    return {
      remaining: bal.remaining,
      earned: bal.total_available - this.opening(),
      used: bal.used,
      expiring,
    };
  });

  constructor() {
    effect(() => {
      this.formType();
      untracked(() => this.resetForm());
    });
    void this.load();
  }

  protected daysError(): string | null {
    const control = this.form.controls.days;
    if (!(control.touched || this.submitted())) {
      return null;
    }
    if (control.errors?.['required']) return 'Required';
    if (control.errors?.['nonZero']) return 'Enter a non-zero number';
    if (this.formType() !== 'adjustment' && this.daysValue() <= 0) return 'Must be greater than 0';
    return null;
  }

  protected openForm(type: CompOffType): void {
    this.formType.set(type);
  }

  private resetForm(): void {
    this.submitted.set(false);
    this.formError.set(null);
    this.form.reset({ date: todayIso(), days: 1, expiry: '', notes: '' });
  }

  protected async load(): Promise<void> {
    try {
      const [transactions, balances] = await Promise.all([this.compOff.list(), this.balances.fetchBalances()]);
      this.transactions.set(transactions);
      this.balance.set(balances.find((b) => b.category === 'Compensatory Leave') ?? null);
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load the comp-off ledger.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const type = this.formType();
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (!type || this.form.invalid || this.daysError() || this.saving()) {
      return;
    }
    const { date, days, expiry, notes } = this.form.getRawValue();
    if (type === 'used' && days > this.summary().remaining) {
      this.formError.set(`Only ${this.summary().remaining} day(s) available.`);
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      if (type === 'earned') {
        await this.compOff.earned({ date, days, expiry: expiry || null, notes });
      } else if (type === 'used') {
        await this.compOff.used({ date, days, notes });
      } else {
        await this.compOff.adjustment({ date, days, notes });
      }
      this.toast.success('Ledger updated');
      this.formType.set(null);
      await this.load();
    } catch (e) {
      this.formError.set(e instanceof Error ? e.message : 'Could not save the entry.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const tx = this.deleting();
    if (!tx) {
      return;
    }
    this.saving.set(true);
    try {
      await this.compOff.delete(tx.id);
      this.toast.success('Entry deleted');
      this.deleting.set(null);
      await this.load();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not delete the entry.');
    } finally {
      this.saving.set(false);
    }
  }
}
