import { parseLeaveCsv } from './csv-parse-leave';
import { reconcileLeaveRows } from './csv-reconcile';
import { ALL_CSV, FIRST_CSV } from './testing/leave-csv-fixtures';

describe('reconcileLeaveRows (bundled CSVs)', () => {
  const first = parseLeaveCsv(FIRST_CSV, 'first.csv');
  const second = parseLeaveCsv(ALL_CSV, 'all.csv');
  const result = reconcileLeaveRows([first.rows, second.rows]);

  it('parses both files without errors', () => {
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
  });

  it('produces exactly 29 unique rows: 28 complete and 1 needs_review', () => {
    expect(result.rows).toHaveLength(29);
    expect(result.completeCount).toBe(28);
    expect(result.needsReviewCount).toBe(1);
    expect(result.invalidCount).toBe(0);
  });

  it('preserves the incomplete Aug 24 2027 row as needs_review', () => {
    const incomplete = result.rows.find((r) => r.status === 'needs_review');
    expect(incomplete).toMatchObject({ date: '2027-08-24', category: 'Compensatory Leave', duration: null });
  });

  it('matches the expected category totals', () => {
    expect(result.totals['Work From Home']).toBe(10);
    expect(result.totals['Casual Leave']).toBe(5);
    expect(result.totals['Sick Leave']).toBe(8);
    expect(result.totals['Compensatory Leave']).toBe(2);
    expect(result.totals['Carry Forward Leave']).toBe(0);
  });

  it('is order independent and idempotent', () => {
    const swapped = reconcileLeaveRows([second.rows, first.rows]);
    expect(swapped.rows.map((r) => r.source_key)).toEqual(result.rows.map((r) => r.source_key));
    expect(reconcileLeaveRows([result.rows, result.rows]).rows).toHaveLength(29);
  });
});
