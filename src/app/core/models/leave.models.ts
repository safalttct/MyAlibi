export type LeaveCategory =
  | 'Work From Home'
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Maternity Leave'
  | 'Paternity Leave'
  | 'Emergency Leave'
  | 'Loss of Pay'
  | 'Compensatory Leave'
  | 'Carry Forward Leave'
  /** @deprecated Remapped to Casual Leave (briefly stored as Annual Leave). */
  | 'Annual Leave';

export type LeaveDuration = 'Full Day' | 'Half Day';
export type LeaveStatus = 'complete' | 'needs_review';
export type CompOffType = 'earned' | 'used' | 'adjustment';

/** How allocation fields behave for this category. */
export type AllocationMode = 'standard' | 'comp' | 'unpaid' | 'discretionary';

export interface CategoryMeta {
  readonly id: Exclude<LeaveCategory, 'Annual Leave'>;
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
  /** Suggested annual days from HR policy (0 = discretionary / ledger / unpaid). */
  readonly defaultAnnual: number;
  readonly allocationMode: AllocationMode;
  /** Whether this type is on by default for new users. */
  readonly defaultEnabled: boolean;
  /** Short HR policy hint shown in Settings. */
  readonly policyHint: string;
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
    defaultAnnual: 16,
    allocationMode: 'standard',
    defaultEnabled: true,
    policyHint:
      'Up to 16 days. Family health (first-degree), personal duties, or commute issues. Prior HR approval; stay available during work hours.',
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
    defaultAnnual: 12,
    allocationMode: 'standard',
    defaultEnabled: true,
    policyHint:
      '12 days/year. Advance email request; 1 month ahead if more than 2 days.',
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
    defaultAnnual: 12,
    allocationMode: 'standard',
    defaultEnabled: true,
    policyHint: '12 days/year. Doctor’s certificate required if more than 2 consecutive days.',
  },
  {
    id: 'Compensatory Leave',
    label: 'Compensatory Off',
    short: 'Comp Off',
    colorVar: '--comp',
    color: 'var(--comp)',
    textClass: 'text-comp',
    softBgClass: 'bg-comp/15',
    dotClass: 'bg-comp',
    borderClass: 'border-comp/40',
    isWfh: false,
    defaultAnnual: 0,
    allocationMode: 'comp',
    defaultEnabled: true,
    policyHint:
      'After extra hours, request Comp Off from your project manager. Once approved, add it here as Earned — it expires 90 days after the approval/earn date. Use it before expiry. Cannot be carried to the next year.',
  },
  {
    id: 'Carry Forward Leave',
    label: 'Carry Forward',
    short: 'Carry Fwd',
    colorVar: '--carry',
    color: 'var(--carry)',
    textClass: 'text-carry',
    softBgClass: 'bg-carry/15',
    dotClass: 'bg-carry',
    borderClass: 'border-carry/40',
    isWfh: false,
    defaultAnnual: 0,
    allocationMode: 'standard',
    defaultEnabled: true,
    policyHint: 'Unused leave brought into the current period. Set days and expiry here.',
  },
  // Rarely used — kept at the bottom of Settings
  {
    id: 'Maternity Leave',
    label: 'Maternity Leave',
    short: 'Maternity',
    colorVar: '--maternity',
    color: 'var(--maternity)',
    textClass: 'text-maternity',
    softBgClass: 'bg-maternity/15',
    dotClass: 'bg-maternity',
    borderClass: 'border-maternity/40',
    isWfh: false,
    defaultAnnual: 0,
    allocationMode: 'discretionary',
    defaultEnabled: false,
    policyHint:
      '12–26 weeks (8 prenatal) for eligible female staff; 12 weeks for adoption/commissioning. Turn on only if this applies to you.',
  },
  {
    id: 'Paternity Leave',
    label: 'Paternity Leave',
    short: 'Paternity',
    colorVar: '--paternity',
    color: 'var(--paternity)',
    textClass: 'text-paternity',
    softBgClass: 'bg-paternity/15',
    dotClass: 'bg-paternity',
    borderClass: 'border-paternity/40',
    isWfh: false,
    defaultAnnual: 5,
    allocationMode: 'standard',
    defaultEnabled: false,
    policyHint: '5 days for eligible male staff; use within 60 days of childbirth/adoption.',
  },
  {
    id: 'Emergency Leave',
    label: 'Emergency Leave',
    short: 'Emergency',
    colorVar: '--emergency',
    color: 'var(--emergency)',
    textClass: 'text-emergency',
    softBgClass: 'bg-emergency/15',
    dotClass: 'bg-emergency',
    borderClass: 'border-emergency/40',
    isWfh: false,
    defaultAnnual: 0,
    allocationMode: 'discretionary',
    defaultEnabled: false,
    policyHint: 'Bereavement, marriage, or personal emergencies. Granted case by case.',
  },
  {
    id: 'Loss of Pay',
    label: 'Loss of Pay',
    short: 'LOP',
    colorVar: '--lop',
    color: 'var(--lop)',
    textClass: 'text-lop',
    softBgClass: 'bg-lop/15',
    dotClass: 'bg-lop',
    borderClass: 'border-lop/40',
    isWfh: false,
    defaultAnnual: 0,
    allocationMode: 'unpaid',
    defaultEnabled: false,
    policyHint: 'Unpaid leave when no balance remains. Late return may be treated as job abandonment.',
  },
] as const;

export const CATEGORY_IDS: readonly CategoryMeta['id'][] = CATEGORIES.map((c) => c.id);

export const DURATIONS: readonly LeaveDuration[] = ['Full Day', 'Half Day'];

export const DEFAULT_ENABLED_CATEGORIES: readonly CategoryMeta['id'][] = CATEGORIES.filter(
  (c) => c.defaultEnabled,
).map((c) => c.id);

/** Normalize legacy Annual Leave to Casual Leave. */
export function normalizeCategory(category: LeaveCategory): CategoryMeta['id'] {
  return category === 'Annual Leave' ? 'Casual Leave' : category;
}

export function categoryMeta(category: LeaveCategory): CategoryMeta {
  const id = normalizeCategory(category);
  const meta = CATEGORIES.find((c) => c.id === id);
  if (!meta) {
    throw new Error(`Unknown category: ${category}`);
  }
  return meta;
}

export function isLeaveCategory(value: unknown): value is LeaveCategory {
  if (typeof value !== 'string') {
    return false;
  }
  if (value === 'Annual Leave') {
    return true;
  }
  return (CATEGORY_IDS as readonly string[]).includes(value);
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
