import { LeaveCategory, LeaveDuration } from '../models/leave.models';

export interface SourceKeyParts {
  title: string;
  date: string;
  category: LeaveCategory | string;
  duration: LeaveDuration | string | null | undefined;
}

/** Lower-case, trim and collapse internal whitespace. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Deterministic identity of an imported row:
 * `normalized title | yyyy-MM-dd | normalized category | normalized duration`.
 * Whitespace/case differences ("Sick Leave " vs "Sick Leave") yield the same key.
 */
export function buildSourceKey(parts: SourceKeyParts): string {
  return [
    normalizeText(parts.title),
    (parts.date ?? '').trim(),
    normalizeText(parts.category),
    normalizeText(parts.duration ?? ''),
  ].join('|');
}
