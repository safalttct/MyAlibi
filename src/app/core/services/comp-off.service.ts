import { Injectable, inject } from '@angular/core';
import { CompOffInput, CompOffTransaction } from '../models/leave.models';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

const TABLE = 'comp_off_transactions';

@Injectable({ providedIn: 'root' })
export class CompOffService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async list(): Promise<CompOffTransaction[]> {
    const rows = unwrap(
      await this.supabase.client
        .from(TABLE)
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ) as CompOffTransaction[];
    return rows.map((r) => ({ ...r, days: Number(r.days) }));
  }

  earned(input: { date: string; days: number; expiry?: string | null; notes?: string | null }) {
    return this.create({
      transaction_date: input.date,
      type: 'earned',
      days: input.days,
      expiry_date: input.expiry ?? null,
      notes: input.notes ?? null,
    });
  }

  /**
   * Manual "used" entry (no leave_record_id). Usage created from Compensatory Leave
   * records is synced into the ledger by a database trigger instead.
   */
  used(input: { date: string; days: number; notes?: string | null }) {
    return this.create({
      transaction_date: input.date,
      type: 'used',
      days: input.days,
      notes: input.notes ?? null,
    });
  }

  adjustment(input: { date: string; days: number; notes?: string | null }) {
    return this.create({
      transaction_date: input.date,
      type: 'adjustment',
      days: input.days,
      notes: input.notes ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    unwrap(await this.supabase.client.from(TABLE).delete().eq('id', id));
  }

  private async create(input: CompOffInput): Promise<CompOffTransaction> {
    const payload = {
      ...input,
      expiry_date: input.expiry_date ?? null,
      notes: input.notes?.trim() || null,
      user_id: this.auth.requireUserId(),
    };
    return unwrap(
      await this.supabase.client.from(TABLE).insert(payload).select('*').single(),
    ) as CompOffTransaction;
  }
}
