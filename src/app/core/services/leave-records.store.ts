import { Injectable, effect, inject, signal } from '@angular/core';
import { LeaveRecord, LeaveRecordInput, durationToDays } from '../models/leave.models';
import { AuthService } from './auth.service';
import { LeaveRecordsService } from './leave-records.service';
import { ToastService } from './toast.service';

function sortNewest(a: LeaveRecord, b: LeaveRecord): number {
  return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
}

function tempId(): string {
  return `tmp-${crypto.randomUUID()}`;
}

function optimisticRecord(input: LeaveRecordInput, userId: string): LeaveRecord {
  const now = new Date().toISOString();
  return {
    id: tempId(),
    user_id: userId,
    title: input.title.trim(),
    category: input.category,
    date: input.date,
    duration: input.duration,
    days: durationToDays(input.duration),
    notes: input.notes ?? null,
    status: input.status ?? 'complete',
    source_key: input.source_key ?? null,
    import_batch_id: input.import_batch_id ?? null,
    created_at: now,
    updated_at: now,
  };
}

@Injectable({ providedIn: 'root' })
export class LeaveRecordsStore {
  private readonly service = inject(LeaveRecordsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly records = signal<LeaveRecord[]>([]);
  readonly loaded = signal(false);
  /** Bumped after successful mutations so pages can refetch balances quietly. */
  readonly changes = signal(0);

  private loadPromise: Promise<void> | null = null;

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this.clear();
      }
    });
  }

  clear(): void {
    this.records.set([]);
    this.loaded.set(false);
    this.loadPromise = null;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded()) {
      return;
    }
    await this.refresh();
  }

  async refresh(options?: { notify?: boolean }): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.clear();
      return;
    }
    this.loadPromise ??= this.doRefresh().finally(() => {
      this.loadPromise = null;
    });
    await this.loadPromise;
    if (options?.notify) {
      this.bump();
    }
  }

  private async doRefresh(): Promise<void> {
    const rows = await this.service.list();
    this.records.set(rows);
    this.loaded.set(true);
  }

  async add(inputs: LeaveRecordInput[]): Promise<LeaveRecord[]> {
    if (inputs.length === 0) {
      return [];
    }
    const userId = this.auth.requireUserId();
    const temps = inputs.map((input) => optimisticRecord(input, userId));
    this.records.update((list) => [...temps, ...list].sort(sortNewest));

    try {
      const saved = await this.service.createMany(inputs);
      const tempIds = new Set(temps.map((t) => t.id));
      this.records.update((list) =>
        [...list.filter((r) => !tempIds.has(r.id)), ...saved].sort(sortNewest),
      );
      this.bump();
      this.toast.success(saved.length === 1 ? 'Record added' : `${saved.length} records added`);
      return saved;
    } catch (e) {
      const tempIds = new Set(temps.map((t) => t.id));
      this.records.update((list) => list.filter((r) => !tempIds.has(r.id)));
      this.toast.error(e instanceof Error ? e.message : 'Could not add the record.');
      throw e;
    }
  }

  async update(id: string, input: Partial<LeaveRecordInput>): Promise<LeaveRecord> {
    const previous = this.records().find((r) => r.id === id);
    if (!previous) {
      throw new Error('Record not found.');
    }
    const optimistic: LeaveRecord = {
      ...previous,
      ...input,
      title: input.title !== undefined ? input.title.trim() : previous.title,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      days:
        input.duration !== undefined
          ? durationToDays(input.duration)
          : previous.days,
      updated_at: new Date().toISOString(),
    };
    this.records.update((list) =>
      list.map((r) => (r.id === id ? optimistic : r)).sort(sortNewest),
    );

    try {
      const saved = await this.service.update(id, input);
      this.records.update((list) =>
        list.map((r) => (r.id === id ? saved : r)).sort(sortNewest),
      );
      this.bump();
      this.toast.success('Record updated');
      return saved;
    } catch (e) {
      this.records.update((list) =>
        list.map((r) => (r.id === id ? previous : r)).sort(sortNewest),
      );
      this.toast.error(e instanceof Error ? e.message : 'Could not update the record.');
      throw e;
    }
  }

  async remove(record: LeaveRecord): Promise<void> {
    const snapshot = record;
    this.records.update((list) => list.filter((r) => r.id !== snapshot.id));

    try {
      await this.service.delete(snapshot.id);
      this.bump();
      this.toast.showWithAction('Record deleted', {
        label: 'Undo',
        run: () => this.undoRemove(snapshot),
      });
    } catch (e) {
      this.records.update((list) => [...list, snapshot].sort(sortNewest));
      this.toast.error(e instanceof Error ? e.message : 'Could not delete the record.');
      throw e;
    }
  }

  /** Re-insert after Undo. Kept package-visible for tests. */
  async undoRemove(record: LeaveRecord): Promise<void> {
    this.records.update((list) => {
      if (list.some((r) => r.id === record.id)) {
        return list;
      }
      return [...list, record].sort(sortNewest);
    });
    try {
      const saved = await this.service.restore(record);
      this.records.update((list) =>
        [...list.filter((r) => r.id !== record.id), saved].sort(sortNewest),
      );
      this.bump();
      this.toast.success('Record restored');
    } catch (e) {
      this.records.update((list) => list.filter((r) => r.id !== record.id));
      this.toast.error(e instanceof Error ? e.message : 'Could not restore the record.');
    }
  }

  private bump(): void {
    this.changes.update((n) => n + 1);
  }
}
