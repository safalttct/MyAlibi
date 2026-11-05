import {
  CATEGORIES,
  CompOffTransaction,
  LeaveAllocation,
  LeaveCategory,
  LeaveDuration,
  LeaveRecord,
  MonthlyUsageRow,
  durationToDays,
} from '../models/leave.models';
import { addDaysIso, daysBetweenIso, fiscalYearRange, inRange, todayIso } from '../utils/dates';

/** Comp Off is valid for 90 days after PM approval / earn date. */
export const COMP_OFF_VALIDITY_DAYS = 90;

/** Dashboard / summary window for “expiring soon” alerts (same as validity). */
export const COMP_OFF_EXPIRY_ALERT_DAYS = COMP_OFF_VALIDITY_DAYS;

/** Minimal record shape needed for calculations (lets tests pass partial objects). */
export type CalcRecord = Pick<LeaveRecord, 'category' | 'date' | 'duration' | 'status'>;
export type CalcAllocation = Pick<
  LeaveAllocation,
  | 'category'
  | 'period_start'
  | 'period_end'
  | 'opening_balance'
  | 'annual_allocation'
  | 'carry_forward_allocation'
  | 'carry_forward_expiry'
>;
export type CalcTransaction = Pick<
  CompOffTransaction,
  'type' | 'days' | 'expiry_date' | 'transaction_date'
>;

export interface ComputedBalance {
  category: LeaveCategory;
  period_start: string;
  period_end: string;
  total_available: number;
  used: number;
  remaining: number;
  usage_percent: number;
  is_negative: boolean;
  opening_balance: number;
  annual_allocation: number;
  carry_forward_allocation: number;
  carry_forward_expiry: string | null;
}

export const COMP_OFF: LeaveCategory = 'Compensatory Leave';
export const WFH: LeaveCategory = 'Work From Home';

export function daysFromDuration(duration: LeaveDuration | null | undefined): number {
  return durationToDays(duration);
}

/** Only complete records with a duration count towards usage. */
export function isCountable(record: CalcRecord): boolean {
  return record.status === 'complete' && record.duration !== null;
}

export function recordDays(record: CalcRecord): number {
  return isCountable(record) ? daysFromDuration(record.duration) : 0;
}

/** Percentage 0..n (rounded to 1 dp). Safe for zero totals. */
export function usagePercent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total)) {
    return 0;
  }
  if (total <= 0) {
    return used > 0 ? 100 : 0;
  }
  return Math.round((used / total) * 1000) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function effectiveCarryForward(
  allocation: Pick<CalcAllocation, 'carry_forward_allocation' | 'carry_forward_expiry'>,
  asOf: string,
): number {
  if (allocation.carry_forward_allocation === 0) {
    return 0;
  }
  if (!allocation.carry_forward_expiry || allocation.carry_forward_expiry >= asOf) {
    return allocation.carry_forward_allocation;
  }
  return 0;
}

/** Signed ledger effect of a comp-off transaction as of a date (mirrors DB). */
export function compOffSignedDays(tx: CalcTransaction, asOf: string): number {
  switch (tx.type) {
    case 'earned':
      return !tx.expiry_date || tx.expiry_date >= asOf ? tx.days : 0;
    case 'used':
      return -tx.days;
    case 'adjustment':
      return tx.days;
    default:
      return 0;
  }
}

function makeBalance(
  base: CalcAllocation,
  totalAvailable: number,
  used: number,
  remaining: number,
  carry: number,
): ComputedBalance {
  return {
    category: base.category,
    period_start: base.period_start,
    period_end: base.period_end,
    total_available: round1(totalAvailable),
    used: round1(used),
    remaining: round1(remaining),
    usage_percent: usagePercent(used, totalAvailable),
    is_negative: remaining < 0,
    opening_balance: base.opening_balance,
    annual_allocation: base.annual_allocation,
    carry_forward_allocation: carry,
    carry_forward_expiry: base.carry_forward_expiry,
  };
}

/** Compensatory leave balance is derived from the FY ledger (+ that year's opening). */
export function computeCompOffBalance(
  allocation: CalcAllocation | undefined,
  transactions: readonly CalcTransaction[],
  asOf: string = todayIso(),
): ComputedBalance {
  const range = fiscalYearRange(new Date(`${asOf}T00:00:00`));
  const base: CalcAllocation = allocation ?? {
    category: COMP_OFF,
    period_start: range.start,
    period_end: range.end,
    opening_balance: 0,
    annual_allocation: 0,
    carry_forward_allocation: 0,
    carry_forward_expiry: null,
  };

  let earnedAndPositive = 0;
  let used = 0;
  let signed = 0;
  for (const tx of transactions) {
    if (!inRange(tx.transaction_date, base.period_start, base.period_end)) {
      continue;
    }
    if (tx.type === 'earned' && (!tx.expiry_date || tx.expiry_date >= asOf)) {
      earnedAndPositive += tx.days;
    } else if (tx.type === 'adjustment' && tx.days > 0) {
      earnedAndPositive += tx.days;
    } else if (tx.type === 'used') {
      used += tx.days;
    }
    signed += compOffSignedDays(tx, asOf);
  }

  return makeBalance(
    base,
    base.opening_balance + earnedAndPositive,
    used,
    base.opening_balance + signed,
    base.carry_forward_allocation,
  );
}

export interface ComputeBalancesOptions {
  asOf?: string;
  /** Comp-off ledger. Comp-off never uses leave records, only this ledger. */
  compOffTransactions?: readonly CalcTransaction[];
}

