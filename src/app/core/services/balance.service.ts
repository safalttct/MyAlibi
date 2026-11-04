import { Injectable, inject } from '@angular/core';
import { LeaveBalance, MonthlyUsageRow } from '../models/leave.models';
import { SupabaseService, unwrap } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly supabase = inject(SupabaseService);

  /** Authoritative balances from the `leave_balances` view. */
  async fetchBalances(): Promise<LeaveBalance[]> {
    const rows = unwrap(
      await this.supabase.client
        .from('leave_balances')
        .select('*')
        .order('period_start', { ascending: false }),
    ) as LeaveBalance[];
    return rows.map((row) => this.normalize(row));
  }

  /** Monthly usage via the `monthly_usage` RPC (complete records only). */
  async monthlyUsage(periodStart: string, periodEnd: string): Promise<MonthlyUsageRow[]> {
    const rows = unwrap(
      await this.supabase.client.rpc('monthly_usage', {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      }),
    ) as MonthlyUsageRow[];
    return rows.map((r) => ({ ...r, used_days: Number(r.used_days) }));
  }

  /** PostgREST may serialise numerics as strings for some view columns. */
  private normalize(row: LeaveBalance): LeaveBalance {
    return {
      ...row,
      total_available: Number(row.total_available),
      used: Number(row.used),
      remaining: Number(row.remaining),
      usage_percent: Number(row.usage_percent),
      opening_balance: Number(row.opening_balance),
      annual_allocation: Number(row.annual_allocation),
      carry_forward_allocation: Number(row.carry_forward_allocation),
    };
  }
}
