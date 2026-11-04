import { format, parse } from 'date-fns';

export const ISO_DATE = 'yyyy-MM-dd';

export function toIsoDate(date: Date): string {
  return format(date, ISO_DATE);
}

/** Parses yyyy-MM-dd as a *local* date (no UTC shift). */
export function fromIsoDate(value: string): Date {
  return parse(value, ISO_DATE, new Date(2000, 0, 1));
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export interface DateRange {
  start: string;
  end: string;
}

/** Fiscal year Apr 1 → Mar 31 containing the given date. */
export function fiscalYearRange(ref: Date): DateRange {
  const startYear = ref.getMonth() >= 3 ? ref.getFullYear() : ref.getFullYear() - 1;
  return fiscalYearRangeFor(startYear);
}

export function fiscalYearRangeFor(startYear: number): DateRange {
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
}

/** Calendar year of the Apr 1 that starts this FY. */
export function fiscalYearStartYear(range: DateRange): number {
  return Number(range.start.slice(0, 4));
}

export function nextFiscalYear(range: DateRange): DateRange {
  return fiscalYearRangeFor(fiscalYearStartYear(range) + 1);
}

export function previousFiscalYear(range: DateRange): DateRange {
  return fiscalYearRangeFor(fiscalYearStartYear(range) - 1);
}

/** e.g. "FY 2026–27" */
export function fiscalYearLabel(range: DateRange): string {
  const start = fiscalYearStartYear(range);
  const endShort = String(start + 1).slice(2);
  return `FY ${start}–${endShort}`;
}

export function isSamePeriod(a: DateRange, b: DateRange): boolean {
  return a.start === b.start && a.end === b.end;
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Twelve month-start ISO dates for a range beginning at `start` (yyyy-MM-dd). */
export function monthStarts(start: string, count = 12): string[] {
  const [y, m] = start.split('-').map(Number);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = m - 1 + i;
    const year = y + Math.floor(index / 12);
    const month = (index % 12) + 1;
    result.push(`${year}-${String(month).padStart(2, '0')}-01`);
  }
  return result;
}
