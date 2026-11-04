import {
  fiscalYearLabel,
  fiscalYearRange,
  fiscalYearRangeFor,
  nextFiscalYear,
  previousFiscalYear,
} from './dates';

describe('fiscal year helpers', () => {
  it('keeps Mar 31 in the prior Apr–Mar year', () => {
    expect(fiscalYearRange(new Date(2027, 2, 31))).toEqual({
      start: '2026-04-01',
      end: '2027-03-31',
    });
  });

  it('opens the next year on Apr 1', () => {
    expect(fiscalYearRange(new Date(2027, 3, 1))).toEqual({
      start: '2027-04-01',
      end: '2028-03-31',
    });
  });

  it('labels and navigates years', () => {
    const fy = fiscalYearRangeFor(2026);
    expect(fiscalYearLabel(fy)).toBe('FY 2026–27');
    expect(nextFiscalYear(fy)).toEqual({ start: '2027-04-01', end: '2028-03-31' });
    expect(previousFiscalYear(fy)).toEqual({ start: '2025-04-01', end: '2026-03-31' });
  });
});
