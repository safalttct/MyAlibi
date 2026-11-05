import { format } from 'date-fns';
import { LeaveCategory, durationToDays, normalizeCategory } from '../models/leave.models';
import { DateRange, addDaysIso, daysBetweenIso, fromIsoDate, inRange, todayIso } from '../utils/dates';

/** Soft policy nudges — not enforcement. */
export interface AnomalyHint {
  id: string;
  title: string;
  detail: string;
}

export interface YearNarrative {
  headline: string;
  /** Days from as-of until period end. 0 when the period is over. */
  daysLeft: number;
  /** True in the last 90 days of an in-progress period. */
  closing: boolean;
  lines: string[];
}

export interface NarrativeBalance {
  category: LeaveCategory | string;
  label: string;
  remaining: number;
  used: number;
  total: number;
}

type HintRecord = {
  category: LeaveCategory | string;
  date: string;
  duration: 'Full Day' | 'Half Day' | null;
  status: string;
  notes?: string | null;
};

const CERT_NOTE = /certif|doctor|medical|clinic|prescription|hospital/i;
const YEAR_END_WINDOW_DAYS = 90;

function fmt(iso: string): string {
  return format(fromIsoDate(iso), 'd MMM yyyy');
}

function dayWord(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} day${rounded === 1 ? '' : 's'}`;
}

function hasCertificate(notes: string | null | undefined): boolean {
  return !!notes && CERT_NOTE.test(notes);
}

function countableDays(record: HintRecord): number {
  if (record.status !== 'complete' || !record.duration) {
    return 0;
  }
  return durationToDays(record.duration);
}

/** Groups of calendar-consecutive dates, longest / latest first not required — chronological. */
function consecutiveGroups(dates: string[]): string[][] {
  const unique = [...new Set(dates)].sort();
  const groups: string[][] = [];
  for (const date of unique) {
    const current = groups[groups.length - 1];
    if (!current) {
      groups.push([date]);
      continue;
    }
    const prev = current[current.length - 1];
    if (daysBetweenIso(prev, date) === 1) {
      current.push(date);
    } else {
      groups.push([date]);
    }
  }
  return groups;
}

/**
 * Policy-shaped hints from leave records.
 * Sick > 2 consecutive days without a certificate-style note,
 * casual > 2 consecutive days, sick scattered across the last 7 days,
 * and records still missing a duration.
 */
export function anomalyHints(
  records: readonly HintRecord[],
  asOf: string = todayIso(),
  period?: DateRange,
): AnomalyHint[] {
  const inPeriod = records.filter((r) => !period || inRange(r.date, period.start, period.end));
  const hints: AnomalyHint[] = [];

  const sick = inPeriod.filter((r) => normalizeCategory(r.category as LeaveCategory) === 'Sick Leave');
  const sickStreak = longestQualifyingStreak(sick, 2);
  if (sickStreak && !sickStreak.records.some((r) => hasCertificate(r.notes))) {
    const start = sickStreak.dates[0];
    const end = sickStreak.dates[sickStreak.dates.length - 1];
    hints.push({
      id: 'sick-certificate',
      title: 'Sick leave may need a certificate',
      detail: `${dayWord(sickStreak.days)} of sick leave from ${fmt(start)} to ${fmt(end)}. Policy asks for a doctor’s certificate after 2 consecutive days — add a note if you have one.`,
    });
  }

  const weekStart = addDaysIso(asOf, -6);
  const weekSick = sick.filter(
    (r) => r.date >= weekStart && r.date <= asOf && countableDays(r) > 0,
  );
  const weekDays = weekSick.reduce((sum, r) => sum + countableDays(r), 0);
  if (weekDays >= 3 && !weekSick.some((r) => hasCertificate(r.notes)) && !hints.some((h) => h.id === 'sick-certificate')) {
    hints.push({
      id: 'sick-week',
      title: 'Several sick days this week',
      detail: `${dayWord(weekDays)} of sick leave in the last 7 days, with no certificate noted.`,
    });
  }

  const casual = inPeriod.filter((r) => normalizeCategory(r.category as LeaveCategory) === 'Casual Leave');
  const casualStreak = longestQualifyingStreak(casual, 2);
  if (casualStreak) {
    const start = casualStreak.dates[0];
    const end = casualStreak.dates[casualStreak.dates.length - 1];
    hints.push({
      id: 'casual-advance',
      title: 'Casual leave longer than 2 days',
      detail: `${dayWord(casualStreak.days)} from ${fmt(start)} to ${fmt(end)}. Policy asks for notice a month ahead when casual leave is more than 2 days.`,
    });
  }

  const review = inPeriod.filter((r) => r.status === 'needs_review');
  if (review.length > 0) {
    hints.push({
      id: 'needs-review',
      title: review.length === 1 ? '1 record needs a duration' : `${review.length} records need a duration`,
      detail: 'These days are not counted in balances until you mark them full day or half day.',
    });
  }

  return hints;
}

function longestQualifyingStreak(
  records: HintRecord[],
  moreThanDays: number,
): { dates: string[]; days: number; records: HintRecord[] } | null {
  const countable = records.filter((r) => countableDays(r) > 0);
  const byDate = new Map<string, HintRecord[]>();
  for (const record of countable) {
    const list = byDate.get(record.date) ?? [];
    list.push(record);
    byDate.set(record.date, list);
  }
  let best: { dates: string[]; days: number; records: HintRecord[] } | null = null;
  for (const dates of consecutiveGroups([...byDate.keys()])) {
    const groupRecords = dates.flatMap((d) => byDate.get(d) ?? []);
    const days = groupRecords.reduce((sum, r) => sum + countableDays(r), 0);
    if (days <= moreThanDays) {
      continue;
    }
    if (!best || days > best.days) {
      best = { dates, days, records: groupRecords };
    }
  }
  return best;
}

/**
 * Plain-language summary of remaining balances for the selected leave year.
 * `closing` is true in the last 90 days so the UI can treat it as a year-end story.
 */
export function yearNarrative(input: {
  periodStart: string;
  periodEnd: string;
  asOf?: string;
  balances: readonly NarrativeBalance[];
  compOffExpiring?: readonly { days: number; expiry: string }[];
}): YearNarrative {
  const asOf = input.asOf ?? todayIso();
  const started = asOf >= input.periodStart;
  const ended = asOf > input.periodEnd;
  const daysLeft = ended ? 0 : Math.max(0, daysBetweenIso(asOf, input.periodEnd));
  const closing = started && !ended && daysLeft <= YEAR_END_WINDOW_DAYS;

  const lines: string[] = [];
  if (ended) {
    lines.push(`This period ended on ${fmt(input.periodEnd)}.`);
  } else if (!started) {
    lines.push(`This period starts ${fmt(input.periodStart)} and runs to ${fmt(input.periodEnd)}.`);
  } else if (closing) {
    lines.push(`${dayWord(daysLeft)} left in this leave year (ends ${fmt(input.periodEnd)}).`);
  } else {
    lines.push(`${dayWord(daysLeft)} left until ${fmt(input.periodEnd)}.`);
  }

  const balances = [...input.balances]
    .filter((b) => b.total > 0 || b.used > 0 || b.remaining !== 0)
    .sort((a, b) => a.remaining - b.remaining);

  if (balances.length === 0) {
    lines.push('No allocations or usage recorded for this period yet.');
  } else {
    for (const b of balances) {
      const label = b.label || b.category;
      if (b.remaining < 0) {
        lines.push(`${label} is over by ${dayWord(Math.abs(b.remaining))}.`);
      } else if (b.total > 0 && b.remaining === 0) {
        lines.push(`${label} is fully used (${dayWord(b.used)} of ${dayWord(b.total)}).`);
      } else if (b.total > 0 && b.remaining <= 2) {
        lines.push(`${label}: only ${dayWord(b.remaining)} left (${dayWord(b.used)} used of ${dayWord(b.total)}).`);
      } else if (b.total > 0) {
        lines.push(`${label}: ${dayWord(b.remaining)} left (${dayWord(b.used)} used of ${dayWord(b.total)}).`);
      } else if (b.used > 0) {
        lines.push(`${label}: ${dayWord(b.used)} logged.`);
      }
    }
  }

  const lots = (input.compOffExpiring ?? []).filter((l) => l.days > 0 && l.expiry >= asOf);
  for (const lot of lots.slice(0, 3)) {
    const inDays = daysBetweenIso(asOf, lot.expiry);
    const when = inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `in ${inDays} days`;
    lines.push(`${dayWord(lot.days)} of Comp Off expire on ${fmt(lot.expiry)} (${when}).`);
  }

  const headline = ended
    ? 'This leave year has ended'
    : !started
      ? 'Upcoming leave year'
      : closing
        ? 'Heading into year-end'
        : 'Where this year stands';

  return { headline, daysLeft, closing, lines };
}
