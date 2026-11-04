import { LeaveAllocation, LeaveBalance } from '../models/leave.models';
import {
  buildNextYearAllocations,
  listAllocationPeriods,
  periodHasAllocations,
} from './fiscal-year-rollover';

const FY2627 = { start: '2026-04-01', end: '2027-03-31' };
const FY2728 = { start: '2027-04-01', end: '2028-03-31' };

function allocation(
  category: LeaveAllocation['category'],
  period: { start: string; end: string },
  annual: number,
  opening = 0,
): LeaveAllocation {
  return {
    id: `${category}-${period.start}`,
    user_id: 'u1',
    category,
    period_start: period.start,
    period_end: period.end,
    opening_balance: opening,
    annual_allocation: annual,
    carry_forward_allocation: 0,
    carry_forward_expiry: null,
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function balance(
  category: LeaveBalance['category'],
  period: { start: string; end: string },
  remaining: number,
  annual = 12,
): LeaveBalance {
  return {
    category,
    period_start: period.start,
    period_end: period.end,
    total_available: annual,
    used: annual - remaining,
    remaining,
    usage_percent: 0,
    is_negative: remaining < 0,
    opening_balance: 0,
    annual_allocation: annual,
    carry_forward_allocation: 0,
    carry_forward_expiry: null,
  };
}

describe('fiscal-year-rollover', () => {
  it('periodHasAllocations detects existing FY rows', () => {
    const rows = [allocation('Casual Leave', FY2627, 12)];
    expect(periodHasAllocations(rows, FY2627)).toBe(true);
    expect(periodHasAllocations(rows, FY2728)).toBe(false);
  });

  it('listAllocationPeriods returns unique periods newest first', () => {
    const rows = [
      allocation('Casual Leave', FY2627, 12),
      allocation('Sick Leave', FY2627, 12),
      allocation('Casual Leave', FY2728, 12),
    ];
    expect(listAllocationPeriods(rows)).toEqual([FY2728, FY2627]);
  });

  it('carries remaining into carry_forward for standard leave', () => {
    const drafts = buildNextYearAllocations(
      FY2728,
      [allocation('Casual Leave', FY2627, 12)],
      [balance('Casual Leave', FY2627, 4)],
      {
        categories: [
          {
            id: 'Casual Leave',
            label: 'Casual Leave',
            short: 'Casual',
            colorVar: '--casual',
            color: 'var(--casual)',
            textClass: 'text-casual',
            softBgClass: 'bg-casual/15',
            dotClass: 'bg-casual',
            borderClass: 'border-casual/40',
            isWfh: false,
            defaultAnnual: 12,
            allocationMode: 'standard',
            defaultEnabled: true,
            policyHint: '',
          },
        ],
      },
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].input).toMatchObject({
      category: 'Casual Leave',
      period_start: FY2728.start,
      period_end: FY2728.end,
      annual_allocation: 12,
      carry_forward_allocation: 4,
      opening_balance: 0,
    });
  });

  it('does not carry Comp Off remaining', () => {
    const drafts = buildNextYearAllocations(
      FY2728,
      [allocation('Compensatory Leave', FY2627, 0, 2)],
      [balance('Compensatory Leave', FY2627, 2, 0)],
      {
        categories: [
          {
            id: 'Compensatory Leave',
            label: 'Compensatory Off',
            short: 'Comp Off',
            colorVar: '--comp',
            color: 'var(--comp)',
            textClass: 'text-comp',
            softBgClass: 'bg-comp/15',
            dotClass: 'bg-comp',
            borderClass: 'border-comp/40',
            isWfh: false,
            defaultAnnual: 0,
            allocationMode: 'comp',
            defaultEnabled: true,
            policyHint: '',
          },
        ],
      },
    );
    expect(drafts[0].input).toMatchObject({
      opening_balance: 0,
      annual_allocation: 0,
      carry_forward_allocation: 0,
    });
  });

  it('moves Carry Forward remaining into opening balance', () => {
    const drafts = buildNextYearAllocations(
      FY2728,
      [allocation('Carry Forward Leave', FY2627, 0, 5)],
      [balance('Carry Forward Leave', FY2627, 3, 0)],
      {
        categories: [
          {
            id: 'Carry Forward Leave',
            label: 'Carry Forward',
            short: 'Carry Fwd',
            colorVar: '--carry',
            color: 'var(--carry)',
            textClass: 'text-carry',
            softBgClass: 'bg-carry/15',
            dotClass: 'bg-carry',
            borderClass: 'border-carry/40',
            isWfh: false,
            defaultAnnual: 0,
            allocationMode: 'standard',
            defaultEnabled: true,
            policyHint: '',
          },
        ],
      },
    );
    expect(drafts[0].input).toMatchObject({
      opening_balance: 3,
      annual_allocation: 0,
      carry_forward_allocation: 0,
    });
  });
});
