import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { toIsoDate } from './dates';

export interface GridDay {
  date: Date;
  iso: string;
  inMonth: boolean;
}

/** Full weeks (Mon-Sun) covering the month containing `month`. */
export function buildMonthGrid(month: Date): GridDay[] {
  const first = startOfMonth(month);
  const start = startOfWeek(first, { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: GridDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({ date: d, iso: toIsoDate(d), inMonth: d.getMonth() === first.getMonth() });
  }
  return days;
}

export const WEEKDAYS_MON_FIRST: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
