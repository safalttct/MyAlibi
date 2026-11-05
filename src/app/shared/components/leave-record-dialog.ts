import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { format } from 'date-fns';
import {
  LeaveCategory,
  LeaveDuration,
  LeaveRecord,
  LeaveRecordInput,
  categoryMeta,
  normalizeCategory,
} from '../../core/models/leave.models';
import { CategoryPreferencesService } from '../../core/services/category-preferences.service';
import { LeaveRecordsStore } from '../../core/services/leave-records.store';
import { addDaysIso, fromIsoDate, todayIso } from '../../core/utils/dates';
import { WORKING_DAYS_RANGE_CAP, describeSkipped, workingDaysInRange } from '../../core/utils/working-days';
import { UiButton } from '../ui/ui-button';
import { UiDateField } from '../ui/ui-date-field';
import { UiDialog } from '../ui/ui-dialog';
import { UiField } from '../ui/ui-field';
import { UiInput } from '../ui/ui-input';

type WhenMode = 'today' | 'tomorrow' | 'pick' | 'range';

/** Create / edit dialog for a leave or WFH record. Quick-add first; More details optional. */
@Component({
  selector: 'app-leave-record-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiDialog, UiButton, UiDateField, UiField, UiInput],
  template: `
    <ui-dialog
      [open]="open()"
      [title]="record() ? 'Edit record' : 'Add leave'"
      [description]="
        record()?.status === 'needs_review'
          ? 'This record needs review: choose a duration.'
          : record()
            ? ''
            : 'Log a day in a few taps'
      "
      (closed)="closed.emit()"
    >
      <div class="grid gap-3 sm:gap-4">
        <div>
          <p class="mb-1.5 text-xs font-medium text-muted sm:mb-2">Type</p>
          <div class="flex flex-wrap gap-2">
            @for (c of visibleCategories(); track c.id) {
              <button
                type="button"
                class="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors"
                [class]="
                  category() === c.id
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-muted hover:text-foreground'
                "
                (click)="category.set(c.id)"
              >
                <span class="size-2 shrink-0 rounded-full" [class]="c.dotClass"></span>
                {{ c.short }}
              </button>
            }
            @if (hiddenCategories().length > 0) {
              <button
                type="button"
                class="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
                (click)="showMoreTypes.update((v) => !v)"
              >
                {{ showMoreTypes() ? 'Less' : 'More' }}
              </button>
            }
          </div>
        </div>

        @if (!record()) {
          <div>
            <p class="mb-1.5 text-xs font-medium text-muted sm:mb-2">When</p>
            <div class="flex flex-wrap gap-2">
              @for (opt of whenOptions; track opt.id) {
                <button
                  type="button"
                  class="inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-medium transition-colors"
                  [class]="
                    whenMode() === opt.id
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted hover:text-foreground'
                  "
                  (click)="setWhen(opt.id)"
                >
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
        }

        @if (record() || whenMode() === 'pick') {
          <ui-field label="Date" [required]="true">
            <ui-date-field
              label="Date"
              [value]="singleDate()"
              (valueChange)="singleDate.set($event)"
            />
          </ui-field>
        }

        @if (!record() && whenMode() === 'range') {
          <ui-field label="Date range" [required]="true">
            <ui-date-field
              mode="range"
              label="Date range"
              placeholder="Pick start and end"
              [start]="rangeStart()"
              [end]="rangeEnd()"
              (rangeChange)="onRangePicked($event)"
            />
          </ui-field>
          @if (rangePreview()) {
            <p class="text-xs text-muted">{{ rangePreview() }}</p>
          }
          @if (rangeError()) {
            <p class="text-xs text-danger">{{ rangeError() }}</p>
          }
        }

        <div>
          <p class="mb-1.5 text-xs font-medium text-muted sm:mb-2">Duration</p>
          <div class="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
            @for (d of durations; track d) {
              <button
                type="button"
                class="min-h-10 rounded-lg text-sm font-medium transition-colors"
                [disabled]="d === 'Half Day' && isRange()"
                [class]="
                  duration() === d
                    ? 'bg-primary-soft text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                (click)="setDuration(d)"
              >
                {{ d }}
              </button>
            }
          </div>
          @if (isRange()) {
            <p class="mt-1.5 text-[11px] text-muted">Ranges are always full days.</p>
          }
        </div>

        <div>
          <button
            type="button"
            class="text-xs font-medium text-primary hover:underline"
            (click)="moreOpen.update((v) => !v)"
          >
            {{ moreOpen() ? 'Hide details' : 'More details' }}
          </button>
          @if (moreOpen()) {
            <div class="mt-3 grid gap-3">
              <ui-field label="Title" hint="Defaults to the leave type">
                <input
                  uiInput
                  type="text"
                  [ngModel]="title()"
                  (ngModelChange)="title.set($event)"
                  placeholder="e.g. Home renovation work"
                />
              </ui-field>
              <ui-field label="Notes">
                <textarea
                  uiInput
                  rows="3"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                  placeholder="Optional"
                ></textarea>
              </ui-field>
            </div>
          }
        </div>

        @if (error()) {
          <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {{ error() }}
          </p>
        }
      </div>

      <ng-container dialogFooter>
        @if (record()) {
          <button
            uiButton
            variant="ghost"
            type="button"
            class="mr-auto text-danger"
            [loading]="deleting()"
            (click)="remove()"
          >
            Delete
          </button>
        }
        <button uiButton variant="ghost" type="button" (click)="closed.emit()">Cancel</button>
        <button uiButton type="button" [disabled]="!!rangeError()" [loading]="saving()" (click)="submit()">
          {{ submitLabel() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class LeaveRecordDialog {
  private readonly store = inject(LeaveRecordsStore);
  private readonly prefs = inject(CategoryPreferencesService);

  readonly open = input(false);
  readonly record = input<LeaveRecord | null>(null);
  readonly defaultDate = input<string | null>(null);
  readonly defaultCategory = input<LeaveCategory | null>(null);

  readonly closed = output<void>();
  /** Emitted after a successful create, update or delete (store already updated). */
  readonly saved = output<void>();

  protected readonly whenOptions: { id: WhenMode; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'pick', label: 'Pick date' },
    { id: 'range', label: 'Date range' },
  ];
  protected readonly durations: LeaveDuration[] = ['Full Day', 'Half Day'];

  protected readonly category = signal<LeaveCategory>('Casual Leave');
  protected readonly whenMode = signal<WhenMode>('today');
  protected readonly singleDate = signal(todayIso());
  protected readonly rangeStart = signal(todayIso());
  protected readonly rangeEnd = signal(todayIso());
  protected readonly duration = signal<LeaveDuration>('Full Day');
  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly moreOpen = signal(false);
  protected readonly showMoreTypes = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly categories = computed(() => {
    const enabled = [...this.prefs.enabledCategories()];
    const current = this.record()?.category;
    if (current) {
      const id = normalizeCategory(current);
      if (!enabled.some((c) => c.id === id)) {
        enabled.unshift(categoryMeta(id));
      }
    }
    return enabled;
  });

  protected readonly visibleCategories = computed(() => {
    const all = this.categories();
    if (this.showMoreTypes() || all.length <= 4) {
      return all;
    }
    const head = all.slice(0, 4);
    const selected = this.category();
    if (head.some((c) => c.id === selected)) {
      return head;
    }
    const extra = all.find((c) => c.id === selected);
    return extra ? [...head.slice(0, 3), extra] : head;
  });

  protected readonly hiddenCategories = computed(() => {
    const all = this.categories();
    return all.length > 4 ? all.slice(4) : [];
  });

  protected readonly isRange = computed(() => !this.record() && this.whenMode() === 'range');

  private readonly rangePlan = computed(() => {
    if (!this.isRange()) {
      return null;
    }
    return workingDaysInRange(this.rangeStart(), this.rangeEnd());
  });

  protected readonly rangeError = computed(() => {
    if (!this.isRange()) {
      return null;
    }
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (!start || !end) {
      return 'Choose a start and end date.';
    }
    if (end < start) {
      return 'End must be on or after start.';
    }
    const span =
      Math.round(
        (fromIsoDate(end).getTime() - fromIsoDate(start).getTime()) / 86_400_000,
      ) + 1;
    if (span > WORKING_DAYS_RANGE_CAP) {
      return `Range cannot be longer than ${WORKING_DAYS_RANGE_CAP} calendar days.`;
    }
    const plan = this.rangePlan();
    if (!plan || plan.included.length === 0) {
      return 'No working days in this range (weekends and holidays are skipped).';
    }
    return null;
  });

  protected readonly datesToAdd = computed(() => {
    if (this.record()) {
      return [this.singleDate()];
    }
    if (this.whenMode() === 'range') {
      return this.rangePlan()?.included ?? [];
    }
    return [this.resolvedSingleDate()];
  });

  /** Same category already logged on those dates. */
  private readonly conflictingDates = computed(() => {
    const cat = this.category();
    const existing = this.store.records();
    const editingId = this.record()?.id;
    return this.datesToAdd().filter((date) =>
      existing.some(
        (r) =>
          r.id !== editingId &&
          r.date === date &&
          normalizeCategory(r.category) === normalizeCategory(cat),
      ),
    );
  });

  protected readonly rangePreview = computed(() => {
    if (!this.isRange()) {
      return null;
    }
    const plan = this.rangePlan();
    if (!plan) {
      return null;
    }
    const n = plan.included.length;
    const bits: string[] = [`${n} working day${n === 1 ? '' : 's'}`];
    const skipLabel = describeSkipped(plan.skipped);
    if (skipLabel) {
      bits.push(`skips ${skipLabel}`);
    }
    const conflicts = this.conflictingDates();
    if (conflicts.length > 0) {
      bits.push(
        `${conflicts.length} already logged (${conflicts
          .map((d) => format(fromIsoDate(d), 'd MMM'))
          .join(', ')})`,
      );
    }
    return bits.join(' · ');
  });

  protected readonly submitLabel = computed(() => {
    if (this.record()) {
      return 'Save changes';
    }
    const dates = this.datesToAdd().filter((d) => !this.conflictingDates().includes(d));
    const n = dates.length;
    if (n <= 1) {
      return 'Add 1 day';
    }
    return `Add ${n} days`;
  });

  constructor() {
    void this.prefs.ensureLoaded();
    void this.store.ensureLoaded();
    effect(() => {
      if (!this.open()) {
        return;
      }
      const record = this.record();
      const defaultDate = this.defaultDate();
      const defaultCategory = this.defaultCategory();
      const enabled = this.prefs.enabledCategories();
      untracked(() => {
        this.error.set(null);
        this.saving.set(false);
        this.deleting.set(false);
        this.moreOpen.set(!!record);
        this.showMoreTypes.set(false);
        const fallback = enabled[0]?.id ?? 'Casual Leave';
        const category = normalizeCategory(record?.category ?? defaultCategory ?? fallback);
        this.category.set(category);
        this.duration.set(record?.duration ?? 'Full Day');
        this.title.set(record?.title ?? '');
        this.notes.set(record?.notes ?? '');
        const date = record?.date ?? defaultDate ?? todayIso();
        this.singleDate.set(date);
        this.rangeStart.set(date);
        this.rangeEnd.set(date);
        if (record) {
          this.whenMode.set('pick');
        } else if (defaultDate && defaultDate !== todayIso()) {
          this.whenMode.set('pick');
        } else {
          this.whenMode.set('today');
        }
      });
    });
  }

  protected setWhen(mode: WhenMode): void {
    this.whenMode.set(mode);
    if (mode === 'range' && this.duration() === 'Half Day') {
      this.duration.set('Full Day');
    }
  }

  protected onRangePicked(range: { start: string; end: string }): void {
    this.rangeStart.set(range.start);
    this.rangeEnd.set(range.end);
  }

  protected setDuration(d: LeaveDuration): void {
    if (d === 'Half Day' && this.isRange()) {
      return;
    }
    this.duration.set(d);
  }

  private resolvedSingleDate(): string {
    const mode = this.whenMode();
    if (mode === 'tomorrow') {
      return addDaysIso(todayIso(), 1);
    }
    if (mode === 'today') {
      return todayIso();
    }
    return this.singleDate() || todayIso();
  }

  protected async submit(): Promise<void> {
    if (this.saving() || this.rangeError()) {
      return;
    }
    const existing = this.record();
    const category = this.category();
    const meta = categoryMeta(category);
    const title = this.title().trim() || meta.label;
    const notes = this.notes().trim() || null;
    const duration = this.isRange() ? 'Full Day' : this.duration();

    if (existing) {
      this.saving.set(true);
      this.error.set(null);
      this.closed.emit();
      try {
        await this.store.update(existing.id, {
          title,
          category,
          date: this.singleDate(),
          duration,
          notes,
          status: 'complete',
        });
        this.saved.emit();
      } catch {
        // Store already toasted the error.
      } finally {
        this.saving.set(false);
      }
      return;
    }

    const conflicts = new Set(this.conflictingDates());
    const dates = this.datesToAdd().filter((d) => !conflicts.has(d));
    if (dates.length === 0) {
      this.error.set(
        conflicts.size > 0
          ? 'Those days are already logged for this leave type.'
          : 'No days to add.',
      );
      return;
    }

    const inputs: LeaveRecordInput[] = dates.map((date) => ({
      title,
      category,
      date,
      duration,
      notes,
      status: 'complete',
    }));

    this.saving.set(true);
    this.error.set(null);
    this.closed.emit();
    try {
      await this.store.add(inputs);
      this.saved.emit();
    } catch {
      // Store already toasted the error.
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const existing = this.record();
    if (!existing || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.closed.emit();
    try {
      await this.store.remove(existing);
      this.saved.emit();
    } catch {
      // Store already toasted.
    } finally {
      this.deleting.set(false);
    }
  }
}
