import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideDatabaseBackup, LucideDownload, LucideFileUp, LucideUpload } from '@lucide/angular';
import { format } from 'date-fns';
import { CATEGORIES, ImportBatch } from '../../core/models/leave.models';
import {
  CsvFile,
  CsvImportService,
  ImportPreview,
  PreviewRowState,
} from '../../core/services/csv-import.service';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import { SettingsService, parseBackup } from '../../core/services/settings.service';
import { ToastService } from '../../core/services/toast.service';
import { serializeCsv } from '../../core/utils/csv';
import { fromIsoDate } from '../../core/utils/dates';
import { downloadText } from '../../core/utils/download';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiBadge, BadgeTone } from '../../shared/ui/ui-badge';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiEmptyState } from '../../shared/ui/ui-empty-state';

const STATE_TONE: Record<PreviewRowState, BadgeTone> = {
  new: 'success',
  existing: 'neutral',
  needs_review: 'warning',
  invalid: 'danger',
};

const STATE_LABEL: Record<PreviewRowState, string> = {
  new: 'New',
  existing: 'Already imported',
  needs_review: 'Needs review',
  invalid: 'Invalid',
};

@Component({
  selector: 'app-data-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    PageHeader,
    SettingsTabs,
    UiCard,
    UiButton,
    UiBadge,
    UiConfirmDialog,
    UiEmptyState,
    LucideDownload,
    LucideUpload,
    LucideFileUp,
    LucideDatabaseBackup,
  ],
  template: `
    <app-page-header title="Settings" subtitle="Import, export and back up your data" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <div class="grid gap-4">
      <ui-card title="Import CSV" description="Preview, validate and de-duplicate before anything is written.">
        <div class="flex flex-wrap items-center gap-2">
          <button uiButton variant="outline" size="sm" [loading]="busy() === 'preview'" (click)="previewBundled()">
            <svg lucideFileUp size="14"></svg> Preview bundled CSVs
          </button>
          <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-card-hover sm:min-h-8">
            <svg lucideUpload size="14"></svg> Choose CSV files…
            <input type="file" accept=".csv,text/csv" multiple class="sr-only" (change)="previewFiles($event)" />
          </label>
        </div>

        @if (preview(); as p) {
          <div class="mt-5 space-y-4">
            @for (err of p.fileErrors; track err) {
              <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{{ err }}</p>
            }

            <dl class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid-cols-7">
              @for (s of stats(); track s.label) {
                <div class="rounded-lg border border-border p-3">
                  <dt class="text-[11px] text-muted">{{ s.label }}</dt>
                  <dd class="mt-1 text-xl font-semibold tabular-nums">{{ s.value }}</dd>
                </div>
              }
            </dl>

            <div class="flex flex-wrap gap-2">
              @for (c of categories; track c.id) {
                <ui-badge [category]="c.id">{{ c.short }}: {{ p.reconcile.totals[c.id] }} d</ui-badge>
              }
            </div>

            <div class="max-h-80 overflow-auto rounded-lg border border-border">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-card text-left text-muted">
                  <tr>
                    <th class="px-3 py-2 font-medium">Date</th>
                    <th class="px-3 py-2 font-medium">Entry</th>
                    <th class="px-3 py-2 font-medium">Category</th>
                    <th class="px-3 py-2 font-medium">Duration</th>
                    <th class="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of p.rows; track r.row.source_key) {
                    <tr class="border-t border-border/60">
                      <td class="px-3 py-2 whitespace-nowrap">{{ r.row.date ?? '–' }}</td>
                      <td class="px-3 py-2">{{ r.row.title }}</td>
                      <td class="px-3 py-2">{{ r.row.category ?? '?' }}</td>
                      <td class="px-3 py-2">{{ r.row.duration ?? '–' }}</td>
                      <td class="px-3 py-2">
                        <ui-badge [tone]="tone(r.state)">{{ label(r.state) }}</ui-badge>
                        @if (r.row.issues.length > 0) { <span class="ml-1 text-muted">{{ r.row.issues.join('; ') }}</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="flex flex-wrap justify-end gap-2">
              <button uiButton variant="ghost" size="sm" (click)="preview.set(null)">Discard</button>
              <button uiButton size="sm" [disabled]="p.toInsert.length === 0" [loading]="busy() === 'import'" (click)="commitImport()">
                Import {{ p.toInsert.length }} row(s)
              </button>
            </div>
          </div>
        }
      </ui-card>

      <div class="grid gap-4 md:grid-cols-2">
        <ui-card title="Export" description="Download your data.">
          <div class="flex flex-wrap gap-2">
            <button uiButton variant="outline" size="sm" [loading]="busy() === 'csv'" (click)="exportCsv()">
              <svg lucideDownload size="14"></svg> Export CSV
            </button>
            <button uiButton variant="outline" size="sm" [loading]="busy() === 'json'" (click)="exportJson()">
              <svg lucideDatabaseBackup size="14"></svg> Export JSON backup
            </button>
          </div>
        </ui-card>

        <ui-card title="Restore from backup" description="Upserts records, allocations, comp-off entries and settings from a JSON backup.">
          <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-card-hover sm:min-h-8">
            <svg lucideUpload size="14"></svg> Choose backup file…
            <input type="file" accept="application/json,.json" class="sr-only" (change)="pickBackup($event)" />
          </label>
          @if (pendingBackupName()) { <p class="mt-2 text-xs text-muted">Selected: {{ pendingBackupName() }}</p> }
        </ui-card>
      </div>

      <ui-card title="Import history" [padded]="false">
        @if (batches().length === 0) {
          <div class="p-5"><ui-empty-state title="No imports yet" description="Imports and restores will be listed here." /></div>
        } @else {
          <table class="w-full text-sm">
            <thead>
              <tr class="border-y border-border text-left text-xs text-muted">
                <th class="px-4 py-2 font-medium">When</th>
                <th class="px-4 py-2 font-medium">Source</th>
                <th class="px-4 py-2 font-medium">Files</th>
                <th class="px-4 py-2 text-right font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              @for (b of batches(); track b.id) {
                <tr class="border-b border-border/60 last:border-0">
                  <td class="px-4 py-2 whitespace-nowrap">{{ b.created_at | date: 'd MMM y, HH:mm' }}</td>
                  <td class="px-4 py-2">{{ b.source }}</td>
                  <td class="max-w-64 truncate px-4 py-2 text-muted" [title]="b.file_names.join(', ')">{{ b.file_names.join(', ') }}</td>
                  <td class="px-4 py-2 text-right tabular-nums">{{ b.record_count }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </ui-card>
    </div>

    <ui-confirm-dialog
      [open]="pendingBackup() !== null"
      title="Restore backup?"
      message="Records, allocations, comp-off entries and settings from the backup will be upserted into your account."
      confirmLabel="Restore"
      [destructive]="false"
      [loading]="busy() === 'restore'"
      (cancelled)="clearBackup()"
      (confirmed)="restore()"
    />
  `,
})
export class DataManagementPage {
  private readonly importer = inject(CsvImportService);
  private readonly records = inject(LeaveRecordsService);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  protected readonly categories = CATEGORIES;
  protected readonly busy = signal<'preview' | 'import' | 'csv' | 'json' | 'restore' | null>(null);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly batches = signal<ImportBatch[]>([]);
  protected readonly pendingBackup = signal<ReturnType<typeof parseBackup> | null>(null);
  protected readonly pendingBackupName = signal('');

