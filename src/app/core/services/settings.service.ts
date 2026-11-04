import { Injectable, inject } from '@angular/core';
import {
  AppSetting,
  CompOffTransaction,
  LeaveAllocation,
  LeaveRecord,
  Profile,
} from '../models/leave.models';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

export interface BackupFile {
  version: number;
  exported_at?: string;
  profile?: Partial<Profile> | null;
  leave_records?: Partial<LeaveRecord>[];
  leave_allocations?: Partial<LeaveAllocation>[];
  comp_off_transactions?: Partial<CompOffTransaction>[];
  app_settings?: Partial<AppSetting>[];
}

export interface RestoreSummary {
  records: number;
  allocations: number;
  compOff: number;
  settings: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates the structure of a backup produced by `export_user_backup`. */
export function parseBackup(json: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (!isObject(parsed) || typeof parsed['version'] !== 'number') {
    throw new Error('Backup file is missing a "version" field.');
  }
  for (const key of ['leave_records', 'leave_allocations', 'comp_off_transactions', 'app_settings']) {
    if (parsed[key] !== undefined && !Array.isArray(parsed[key])) {
      throw new Error(`Backup field "${key}" must be an array.`);
    }
  }
  return parsed as unknown as BackupFile;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async getProfile(): Promise<Profile | null> {
    const userId = this.auth.requireUserId();
    return unwrap(
      await this.supabase.client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    ) as Profile | null;
  }

  async updateProfile(input: { display_name: string | null; timezone: string }): Promise<Profile> {
    const userId = this.auth.requireUserId();
    return unwrap(
      await this.supabase.client
        .from('profiles')
        .upsert({ id: userId, ...input })
        .select('*')
        .single(),
    ) as Profile;
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const row = unwrap(
      await this.supabase.client
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle(),
    ) as AppSetting | null;
    return row ? (row.value as T) : null;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    unwrap(
      await this.supabase.client
        .from('app_settings')
        .upsert({ user_id: this.auth.requireUserId(), key, value }, { onConflict: 'user_id,key' }),
    );
  }

  async listSettings(): Promise<AppSetting[]> {
    return unwrap(
      await this.supabase.client.from('app_settings').select('*').order('key'),
    ) as AppSetting[];
  }

  /** Full JSON backup produced server-side by the `export_user_backup` RPC. */
  async exportBackup(): Promise<BackupFile> {
    return unwrap(await this.supabase.client.rpc('export_user_backup')) as BackupFile;
  }

  /**
   * Client-side restore: upserts everything under the current user.
   * Restored leave records are tagged with a fresh import batch so historical
   * comp-off usage is not rejected by the interactive balance check.
   */
  async restoreBackup(backup: BackupFile): Promise<RestoreSummary> {
    const client = this.supabase.client;
    const userId = this.auth.requireUserId();
    const summary: RestoreSummary = { records: 0, allocations: 0, compOff: 0, settings: 0 };

    if (backup.profile) {
      await this.updateProfile({
        display_name: backup.profile.display_name ?? null,
        timezone: backup.profile.timezone ?? 'Asia/Kolkata',
      });
    }

    const allocations = (backup.leave_allocations ?? []).map((a) => ({
      user_id: userId,
      category: a.category,
      period_start: a.period_start,
      period_end: a.period_end,
      opening_balance: a.opening_balance ?? 0,
      annual_allocation: a.annual_allocation ?? 0,
      carry_forward_allocation: a.carry_forward_allocation ?? 0,
      carry_forward_expiry: a.carry_forward_expiry ?? null,
    }));
    if (allocations.length > 0) {
      unwrap(
        await client
          .from('leave_allocations')
          .upsert(allocations, { onConflict: 'user_id,category,period_start,period_end' }),
      );
      summary.allocations = allocations.length;
    }

    const records = backup.leave_records ?? [];
    if (records.length > 0) {
      const batch = unwrap(
        await client
          .from('import_batches')
          .insert({
            user_id: userId,
            source: 'json_restore',
            file_names: ['backup.json'],
            record_count: records.length,
          })
          .select('id')
          .single(),
      ) as { id: string };

      const payload = records.map((r) => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        category: r.category,
        date: r.date,
        duration: r.duration ?? null,
        notes: r.notes ?? null,
        status: r.status ?? (r.duration ? 'complete' : 'needs_review'),
        source_key: r.source_key ?? null,
        import_batch_id: batch.id,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        unwrap(
          await client.from('leave_records').upsert(payload.slice(i, i + 200), { onConflict: 'id' }),
        );
      }
      summary.records = payload.length;
    }

    const compOff = (backup.comp_off_transactions ?? [])
      .filter((t) => !t.leave_record_id)
      .map((t) => ({
        id: t.id,
        user_id: userId,
        transaction_date: t.transaction_date,
        type: t.type,
        days: t.days,
        expiry_date: t.expiry_date ?? null,
        notes: t.notes ?? null,
      }));
    if (compOff.length > 0) {
      unwrap(await client.from('comp_off_transactions').upsert(compOff, { onConflict: 'id' }));
      summary.compOff = compOff.length;
    }

    const settings = (backup.app_settings ?? []).map((s) => ({
      user_id: userId,
      key: s.key,
      value: s.value ?? {},
    }));
    if (settings.length > 0) {
      unwrap(await client.from('app_settings').upsert(settings, { onConflict: 'user_id,key' }));
      summary.settings = settings.length;
    }

    return summary;
  }
}
