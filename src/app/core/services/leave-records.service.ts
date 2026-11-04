import { Injectable, inject } from '@angular/core';
import { LeaveRecord, LeaveRecordInput } from '../models/leave.models';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

const TABLE = 'leave_records';

@Injectable({ providedIn: 'root' })
export class LeaveRecordsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** All records for the current user, newest first. Pages through PostgREST's row cap. */
  async list(): Promise<LeaveRecord[]> {
    const pageSize = 1000;
    const all: LeaveRecord[] = [];
    for (let from = 0; ; from += pageSize) {
      const page = unwrap(
        await this.supabase.client
          .from(TABLE)
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1),
      ) as LeaveRecord[];
      all.push(...page);
      if (page.length < pageSize) {
        break;
      }
    }
    return all;
  }

  async create(input: LeaveRecordInput): Promise<LeaveRecord> {
    const payload = {
      ...this.toPayload(input),
      user_id: this.auth.requireUserId(),
    };
    return unwrap(
      await this.supabase.client.from(TABLE).insert(payload).select('*').single(),
    ) as LeaveRecord;
  }

  async update(id: string, input: Partial<LeaveRecordInput>): Promise<LeaveRecord> {
    return unwrap(
      await this.supabase.client
        .from(TABLE)
        .update(this.toPayload(input))
        .eq('id', id)
        .select('*')
        .single(),
    ) as LeaveRecord;
  }

  async delete(id: string): Promise<void> {
    unwrap(await this.supabase.client.from(TABLE).delete().eq('id', id));
  }

  /** Strips `days` (generated column) and undefined values from write payloads. */
  private toPayload(input: Partial<LeaveRecordInput>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'days' && value !== undefined) {
        payload[key] = value;
      }
    }
    if (input.title !== undefined) {
      payload['title'] = input.title.trim();
    }
    return payload;
  }
}
