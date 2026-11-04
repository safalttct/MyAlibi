import { Injectable, inject } from '@angular/core';
import { LeaveCategory } from '../models/leave.models';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

export interface HrShareLink {
  id: string;
  user_id: string;
  token: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
}

export interface HrShareBalance {
  category: LeaveCategory | string;
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
}

export interface HrShareRecord {
  date: string;
  title: string;
  category: LeaveCategory | string;
  duration: string | null;
  days: number | null;
  status: string;
}

export interface HrShareSnapshotOk {
  ok: true;
  employee_name: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  view_only: boolean;
  balances: HrShareBalance[];
  records: HrShareRecord[];
}

export interface HrShareSnapshotErr {
  ok: false;
  error: string;
}

export type HrShareSnapshot = HrShareSnapshotOk | HrShareSnapshotErr;

@Injectable({ providedIn: 'root' })
export class HrShareService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Absolute public URL for a token. */
  publicUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/share/hr/${token}`;
  }

  async getActiveLink(): Promise<HrShareLink | null> {
    this.auth.requireUserId();
    const rows = unwrap(
      await this.supabase.client
        .from('hr_share_links')
        .select('*')
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1),
    ) as HrShareLink[];
    const link = rows[0] ?? null;
    if (!link) {
      return null;
    }
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return link;
  }

  async createLink(expiresInDays: number | null = 30): Promise<HrShareLink> {
    this.auth.requireUserId();
    return unwrap(
      await this.supabase.client.rpc('create_hr_share_link', {
        p_label: 'HR review',
        p_expires_in_days: expiresInDays,
      }),
    ) as HrShareLink;
  }

  async revokeLink(id: string): Promise<void> {
    this.auth.requireUserId();
    unwrap(await this.supabase.client.rpc('revoke_hr_share_link', { p_id: id }));
  }

  async fetchSnapshot(token: string): Promise<HrShareSnapshot> {
    const data = unwrap(
      await this.supabase.client.rpc('hr_share_snapshot', { p_token: token }),
    ) as HrShareSnapshot;
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'invalid_or_expired' };
    }
    if (!data.ok) {
      return data;
    }
    return {
      ...data,
      balances: (data.balances ?? []).map((b) => ({
        ...b,
        total_available: Number(b.total_available),
        used: Number(b.used),
        remaining: Number(b.remaining),
        usage_percent: Number(b.usage_percent),
        opening_balance: Number(b.opening_balance),
        annual_allocation: Number(b.annual_allocation),
        carry_forward_allocation: Number(b.carry_forward_allocation),
      })),
      records: (data.records ?? []).map((r) => ({
        ...r,
        days: r.days == null ? null : Number(r.days),
      })),
    };
  }
}