/**
 * Balances per allocation row.
 * - needs_review records never count.
 * - Compensatory Leave comes from the ledger only.
 * - Zero allocations are safe (usage percent never divides by zero).
 */
export function computeBalances(
  allocations: readonly CalcAllocation[],
  records: readonly CalcRecord[],
  options: ComputeBalancesOptions = {},
): ComputedBalance[] {
  const asOf = options.asOf ?? todayIso();
  const results: ComputedBalance[] = [];

  for (const allocation of allocations) {
    if (allocation.category === COMP_OFF) {
      results.push(computeCompOffBalance(allocation, options.compOffTransactions ?? [], asOf));
      continue;
    }

    const carry = effectiveCarryForward(allocation, asOf);
    const total = allocation.opening_balance + allocation.annual_allocation + carry;
    let used = 0;
    for (const record of records) {
      if (
        record.category === allocation.category &&
        inRange(record.date, allocation.period_start, allocation.period_end)
      ) {
        used += recordDays(record);
      }
    }
    results.push(makeBalance(allocation, total, used, total - used, carry));
  }

  return results;
}

/** Records that are leave (everything except Work From Home). */
export function leaveOnly<T extends Pick<CalcRecord, 'category'>>(records: readonly T[]): T[] {
  return records.filter((r) => r.category !== WFH);
}

export function wfhOnly<T extends Pick<CalcRecord, 'category'>>(records: readonly T[]): T[] {
  return records.filter((r) => r.category === WFH);
}

/** WFH is tracked separately from leave when summarising usage. */
export function summarizeUsage(records: readonly CalcRecord[]): { wfhDays: number; leaveDays: number } {
  let wfhDays = 0;
  let leaveDays = 0;
  for (const record of records) {
    const days = recordDays(record);
    if (record.category === WFH) {
      wfhDays += days;
    } else {
      leaveDays += days;
    }
  }
  return { wfhDays, leaveDays };
}

/** Days per month (yyyy-MM-01) and category, complete records only. */
export function monthlyUsage(
  records: readonly CalcRecord[],
  range?: { start: string; end: string },
): MonthlyUsageRow[] {
  const map = new Map<string, MonthlyUsageRow>();
  for (const record of records) {
    const days = recordDays(record);
    if (days === 0) {
      continue;
    }
    if (range && !inRange(record.date, range.start, range.end)) {
      continue;
    }
    const month = `${record.date.slice(0, 7)}-01`;
    const key = `${month}|${record.category}`;
    const existing = map.get(key);
    if (existing) {
      existing.used_days += days;
    } else {
      map.set(key, { month, category: record.category, used_days: days });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category),
  );
}

export function negativeWarnings(balances: readonly Pick<ComputedBalance, 'category' | 'remaining'>[]): string[] {
  return balances
    .filter((b) => b.remaining < 0)
    .map(
      (b) =>
        `${b.category} is over its allocation by ${Math.abs(round1(b.remaining))} day(s).`,
    );
}

export interface ExpiringCompOffLot {
  days: number;
  expiry_date: string;
  transaction_date: string;
  days_until_expiry: number;
}

/**
 * Earned Comp Off lots that are still valid and expire within `withinDays`.
 * (Does not FIFO-split against uses — same approach as the Comp Off summary card.)
 */
export function expiringCompOffLots(
  transactions: readonly CalcTransaction[],
  asOf: string = todayIso(),
  withinDays: number = COMP_OFF_EXPIRY_ALERT_DAYS,
): ExpiringCompOffLot[] {
  const until = addDaysIso(asOf, withinDays);
  return transactions
    .filter(
      (t) =>
        t.type === 'earned' &&
        t.expiry_date != null &&
        t.expiry_date >= asOf &&
        t.expiry_date <= until &&
        t.days > 0,
    )
    .map((t) => ({
      days: Number(t.days),
      expiry_date: t.expiry_date as string,
      transaction_date: t.transaction_date,
      days_until_expiry: daysBetweenIso(asOf, t.expiry_date as string),
    }))
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
}

export function defaultCompOffExpiry(earnDate: string = todayIso()): string {
  return addDaysIso(earnDate, COMP_OFF_VALIDITY_DAYS);
}

export interface LedgerRow {
  transaction: CompOffTransaction;
  delta: number;
  running: number;
  expired: boolean;
}

/** Ledger rows in chronological order with running balance (opening balance included). */
export function buildCompOffLedger(
  transactions: readonly CompOffTransaction[],
  openingBalance: number,
  asOf: string = todayIso(),
  period?: { start: string; end: string },
): LedgerRow[] {
  const scoped = period
    ? transactions.filter((t) => inRange(t.transaction_date, period.start, period.end))
    : transactions;
  const sorted = [...scoped].sort(
    (a, b) =>
      a.transaction_date.localeCompare(b.transaction_date) ||
      a.created_at.localeCompare(b.created_at),
  );
  let running = openingBalance;
  return sorted.map((transaction) => {
    const delta = compOffSignedDays(transaction, asOf);
    running = round1(running + delta);
    return {
      transaction,
      delta,
      running,
      expired:
        transaction.type === 'earned' &&
        transaction.expiry_date !== null &&
        transaction.expiry_date < asOf,
    };
  });
}

export function categoryLabelShort(category: LeaveCategory): string {
  return CATEGORIES.find((c) => c.id === category)?.short ?? category;
}
