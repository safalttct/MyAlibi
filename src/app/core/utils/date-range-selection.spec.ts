import { describe, expect, it } from 'vitest';
import { applyRangeClick, clampIso, isInRange } from './date-range-selection';

describe('date-range-selection', () => {
  it('clamps to min and max', () => {
    expect(clampIso('2026-04-01', '2026-04-10', '2026-04-20')).toBe('2026-04-10');
    expect(clampIso('2026-04-30', '2026-04-10', '2026-04-20')).toBe('2026-04-20');
    expect(clampIso('2026-04-15', '2026-04-10', '2026-04-20')).toBe('2026-04-15');
  });

  it('starts a new range on first click or after a complete range', () => {
    expect(applyRangeClick('2026-04-01', null, null)).toEqual({
      start: '2026-04-01',
      end: null,
      complete: false,
    });
    expect(applyRangeClick('2026-04-05', '2026-04-01', '2026-04-03')).toEqual({
      start: '2026-04-05',
      end: null,
      complete: false,
    });
  });

  it('completes a range and swaps when end is before start', () => {
    expect(applyRangeClick('2026-04-10', '2026-04-01', null)).toEqual({
      start: '2026-04-01',
      end: '2026-04-10',
      complete: true,
    });
    expect(applyRangeClick('2026-03-20', '2026-04-01', null)).toEqual({
      start: '2026-03-20',
      end: '2026-04-01',
      complete: true,
    });
  });

  it('detects inclusive in-range days', () => {
    expect(isInRange('2026-04-05', '2026-04-01', '2026-04-10')).toBe(true);
    expect(isInRange('2026-04-01', '2026-04-01', '2026-04-10')).toBe(true);
    expect(isInRange('2026-04-11', '2026-04-01', '2026-04-10')).toBe(false);
  });
});
