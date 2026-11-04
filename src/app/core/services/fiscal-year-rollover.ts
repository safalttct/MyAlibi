import {
  CATEGORIES,
  CategoryMeta,
  LeaveAllocation,
  LeaveAllocationInput,
  LeaveBalance,
  LeaveCategory,
  normalizeCategory,
} from '../models/leave.models';
import { DateRange, fiscalYearLabel, previousFiscalYear } from '../utils/dates';

export interface RolloverDraft {
  input: LeaveAllocationInput;
  /** Human-readable note for UI / logs. */
  note: string;
}

export interface BuildRolloverOptions {
  /** Categories to seed. Defaults to all CATEGORIES. */
  categories?: readonly CategoryMeta[];
  /**
   * When true (default), remaining days from the previous FY become
   * carry-forward / opening balance on the new FY.
   */
  carryRemaining?: boolean;
}

function remainingFor(
  category: LeaveCategory,
  balances: readonly LeaveBalance[],
  previous: DateRange,
): number {
  const id = normalizeCategory(category);
  const row = balances.find(
    (b) =>
      normalizeCategory(b.category) === id &&
      b.period_start === previous.start &&
      b.period_end === previous.end,
  );
  if (!row) {
    return 0;
  }
  return Math.max(0, Number(row.remaining) || 0);
}

function previousAllocation(
  category: LeaveCategory,
  allocations: readonly LeaveAllocation[],
  previous: DateRange,
): LeaveAllocation | undefined {
  const id = normalizeCategory(category);
  return allocations.find(
    (a) =>
      normalizeCategory(a.category) === id &&
      a.period_start === previous.start &&
      a.period_end === previous.end,
  );
}

/**
 * Builds allocation rows for `target` FY from the previous year's allocations/balances.
 * Pure — does not write to the database.
 *
 * Rules:
 * - Comp Off: no carry (HR); opening 0, annual 0
 * - LOP / discretionary: annual from previous or default; no carry
 * - Carry Forward Leave: previous remaining → opening_balance
 * - Other standard types: previous annual (or default); remaining → carry_forward_allocation
 */
export function buildNextYearAllocations(
  target: DateRange,
  allocations: readonly LeaveAllocation[],
  balances: readonly LeaveBalance[],
  options: BuildRolloverOptions = {},
): RolloverDraft[] {
  const categories = options.categories ?? CATEGORIES;
  const carryRemaining = options.carryRemaining !== false;
  const previous = previousFiscalYear(target);
  const drafts: RolloverDraft[] = [];

  for (const meta of categories) {
    const prev = previousAllocation(meta.id, allocations, previous);
    const remaining = carryRemaining ? remainingFor(meta.id, balances, previous) : 0;
    const annualFromPrev = prev ? Number(prev.annual_allocation) || 0 : meta.defaultAnnual;

    if (meta.allocationMode === 'comp') {
      drafts.push({
        input: {
          category: meta.id,
          period_start: target.start,
          period_end: target.end,
          opening_balance: 0,
          annual_allocation: 0,
          carry_forward_allocation: 0,
          carry_forward_expiry: null,
        },
        note: `${meta.label}: new ${fiscalYearLabel(target)} — Comp Off does not carry forward`,
      });
      continue;
    }

    if (meta.allocationMode === 'unpaid') {
      drafts.push({
        input: {
          category: meta.id,
          period_start: target.start,
          period_end: target.end,
          opening_balance: 0,
          annual_allocation: 0,
          carry_forward_allocation: 0,
          carry_forward_expiry: null,
        },
        note: `${meta.label}: unpaid tracking reset for ${fiscalYearLabel(target)}`,
      });
      continue;
    }

    if (meta.id === 'Carry Forward Leave') {
      drafts.push({
        input: {
          category: meta.id,
          period_start: target.start,
          period_end: target.end,
          opening_balance: remaining,
          annual_allocation: 0,
          carry_forward_allocation: 0,
          carry_forward_expiry: null,
        },
        note:
          remaining > 0
            ? `${meta.label}: carried ${remaining} day(s) as opening balance`
            : `${meta.label}: no remaining days to carry`,
      });
      continue;
    }

    if (meta.allocationMode === 'discretionary') {
      drafts.push({
        input: {
          category: meta.id,
          period_start: target.start,
          period_end: target.end,
          opening_balance: 0,
          annual_allocation: annualFromPrev,
          carry_forward_allocation: 0,
          carry_forward_expiry: null,
        },
        note: `${meta.label}: budget ${annualFromPrev} for ${fiscalYearLabel(target)} (no auto carry)`,
      });
      continue;
    }

    // standard: Annual, Sick, WFH, Paternity, …
    drafts.push({
      input: {
        category: meta.id,
        period_start: target.start,
        period_end: target.end,
        opening_balance: 0,
        annual_allocation: annualFromPrev || meta.defaultAnnual,
        carry_forward_allocation: remaining,
        carry_forward_expiry: null,
      },
      note:
        remaining > 0
          ? `${meta.label}: entitlement ${annualFromPrev || meta.defaultAnnual}, carried ${remaining} day(s)`
          : `${meta.label}: entitlement ${annualFromPrev || meta.defaultAnnual} for ${fiscalYearLabel(target)}`,
    });
  }

  return drafts;
}

/** True when at least one allocation already exists for the period. */
export function periodHasAllocations(
  allocations: readonly LeaveAllocation[],
  period: DateRange,
): boolean {
  return allocations.some((a) => a.period_start === period.start && a.period_end === period.end);
}

/** Distinct FY periods present in allocations, newest first. */
export function listAllocationPeriods(allocations: readonly LeaveAllocation[]): DateRange[] {
  const seen = new Map<string, DateRange>();
  for (const a of allocations) {
    const key = `${a.period_start}|${a.period_end}`;
    if (!seen.has(key)) {
      seen.set(key, { start: a.period_start, end: a.period_end });
    }
  }
  return [...seen.values()].sort((a, b) => b.start.localeCompare(a.start));
}