  protected readonly stats = computed(() => {
    const p = this.preview();
    if (!p) {
      return [];
    }
    return [
      { label: 'Rows read', value: p.reconcile.inputCount },
      { label: 'Duplicates merged', value: p.reconcile.duplicatesRemoved },
      { label: 'Unique rows', value: p.reconcile.rows.length },
      { label: 'Complete', value: p.reconcile.completeCount },
      { label: 'Needs review', value: p.reconcile.needsReviewCount },
      { label: 'Already imported', value: p.existingCount },
      { label: 'Invalid', value: p.reconcile.invalidCount },
    ];
  });

  constructor() {
    void this.loadBatches();
  }

  protected tone(state: PreviewRowState): BadgeTone {
    return STATE_TONE[state];
  }

  protected label(state: PreviewRowState): string {
    return STATE_LABEL[state];
  }

  private async loadBatches(): Promise<void> {
    try {
      this.batches.set(await this.importer.listBatches());
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not load import history.');
    }
  }

  protected async previewBundled(): Promise<void> {
    this.busy.set('preview');
    try {
      const files = await this.importer.loadBundledCsvs();
      this.preview.set(await this.importer.preview(files));
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not load the bundled CSV files.');
    } finally {
      this.busy.set(null);
    }
  }

  protected async previewFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    input.value = '';
    if (selected.length === 0) {
      return;
    }
    this.busy.set('preview');
    try {
      const files: CsvFile[] = await Promise.all(selected.map((f) => this.importer.readFile(f)));
      this.preview.set(await this.importer.preview(files));
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not read the selected files.');
    } finally {
      this.busy.set(null);
    }
  }

  protected async commitImport(): Promise<void> {
    const preview = this.preview();
    if (!preview) {
      return;
    }
    this.busy.set('import');
    try {
      const result = await this.importer.commit(preview, 'csv');
      this.toast.success(`Imported ${result.inserted} row(s); skipped ${result.skipped} duplicate(s).`);
      this.preview.set(null);
      await this.loadBatches();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      this.busy.set(null);
    }
  }

  protected async exportCsv(): Promise<void> {
    this.busy.set('csv');
    try {
      const all = await this.records.list();
      const rows = [...all]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => {
          const d = fromIsoDate(r.date);
          return [r.title, format(d, 'MMMM d, yyyy'), r.category, format(d, 'MMM yyyy'), r.duration ?? '', r.notes ?? ''];
        });
      downloadText(
        `myalibi-records-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        serializeCsv([['Entry', 'Date', 'Category', 'Month', 'Type', 'Notes'], ...rows]),
        'text/csv',
      );
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      this.busy.set(null);
    }
  }

  protected async exportJson(): Promise<void> {
    this.busy.set('json');
    try {
      const backup = await this.settings.exportBackup();
      downloadText(
        `myalibi-backup-${format(new Date(), 'yyyy-MM-dd')}.json`,
        JSON.stringify(backup, null, 2),
        'application/json',
      );
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Backup failed.');
    } finally {
      this.busy.set(null);
    }
  }

  protected async pickBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      this.pendingBackup.set(parseBackup(await file.text()));
      this.pendingBackupName.set(file.name);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Invalid backup file.');
    }
  }

  protected clearBackup(): void {
    this.pendingBackup.set(null);
    this.pendingBackupName.set('');
  }

  protected async restore(): Promise<void> {
    const backup = this.pendingBackup();
    if (!backup) {
      return;
    }
    this.busy.set('restore');
    try {
      const s = await this.settings.restoreBackup(backup);
      this.toast.success(
        `Restored ${s.records} record(s), ${s.allocations} allocation(s), ${s.compOff} comp-off entr${s.compOff === 1 ? 'y' : 'ies'}.`,
      );
      this.clearBackup();
      await this.loadBatches();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      this.busy.set(null);
    }
  }
}
