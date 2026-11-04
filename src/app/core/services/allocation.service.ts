import { Injectable, inject } from '@angular/core';
import { LeaveAllocation, LeaveAllocationInput } from '../models/leave.models';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

const TABLE = 'leave_allocations';

@Injectable({ providedIn: 'root' })
export class AllocationService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async list(): Promise<LeaveAllocation[]> {
    return unwrap(
      await this.supabase.client
        .from(TABLE)
        .select('*')
        .order('period_start', { ascending: false })
        .order('category', { ascending: true }),
    ) as LeaveAllocation[];
  }

  /** Inserts or updates the allocation for (category, period). */
  async upsert(input: LeaveAllocationInput): Promise<LeaveAllocation> {
    const payload = { ...input, user_id: this.auth.requireUserId() };
    return unwrap(
      await this.supabase.client
        .from(TABLE)
        .upsert(payload, { onConflict: 'user_id,category,period_start,period_end' })
        .select('*')
        .single(),
    ) as LeaveAllocation;
  }

  async delete(id: string): Promise<void> {
    unwrap(await this.supabase.client.from(TABLE).delete().eq('id', id));
  }
}
