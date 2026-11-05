/** Inclusive ISO date range helpers for the date picker. */

export function clampIso(date: string, min?: string | null, max?: string | null): string {
  if (min && date < min) {
    return min;
  }
  if (max && date > max) {
    return max;
  }
  return date;
}

/** Apply a day click in range mode: first click sets start, second completes or restarts. */
export function applyRangeClick(
  iso: string,
  start: string | null,
  end: string | null,
): { start: string; end: string | null; complete: boolean } {
  if (!start || (start && end)) {
    return { start: iso, end: null, complete: false };
  }
  if (iso < start) {
    return { start: iso, end: start, complete: true };
  }
  return { start, end: iso, complete: true };
}

export function isInRange(iso: string, start: string | null, end: string | null): boolean {
  if (!start || !end) {
    return false;
  }
  return iso >= start && iso <= end;
}

export function isRangeEndpoint(iso: string, start: string | null, end: string | null): boolean {
  return iso === start || iso === end;
}
