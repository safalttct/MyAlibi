import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DateRange,
  fiscalYearLabel,
  fiscalYearRange,
  isSamePeriod,
  todayIso,
} from '../utils/dates';
import { AllocationService } from './allocation.service';
import { AuthService } from './auth.service';
import { BalanceService } from './balance.service';
import { CategoryPreferencesService } from './category-preferences.service';
import {
  buildNextYearAllocations,
  listAllocationPeriods,
  periodHasAllocations,
} from './fiscal-year-rollover';
import { SettingsService } from './settings.service';

const LAST_ENSURED_KEY = 'fiscal_year_last_ensured';

export interface FiscalYearEnsureResult {
  period: DateRange;
  created: boolean;
  notes: string[];
}

@Injectable({ providedIn: 'root' })
export class FiscalYearService {
  private readonly allocations = inject(AllocationService);
  private readonly balances = inject(BalanceService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly categoryPrefs = inject(CategoryPreferencesService);

  private readonly ensured = signal(false);
  private readonly lastResult = signal<FiscalYearEnsureResult | null>(null);
  private ensurePromise: Promise<FiscalYearEnsureResult | null> | null = null;

  /** Active fiscal year for “today”. */
  readonly currentPeriod = computed(() => fiscalYearRange(new Date(`${todayIso()}T00:00:00`)));
  readonly currentLabel = computed(() => fiscalYearLabel(this.currentPeriod()));
  readonly lastEnsureResult = this.lastResult.asReadonly();

  /**
   * Ensures the current FY has allocation rows.
   * If missing and a previous FY exists, seeds entitlements + carry-forward automatically.
   * Idempotent and safe to call on every app load.
   */
  ensureCurrentFiscalYear(): Promise<FiscalYearEnsureResult | null> {
    if (!this.auth.isAuthenticated()) {
      return Promise.resolve(null);
    }
    this.ensurePromise ??= this.runEnsure();
    return this.ensurePromise;
  }

  /** Available FY periods (from DB + always include current). Newest first. */
  async listPeriods(): Promise<DateRange[]> {
    const all = await this.allocations.list();
    const periods = listAllocationPeriods(all);
    const current = this.currentPeriod();
    if (!periods.some((p) => isSamePeriod(p, current))) {
      periods.unshift(current);
    }
    return periods;
  }

  private async runEnsure(): Promise<FiscalYearEnsureResult | null> {
    try {
      await this.categoryPrefs.ensureLoaded();
      const current = this.currentPeriod();
      const [allAllocations, allBalances] = await Promise.all([
        this.allocations.list(),
        this.balances.fetchBalances(),
      ]);

      if (periodHasAllocations(allAllocations, current)) {
        const result: FiscalYearEnsureResult = { period: current, created: false, notes: [] };
        this.lastResult.set(result);
        this.ensured.set(true);
        await this.markEnsured(current);
        return result;
      }

      const enabled = this.categoryPrefs.enabledCategories();
      const drafts = buildNextYearAllocations(current, allAllocations, allBalances, {
        categories: enabled.length > 0 ? enabled : undefined,
      });

      // If there was no previous year data at all, still seed defaults for enabled types.
      const notes: string[] = [];
      for (const draft of drafts) {
        await this.allocations.upsert(draft.input);
        notes.push(draft.note);
      }

      const result: FiscalYearEnsureResult = { period: current, created: true, notes };
      this.lastResult.set(result);
      this.ensured.set(true);
      await this.markEnsured(current);
      return result;
    } catch {
      this.ensurePromise = null;
      return null;
    }
  }

  private async markEnsured(period: DateRange): Promise<void> {
    try {
      await this.settings.setSetting(LAST_ENSURED_KEY, period.start);
    } catch {
      // Non-fatal — ensure still ran in-memory this session.
    }
  }
}
