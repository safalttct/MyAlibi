import { holidaysOn } from '../data/public-holidays';
import { addDaysIso, fromIsoDate, toIsoDate } from './dates';

export type SkipReason = 'weekend' | 'holiday';

export interface SkippedDay {
  date: string;
  reason: SkipReason;
  /** Holiday name when reason is holiday. */
  label?: string;
}

export interface WorkingDaysResult {
  included: string[];
  skipped: SkippedDay[];
}

export const WORKING_DAYS_RANGE_CAP = 60;

function isWeekend(iso: string): boolean {
  const day = fromIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

/**
 * Inclusive ISO date range of working days.
 * Skips Saturdays, Sundays, and dates in the public holiday list.
 * Caps the calendar span (start→end) at {@link WORKING_DAYS_RANGE_CAP} days.
 */
export function workingDaysInRange(start: string, end: string): WorkingDaysResult {
  if (!start || !end || end < start) {
    return { included: [], skipped: [] };
  }

  const included: string[] = [];
  const skipped: SkippedDay[] = [];
  let cursor = start;
  let span = 0;

  while (cursor <= end) {
    span += 1;
    if (span > WORKING_DAYS_RANGE_CAP) {
      break;
    }

    if (isWeekend(cursor)) {
      skipped.push({ date: cursor, reason: 'weekend' });
    } else {
      const holidays = holidaysOn(cursor);
      if (holidays.length > 0) {
        skipped.push({
          date: cursor,
          reason: 'holiday',
          label: holidays.map((h) => h.name).join(', '),
        });
      } else {
        included.push(cursor);
      }
    }

    cursor = addDaysIso(cursor, 1);
  }

  return { included, skipped };
}

/** Convenience for formatting a short skip summary. */
export function describeSkipped(skipped: readonly SkippedDay[]): string {
  if (skipped.length === 0) {
    return '';
  }
  return skipped
    .map((s) => {
      const day = toIsoDate(fromIsoDate(s.date));
      const short = fromIsoDate(day).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      if (s.reason === 'holiday') {
        return `${s.label ?? 'Holiday'} ${short}`;
      }
      return short;
    })
    .join(', ');
}
