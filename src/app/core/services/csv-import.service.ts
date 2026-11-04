import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ImportBatch, LeaveCategory, durationToDays } from '../models/leave.models';
import { ParsedLeaveRow, parseLeaveCsv } from '../utils/csv-parse-leave';
import { ReconcileResult, emptyTotals, reconcileLeaveRows } from '../utils/csv-reconcile';
import { AuthService } from './auth.service';
import { SupabaseService, unwrap } from './supabase.service';

export interface CsvFile {
  name: string;
  text: string;
}

export type PreviewRowState = 'new' | 'existing' | 'needs_review' | 'invalid';

export interface PreviewRow {
  row: ParsedLeaveRow;
  state: PreviewRowState;
}

export interface ImportPreview {
  fileNames: string[];
  reconcile: ReconcileResult;
  rows: PreviewRow[];
  fileErrors: string[];
  /** Rows that will be inserted (new + needs_review that do not exist yet). */
  toInsert: ParsedLeaveRow[];
  existingCount: number;
  /** Days that will be added per category (complete rows to insert only). */
  incomingTotals: Record<LeaveCategory, number>;
}

export interface ImportResult {
  batchId: string;
  inserted: number;
  skipped: number;
}

/** CSV files bundled under src/assets/data. */
export const BUNDLED_CSV_FILES: readonly string[] = [
  'Leave & WFH Tracker (Apr 2026-Apr 2027).csv',
  'Leave & WFH Tracker (Apr 2026-Apr 2027)_all.csv',
];

@Injectable({ providedIn: 'root' })
export class CsvImportService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async loadBundledCsvs(): Promise<CsvFile[]> {
    return Promise.all(
      BUNDLED_CSV_FILES.map(async (name) => ({
        name,
        text: await firstValueFrom(
          this.http.get(`assets/data/${encodeURIComponent(name)}`, { responseType: 'text' }),
        ),
      })),
    );
  }

  readFile(file: File): Promise<CsvFile> {
    return file.text().then((text) => ({ name: file.name, text }));
  }

  /** Parses + reconciles files, then classifies each unique row against existing keys. */
  buildPreview(files: readonly CsvFile[], existingKeys: ReadonlySet<string>): ImportPreview {
    const parsed = files.map((f) => parseLeaveCsv(f.text, f.name));
    const reconcile = reconcileLeaveRows(parsed.map((p) => p.rows));

    const rows: PreviewRow[] = reconcile.rows.map((row) => {
      let state: PreviewRowState;
      if (!row.valid) {
        state = 'invalid';
      } else if (existingKeys.has(row.source_key)) {
        state = 'existing';
      } else if (row.status === 'needs_review') {
        state = 'needs_review';
      } else {
        state = 'new';
      }
      return { row, state };
    });

    const toInsert = rows
      .filter((r) => r.state === 'new' || r.state === 'needs_review')
      .map((r) => r.row);
    const incomingTotals = emptyTotals();
    for (const row of toInsert) {
      if (row.status === 'complete' && row.category) {
        incomingTotals[row.category] += durationToDays(row.duration);
      }
    }

    return {
      fileNames: files.map((f) => f.name),
      reconcile,
      rows,
      fileErrors: parsed.flatMap((p) => p.errors),
      toInsert,
      existingCount: rows.filter((r) => r.state === 'existing').length,
      incomingTotals,
    };
  }

  async fetchExistingKeys(): Promise<Set<string>> {
    const keys = new Set<string>();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const page = unwrap(
        await this.supabase.client
          .from('leave_records')
          .select('source_key')
          .not('source_key', 'is', null)
          .range(from, from + pageSize - 1),
      ) as { source_key: string }[];
      page.forEach((r) => keys.add(r.source_key));
      if (page.length < pageSize) {
        break;
      }
    }
    return keys;
  }

  async preview(files: readonly CsvFile[]): Promise<ImportPreview> {
    return this.buildPreview(files, await this.fetchExistingKeys());
  }

  /** Commits an import: creates an import batch, then inserts only rows not yet in the DB. */
  async commit(preview: ImportPreview, source = 'csv'): Promise<ImportResult> {
    const client = this.supabase.client;
    const userId = this.auth.requireUserId();

    // Re-check right before writing so concurrent/previous imports never duplicate rows.
    const existing = await this.fetchExistingKeys();
    const rows = preview.toInsert.filter((r) => !existing.has(r.source_key));

    const batch = unwrap(
      await client
        .from('import_batches')
        .insert({
          user_id: userId,
          source,
          file_names: preview.fileNames,
          record_count: rows.length,
        })
        .select('*')
        .single(),
    ) as ImportBatch;

    const payload = rows.map((r) => ({
      user_id: userId,
      title: r.title,
      category: r.category,
      date: r.date,
      duration: r.duration,
      notes: r.notes,
      status: r.status,
      source_key: r.source_key,
      import_batch_id: batch.id,
    }));

    for (let i = 0; i < payload.length; i += 100) {
      unwrap(await client.from('leave_records').insert(payload.slice(i, i + 100)));
    }

    return {
      batchId: batch.id,
      inserted: rows.length,
      skipped: preview.toInsert.length - rows.length + preview.existingCount,
    };
  }

  async listBatches(): Promise<ImportBatch[]> {
    return unwrap(
      await this.supabase.client
        .from('import_batches')
        .select('*')
        .order('created_at', { ascending: false }),
    ) as ImportBatch[];
  }
}
