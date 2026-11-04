import {
  LeaveCategory,
  LeaveDuration,
  LeaveStatus,
  isLeaveCategory,
} from '../models/leave.models';
import { parseCsv } from './csv';
import { buildSourceKey } from './source-key';

export interface ParsedLeaveRow {
  /** 1-based line number within the file (header is line 1). */
  rowNumber: number;
  sourceFile: string;
  title: string;
  category: LeaveCategory | null;
  /** yyyy-MM-dd, null when it could not be parsed. */
  date: string | null;
  duration: LeaveDuration | null;
  notes: string | null;
  status: LeaveStatus;
  source_key: string;
  /** Row can be written to the database (valid category + date). */
  valid: boolean;
  issues: string[];
}

export interface ParseLeaveCsvResult {
  rows: ParsedLeaveRow[];
  /** File-level problems (e.g. missing required headers). */
  errors: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const CATEGORY_ALIASES: Record<string, LeaveCategory> = {
  'work from home': 'Work From Home',
  wfh: 'Work From Home',
  'casual leave': 'Casual Leave',
  casual: 'Casual Leave',
  cl: 'Casual Leave',
  'Casual Leave': 'Casual Leave',
  annual: 'Casual Leave',
  al: 'Casual Leave',
  'sick leave': 'Sick Leave',
  sick: 'Sick Leave',
  sl: 'Sick Leave',
  'maternity leave': 'Maternity Leave',
  maternity: 'Maternity Leave',
  'paternity leave': 'Paternity Leave',
  paternity: 'Paternity Leave',
  'emergency leave': 'Emergency Leave',
  emergency: 'Emergency Leave',
  'loss of pay': 'Loss of Pay',
  lop: 'Loss of Pay',
  'compensatory leave': 'Compensatory Leave',
  compensatory: 'Compensatory Leave',
  'comp off': 'Compensatory Leave',
  'comp-off': 'Compensatory Leave',
  'compensatory off': 'Compensatory Leave',
  'carry forward leave': 'Carry Forward Leave',
  'carry forward': 'Carry Forward Leave',
  'carry-forward leave': 'Carry Forward Leave',
};

const HEADER_ALIASES: Record<string, 'title' | 'category' | 'date' | 'duration' | 'notes'> = {
  entry: 'title',
  title: 'title',
  name: 'title',
  category: 'category',
  date: 'date',
  type: 'duration',
  duration: 'duration',
  notes: 'notes',
  note: 'notes',
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Parses "April 1, 2026", "Apr 1 2026", "2026-04-01" or "01/04/2026"-free ISO forms
 * into yyyy-MM-dd using pure string/number math (no `Date` parsing, so no timezone shift).
 */
export function parseLongDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}` : null;
  }

  const long = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(value);
  if (long) {
    const month = MONTHS[long[1].toLowerCase()];
    const day = Number(long[2]);
    const year = Number(long[3]);
    if (month && isRealDate(year, month, day)) {
      return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
    }
  }
  return null;
}

export function normalizeCategory(raw: string): LeaveCategory | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  const alias = CATEGORY_ALIASES[cleaned];
  if (alias) {
    return alias;
  }
  return isLeaveCategory(raw.trim()) ? (raw.trim() as LeaveCategory) : null;
}

export function normalizeDuration(raw: string): LeaveDuration | null {
  const cleaned = raw.replace(/[\s_-]+/g, '').toLowerCase();
  if (cleaned === 'fullday' || cleaned === 'full' || cleaned === '1') {
    return 'Full Day';
  }
  if (cleaned === 'halfday' || cleaned === 'half' || cleaned === '0.5') {
    return 'Half Day';
  }
  return null;
}

function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Parses a leave CSV. Columns are resolved by header name so order does not matter. */
export function parseLeaveCsv(text: string, sourceFile = 'upload.csv'): ParseLeaveCsvResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: [`${sourceFile}: file is empty`] };
  }

  const headerRow = table[0].map((h) => h.replace(/\s+/g, ' ').trim().toLowerCase());
  const columns: Partial<Record<'title' | 'category' | 'date' | 'duration' | 'notes', number>> = {};
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header];
    if (key && columns[key] === undefined) {
      columns[key] = index;
    }
  });

  const errors: string[] = [];
  for (const required of ['category', 'date'] as const) {
    if (columns[required] === undefined) {
      errors.push(`${sourceFile}: missing required column "${required}"`);
    }
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const cell = (row: string[], key: keyof typeof columns): string => {
    const index = columns[key];
    return index === undefined ? '' : cleanText(row[index]);
  };

  const rows: ParsedLeaveRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((c) => c.trim() === '')) {
      continue;
    }

    const issues: string[] = [];
    const category = normalizeCategory(cell(raw, 'category'));
    if (!category) {
      issues.push(`Unknown category "${cell(raw, 'category')}"`);
    }
    const date = parseLongDate(cell(raw, 'date'));
    if (!date) {
      issues.push(`Invalid date "${cell(raw, 'date')}"`);
    }
    const durationRaw = cell(raw, 'duration');
    const duration = normalizeDuration(durationRaw);
    if (!duration) {
      issues.push(durationRaw ? `Unknown duration "${durationRaw}"` : 'Missing duration');
    }

    const title = cell(raw, 'title') || category || 'Untitled';
    const notes = cell(raw, 'notes') || null;
    const valid = category !== null && date !== null;
    const status: LeaveStatus = duration ? 'complete' : 'needs_review';

    rows.push({
      rowNumber: i + 1,
      sourceFile,
      title,
      category,
      date,
      duration,
      notes,
      status,
      source_key: valid
        ? buildSourceKey({ title, date: date as string, category: category as LeaveCategory, duration })
        : `invalid|${sourceFile}|${i + 1}`,
      valid,
      issues,
    });
  }

  return { rows, errors };
}
