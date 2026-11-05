import { Injectable } from '@angular/core';
import {
  CalcAllocation,
  CalcRecord,
  CalcTransaction,
  ComputeBalancesOptions,
  ComputedBalance,
  LedgerRow,
  buildCompOffLedger,
  computeBalances,
  computeCompOffBalance,
  daysFromDuration,
  leaveOnly,
  monthlyUsage,
  negativeWarnings,
  summarizeUsage,
  usagePercent,
  wfhOnly,
} from './leave-calculation';
import { CompOffTransaction, LeaveDuration, MonthlyUsageRow } from '../models/leave.models';

/** Injectable facade over the pure functions in `leave-calculation.ts`. */
@Injectable({ providedIn: 'root' })
export class LeaveCalculationService {
  daysFromDuration(duration: LeaveDuration | null | undefined): number {
    return daysFromDuration(duration);
  }

  computeBalances(
    allocations: readonly CalcAllocation[],
    records: readonly CalcRecord[],
    options?: ComputeBalancesOptions,
  ): ComputedBalance[] {
    return computeBalances(allocations, records, options);
  }

  computeCompOffBalance(
    allocation: CalcAllocation | undefined,
    transactions: readonly CalcTransaction[],
    asOf?: string,
  ): ComputedBalance {
    return computeCompOffBalance(allocation, transactions, asOf);
  }

  monthlyUsage(
    records: readonly CalcRecord[],
    range?: { start: string; end: string },
  ): MonthlyUsageRow[] {
    return monthlyUsage(records, range);
  }

  usagePercent(used: number, total: number): number {
    return usagePercent(used, total);
  }

  negativeWarnings(balances: readonly Pick<ComputedBalance, 'category' | 'remaining'>[]): string[] {
    return negativeWarnings(balances);
  }

  summarizeUsage(records: readonly CalcRecord[]): { wfhDays: number; leaveDays: number } {
    return summarizeUsage(records);
  }

  leaveOnly<T extends Pick<CalcRecord, 'category'>>(records: readonly T[]): T[] {
    return leaveOnly(records);
  }

  wfhOnly<T extends Pick<CalcRecord, 'category'>>(records: readonly T[]): T[] {
    return wfhOnly(records);
  }

  compOffLedger(
    transactions: readonly CompOffTransaction[],
    openingBalance: number,
    asOf?: string,
    period?: { start: string; end: string },
  ): LedgerRow[] {
    return buildCompOffLedger(transactions, openingBalance, asOf, period);
  }
}
