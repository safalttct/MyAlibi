export type LeaveCategory =
  | 'Work From Home'
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Compensatory Leave'
  | 'Carry Forward Leave';

export type LeaveDuration = 'Full Day' | 'Half Day';
export type LeaveStatus = 'complete' | 'needs_review';
export type CompOffType = 'earned' | 'used' | 'adjustment';

export interface CategoryMeta {
  readonly id: LeaveCategory;
  readonly label: string;
  readonly short: string;
  /** CSS custom property that carries the category color (see styles.scss). */
  readonly colorVar: string;
  /** Resolved `var(...)` expression handy for inline SVG/style bindings. */
  readonly color: string;
  /** Static Tailwind class names so the JIT scanner can see them. */
  readonly textClass: string;
  readonly softBgClass: string;
  readonly dotClass: string;
  readonly borderClass: string;
  readonly isWfh: boolean;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'Work From Home',
    label: 'Work From Home',
    short: 'WFH',
    colorVar: '--wfh',
    color: 'var(--wfh)',
    textClass: 'text-wfh',
    softBgClass: 'bg-wfh/15',
    dotClass: 'bg-wfh',
    borderClass: 'border-wfh/40',
    isWfh: true,
  },
  {
    id: 'Casual Leave',
    label: 'Casual Leave',
    short: 'Casual',
    colorVar: '--casual',
    color: 'var(--casual)',
    textClass: 'text-casual',
    softBgClass: 'bg-casual/15',
    dotClass: 'bg-casual',
    borderClass: 'border-casual/40',
    isWfh: false,
  },
  {
    id: 'Sick Leave',
    label: 'Sick Leave',
    short: 'Sick',
    colorVar: '--sick',
    color: 'var(--sick)',
    textClass: 'text-sick',
    softBgClass: 'bg-sick/15',
    dotClass: 'bg-sick',
    borderClass: 'border-sick/40',
    isWfh: false,
  },
  {
    id: 'Compensatory Leave',
    label: 'Compensatory Leave',
    short: 'Comp Off',
    colorVar: '--comp',
    color: 'var(--comp)',
    textClass: 'text-comp',
    softBgClass: 'bg-comp/15',
    dotClass: 'bg-comp',
    borderClass: 'border-comp/40',
    isWfh: false,
  },
  {
    id: 'Carry Forward Leave',
    label: 'Carry Forward Leave',
    short: 'Carry Fwd',
    colorVar: '--carry',
    color: 'var(--carry)',
    textClass: 'text-carry',
    softBgClass: 'bg-carry/15',
    dotClass: 'bg-carry',
    borderClass: 'border-carry/40',
    isWfh: false,
  },
] as const;

export const CATEGORY_IDS: readonly LeaveCategory[] = CATEGORIES.map((c) => c.id);

export const DURATIONS: readonly LeaveDuration[] = ['Full Day', 'Half Day'];

export function categoryMeta(category: LeaveCategory): CategoryMeta {
  const meta = CATEGORIES.find((c) => c.id === category);
  if (!meta) {
    throw new Error(`Unknown category: ${category}`);
  }
  return meta;
}

export function isLeaveCategory(value: unknown): value is LeaveCategory {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Days consumed by a duration. Missing duration yields 0 (record needs review). */
export function durationToDays(duration: LeaveDuration | null | undefined): number {
  if (duration === 'Full Day') {
    return 1;
  }
  if (duration === 'Half Day') {
    return 0.5;
  }
  return 0;
}

export interface LeaveRecord {
  id: string;
  user_id: string;
  title: string;
  category: LeaveCategory;
  /** yyyy-MM-dd */
  date: string;
  duration: LeaveDuration | null;
  /** Generated column in Postgres. Never sent on insert/update. */
  days: number | null;
  notes: string | null;
  status: LeaveStatus;
  source_key: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Writable fields for leave_records (no `days`, it is GENERATED). */
export interface LeaveRecordInput {
  title: string;
  category: LeaveCategory;
  date: string;
  duration: LeaveDuration | null;
  notes?: string | null;
  status?: LeaveStatus;
  source_key?: string | null;
  import_batch_id?: string | null;
}

export interface LeaveAllocation {
  id: string;
  user_id: string;
  category: LeaveCategory;
  period_start: string;
  period_end: string;
  opening_balance: number;
  annual_allocation: number;
  carry_forward_allocation: number;
  carry_forward_expiry: string | null;
  updated_at: string;
}

export interface LeaveAllocationInput {
  category: LeaveCategory;
  period_start: string;
  period_end: string;
  opening_balance: number;
  annual_allocation: number;
  carry_forward_allocation: number;
  carry_forward_expiry: string | null;
}

/** Row of the `leave_balances` view. */
export interface LeaveBalance {
  user_id?: string;
  category: LeaveCategory;
  period_start: string;
  period_end: string;
  total_available: number;
  used: number;
  remaining: number;
  usage_percent: number;
  is_negative: boolean;
  opening_balance: number;
  annual_allocation: number;
  carry_forward_allocation: number;
  carry_forward_expiry: string | null;
}

export interface MonthlyUsageRow {
  /** First day of the month, yyyy-MM-dd */
  month: string;
  category: LeaveCategory;
  used_days: number;
}

export interface CompOffTransaction {
  id: string;
  user_id: string;
  transaction_date: string;
  type: CompOffType;
  days: number;
  expiry_date: string | null;
  notes: string | null;
  leave_record_id: string | null;
  created_at: string;
}

export interface CompOffInput {
  transaction_date: string;
  type: CompOffType;
  days: number;
  expiry_date?: string | null;
  notes?: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
}

export interface AppSetting {
  id: string;
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  source: string;
  file_names: string[];
  record_count: number;
  created_at: string;
}
