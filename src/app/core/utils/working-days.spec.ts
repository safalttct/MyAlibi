import { describe, expect, it } from 'vitest';
import { WORKING_DAYS_RANGE_CAP, workingDaysInRange } from './working-days';

describe('workingDaysInRange', () => {
  it('returns a single weekday unchanged', () => {
    // 2026-04-01 is Wednesday
    const result = workingDaysInRange('2026-04-01', '2026-04-01');
    expect(result.included).toEqual(['2026-04-01']);
    expect(result.skipped).toEqual([]);
  });

  it('skips Saturday and Sunday', () => {
    // Fri 3 Apr – Mon 6 Apr 2026 (Good Friday is also a holiday)
    const result = workingDaysInRange('2026-04-04', '2026-04-06');
    expect(result.included).toEqual(['2026-04-06']);
    expect(result.skipped.map((s) => s.date)).toEqual(['2026-04-04', '2026-04-05']);
    expect(result.skipped.every((s) => s.reason === 'weekend')).toBe(true);
  });

  it('skips public holidays with a label', () => {
    // Vishu 2026-04-15 is Wednesday
    const result = workingDaysInRange('2026-04-15', '2026-04-15');
    expect(result.included).toEqual([]);
    expect(result.skipped).toEqual([
      { date: '2026-04-15', reason: 'holiday', label: 'Vishu' },
    ]);
  });

  it('returns empty when end is before start', () => {
    expect(workingDaysInRange('2026-05-02', '2026-05-01')).toEqual({
      included: [],
      skipped: [],
    });
  });

  it('caps the calendar span at WORKING_DAYS_RANGE_CAP', () => {
    const result = workingDaysInRange('2026-04-01', '2026-12-31');
    const allDates = [...result.included, ...result.skipped.map((s) => s.date)].sort();
    expect(allDates.length).toBe(WORKING_DAYS_RANGE_CAP);
    expect(allDates[0]).toBe('2026-04-01');
  });
});
