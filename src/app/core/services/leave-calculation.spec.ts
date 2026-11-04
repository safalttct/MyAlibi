import { LeaveCalculationService } from './leave-calculation.service';
import {
  CalcAllocation,
  CalcRecord,
  computeBalances,
  daysFromDuration,
  monthlyUsage,
  negativeWarnings,
  summarizeUsage,
  usagePercent,
} from './leave-calculation';

const FY = { period_start: '2026-04-01', period_end: '2027-03-31' };

function allocation(category: CalcAllocation['category'], annual: number, extra: Partial<CalcAllocation> = {}): CalcAllocation {
  return {
    category,
    ...FY,
    opening_balance: 0,
    annual_allocation: annual,
    carry_forward_allocation: 0,
    carry_forward_expiry: null,
    ...extra,
  };
}

function record(category: CalcRecord['category'], date: string, duration: CalcRecord['duration'], status: CalcRecord['status'] = 'complete'): CalcRecord {
  return { category, date, duration, status };
}

describe('leave calculation', () => {
  it('derives days from duration', () => {
    expect(daysFromDuration('Full Day')).toBe(1);
    expect(daysFromDuration('Half Day')).toBe(0.5);
    expect(daysFromDuration(null)).toBe(0);
  });

  it('computes balances and excludes needs_review records', () => {
    const [casual] = computeBalances(
      [allocation('Annual Leave', 12)],
      [
        record('Annual Leave', '2026-05-01', 'Full Day'),
        record('Annual Leave', '2026-05-02', 'Half Day'),
        record('Annual Leave', '2026-05-03', null, 'needs_review'),
        record('Annual Leave', '2025-01-01', 'Full Day'), // outside the period
        record('Sick Leave', '2026-05-04', 'Full Day'), // other category
      ],
      { asOf: '2026-06-01' },
    );
    expect(casual.used).toBe(1.5);
    expect(casual.total_available).toBe(12);
    expect(casual.remaining).toBe(10.5);
    expect(casual.usage_percent).toBe(12.5);
    expect(casual.is_negative).toBe(false);
  });

  it('is safe for zero allocations', () => {
    expect(usagePercent(0, 0)).toBe(0);
    expect(usagePercent(2, 0)).toBe(100);
    const [wfh] = computeBalances([allocation('Work From Home', 0)], [record('Work From Home', '2026-05-01', 'Full Day')], {
      asOf: '2026-06-01',
    });
    expect(wfh.total_available).toBe(0);
    expect(wfh.usage_percent).toBe(100);
    expect(wfh.remaining).toBe(-1);
    expect(wfh.is_negative).toBe(true);
    expect(negativeWarnings([wfh])).toHaveLength(1);
  });

  it('adds opening balance and honours carry-forward expiry', () => {
    const base = allocation('Carry Forward Leave', 0, {
      opening_balance: 2,
      carry_forward_allocation: 5,
      carry_forward_expiry: '2026-09-30',
    });
    expect(computeBalances([base], [], { asOf: '2026-09-30' })[0].total_available).toBe(7);
    expect(computeBalances([base], [], { asOf: '2026-10-01' })[0].total_available).toBe(2);
  });

  it('calculates every category independently', () => {
    const balances = computeBalances(
      [
        allocation('Work From Home', 24),
        allocation('Annual Leave', 12),
        allocation('Sick Leave', 8),
        allocation('Carry Forward Leave', 3),
      ],
      [
        record('Work From Home', '2026-04-01', 'Full Day'),
        record('Annual Leave', '2026-04-30', 'Half Day'),
        record('Sick Leave', '2026-04-13', 'Full Day'),
        record('Carry Forward Leave', '2026-05-01', 'Full Day'),
      ],
      { asOf: '2026-06-01' },
    );
    expect(balances.map((b) => [b.category, b.used, b.remaining])).toEqual([
      ['Work From Home', 1, 23],
      ['Annual Leave', 0.5, 11.5],
      ['Sick Leave', 1, 7],
      ['Carry Forward Leave', 1, 2],
    ]);
  });

  it('derives Compensatory Leave from the ledger only', () => {
    const [comp] = computeBalances(
      [allocation('Compensatory Leave', 0, { opening_balance: 1 })],
      [record('Compensatory Leave', '2026-08-21', 'Full Day')], // ignored: ledger is the source of truth
      {
        asOf: '2026-09-01',
        compOffTransactions: [
          { type: 'earned', days: 3, expiry_date: null, transaction_date: '2026-07-01' },
          { type: 'earned', days: 2, expiry_date: '2026-08-01', transaction_date: '2026-06-01' }, // expired
          { type: 'used', days: 1, expiry_date: null, transaction_date: '2026-08-21' },
        ],
      },
    );
    expect(comp.total_available).toBe(4); // opening 1 + earned 3
    expect(comp.used).toBe(1);
    expect(comp.remaining).toBe(3);
  });

  it('computes monthly usage and separates WFH from leave', () => {
    const records: CalcRecord[] = [
      record('Work From Home', '2026-04-01', 'Full Day'),
      record('Work From Home', '2026-04-07', 'Half Day'),
      record('Annual Leave', '2026-04-30', 'Half Day'),
      record('Annual Leave', '2026-05-22', 'Full Day'),
      record('Sick Leave', '2026-05-12', null, 'needs_review'),
    ];
    expect(monthlyUsage(records)).toEqual([
      { month: '2026-04-01', category: 'Annual Leave', used_days: 0.5 },
      { month: '2026-04-01', category: 'Work From Home', used_days: 1.5 },
      { month: '2026-05-01', category: 'Annual Leave', used_days: 1 },
    ]);
    expect(monthlyUsage(records, { start: '2026-05-01', end: '2026-05-31' })).toHaveLength(1);
    expect(summarizeUsage(records)).toEqual({ wfhDays: 1.5, leaveDays: 1.5 });
  });

  it('exposes the same behaviour through the injectable service', () => {
    const service = new LeaveCalculationService();
    expect(service.daysFromDuration('Half Day')).toBe(0.5);
    expect(service.usagePercent(1, 4)).toBe(25);
  });
});
