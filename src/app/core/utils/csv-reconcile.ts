import { CATEGORY_IDS, LeaveCategory, durationToDays } from '../models/leave.models';
import { ParsedLeaveRow } from './csv-parse-leave';

export interface ReconcileResult {
  /** Unique rows by source_key, sorted by date then title. */
  rows: ParsedLeaveRow[];
  /** Rows dropped because another file already had the same source_key. */
  duplicatesRemoved: number;
  inputCount: number;
  completeCount: number;
  needsReviewCount: number;
  invalidCount: number;
  /** Sum of days of complete rows per category. */
  totals: Record<LeaveCategory, number>;
}

function prefer(a: ParsedLeaveRow, b: ParsedLeaveRow): ParsedLeaveRow {
  if (a.status !== b.status) {
    return a.status === 'complete' ? a : b;
  }
  if (!a.notes && b.notes) {
    return b;
  }
  return a;
}

export function emptyTotals(): Record<LeaveCategory, number> {
  return Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<LeaveCategory, number>;
}

export function sumCompleteDays(rows: readonly ParsedLeaveRow[]): Record<LeaveCategory, number> {
  const totals = emptyTotals();
  for (const row of rows) {
    if (row.valid && row.status === 'complete' && row.category) {
      totals[row.category] += durationToDays(row.duration);
    }
  }
  return totals;
}

/**
 * Merges rows from several files into one unique set keyed by `source_key`.
 * Incomplete rows (missing duration) are preserved with status `needs_review`.
 */
export function reconcileLeaveRows(files: readonly (readonly ParsedLeaveRow[])[]): ReconcileResult {
  const byKey = new Map<string, ParsedLeaveRow>();
  let inputCount = 0;
  let duplicatesRemoved = 0;

  for (const file of files) {
    for (const row of file) {
      inputCount++;
      const existing = byKey.get(row.source_key);
      if (existing) {
        duplicatesRemoved++;
        byKey.set(row.source_key, prefer(existing, row));
      } else {
        byKey.set(row.source_key, row);
      }
    }
  }

  const rows = [...byKey.values()].sort(
    (a, b) =>
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      a.title.localeCompare(b.title) ||
      a.source_key.localeCompare(b.source_key),
  );

  return {
    rows,
    duplicatesRemoved,
    inputCount,
    completeCount: rows.filter((r) => r.valid && r.status === 'complete').length,
    needsReviewCount: rows.filter((r) => r.valid && r.status === 'needs_review').length,
    invalidCount: rows.filter((r) => !r.valid).length,
    totals: sumCompleteDays(rows),
  };
}
