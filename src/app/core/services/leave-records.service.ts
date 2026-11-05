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
    const rows = await this.createMany([input]);
    return rows[0];
  }

  /** Insert many rows in one request so Comp Off triggers run together. */
  async createMany(inputs: LeaveRecordInput[]): Promise<LeaveRecord[]> {
    if (inputs.length === 0) {
      return [];
    }
    const userId = this.auth.requireUserId();
    const payload = inputs.map((input) => ({
      ...this.toPayload(input),
      user_id: userId,
    }));
    return unwrap(
      await this.supabase.client.from(TABLE).insert(payload).select('*'),
    ) as LeaveRecord[];
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

  /** Re-insert a previously deleted row (same id) so Undo can restore Comp Off links. */
  async restore(record: LeaveRecord): Promise<LeaveRecord> {
    this.auth.requireUserId();
    return unwrap(
      await this.supabase.client
        .from(TABLE)
        .insert({
          id: record.id,
          user_id: record.user_id,
          title: record.title,
          category: record.category,
          date: record.date,
          duration: record.duration,
          notes: record.notes,
          status: record.status,
          source_key: record.source_key,
          import_batch_id: record.import_batch_id,
        })
        .select('*')
        .single(),
    ) as LeaveRecord;
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
