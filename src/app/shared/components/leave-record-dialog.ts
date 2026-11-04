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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import {
  CATEGORIES,
  DURATIONS,
  LeaveCategory,
  LeaveDuration,
  LeaveRecord,
  durationToDays,
} from '../../core/models/leave.models';
import { LeaveRecordsService } from '../../core/services/leave-records.service';
import { ToastService } from '../../core/services/toast.service';
import { todayIso } from '../../core/utils/dates';
import { UiButton } from '../ui/ui-button';
import { UiConfirmDialog } from '../ui/ui-confirm-dialog';
import { UiDialog } from '../ui/ui-dialog';
import { UiField } from '../ui/ui-field';
import { UiInput } from '../ui/ui-input';
import { UiSelect } from '../ui/ui-select';

/** Create / edit dialog for a leave or WFH record. `days` is derived from duration. */
@Component({
  selector: 'app-leave-record-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiDialog, UiConfirmDialog, UiButton, UiField, UiInput, UiSelect],
  template: `
    <ui-dialog
      [open]="open()"
      [title]="record() ? 'Edit record' : 'Add record'"
      [description]="record()?.status === 'needs_review' ? 'This record needs review: choose a duration.' : ''"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" class="grid gap-4" (ngSubmit)="submit()" id="leave-record-form">
        <ui-field label="Title" [required]="true" [error]="errorFor('title')">
          <input uiInput formControlName="title" type="text" placeholder="e.g. Home renovation work" />
        </ui-field>

        <div class="grid gap-4 sm:grid-cols-2">
          <ui-field label="Category" [required]="true">
            <select uiSelect formControlName="category">
              @for (c of categories; track c.id) {
                <option [value]="c.id">{{ c.label }}</option>
              }
            </select>
          </ui-field>
          <ui-field label="Date" [required]="true" [error]="errorFor('date')">
            <input uiInput formControlName="date" type="date" />
          </ui-field>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <ui-field label="Duration" [required]="true" [error]="errorFor('duration')">
            <select uiSelect formControlName="duration">
              <option [ngValue]="null" disabled>Select duration</option>
              @for (d of durations; track d) {
                <option [ngValue]="d">{{ d }}</option>
              }
            </select>
          </ui-field>
          <ui-field label="Days" hint="Derived from duration">
            <input uiInput type="text" readonly [value]="days()" aria-readonly="true" />
          </ui-field>
        </div>

        <ui-field label="Notes">
          <textarea uiInput formControlName="notes" rows="3" placeholder="Optional"></textarea>
        </ui-field>

        @if (error()) {
          <p class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {{ error() }}
          </p>
        }
      </form>

      <ng-container dialogFooter>
        @if (record()) {
          <button uiButton variant="ghost" type="button" class="mr-auto text-danger" (click)="confirmDelete.set(true)">
            Delete
          </button>
        }
        <button uiButton variant="ghost" type="button" (click)="closed.emit()">Cancel</button>
        <button uiButton type="submit" form="leave-record-form" [loading]="saving()">
          {{ record() ? 'Save changes' : 'Add record' }}
        </button>
      </ng-container>
    </ui-dialog>

    <ui-confirm-dialog
      [open]="confirmDelete()"
      title="Delete record?"
      message="This permanently removes the record and updates your balances."
      confirmLabel="Delete"
      [loading]="saving()"
      (cancelled)="confirmDelete.set(false)"
      (confirmed)="remove()"
    />
  `,
})
export class LeaveRecordDialog {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly records = inject(LeaveRecordsService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly record = input<LeaveRecord | null>(null);
  readonly defaultDate = input<string | null>(null);
  readonly defaultCategory = input<LeaveCategory | null>(null);

  readonly closed = output<void>();
  /** Emitted after a successful create, update or delete. */
  readonly saved = output<void>();

  protected readonly categories = CATEGORIES;
  protected readonly durations = DURATIONS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  private readonly submitted = signal(false);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    category: this.fb.control<LeaveCategory>('Casual Leave', Validators.required),
    date: [todayIso(), Validators.required],
    duration: this.fb.control<LeaveDuration | null>('Full Day', Validators.required),
    notes: [''],
  });

  private readonly durationValue = toSignal(
    this.form.controls.duration.valueChanges.pipe(startWith(this.form.controls.duration.value)),
    { initialValue: this.form.controls.duration.value },
  );
  protected readonly days = computed(() => durationToDays(this.durationValue()));

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const record = this.record();
      const defaultDate = this.defaultDate();
      const defaultCategory = this.defaultCategory();
      untracked(() => {
        this.error.set(null);
        this.submitted.set(false);
        this.confirmDelete.set(false);
        this.form.reset({
          title: record?.title ?? defaultCategory ?? '',
          category: record?.category ?? defaultCategory ?? 'Casual Leave',
          date: record?.date ?? defaultDate ?? todayIso(),
          duration: record ? record.duration : 'Full Day',
          notes: record?.notes ?? '',
        });
      });
    });
  }

  protected errorFor(name: 'title' | 'date' | 'duration'): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || this.submitted()) || !control.errors) {
      return null;
    }
    return control.errors['required'] ? 'Required' : 'Invalid value';
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      const input = {
        title: value.title.trim(),
        category: value.category,
        date: value.date,
        duration: value.duration,
        notes: value.notes.trim() || null,
        status: 'complete' as const,
      };
      const existing = this.record();
      if (existing) {
        await this.records.update(existing.id, input);
        this.toast.success('Record updated');
      } else {
        await this.records.create(input);
        this.toast.success('Record added');
      }
      this.saved.emit();
      this.closed.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not save the record.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const existing = this.record();
    if (!existing) {
      return;
    }
    this.saving.set(true);
    try {
      await this.records.delete(existing.id);
      this.toast.success('Record deleted');
      this.confirmDelete.set(false);
      this.saved.emit();
      this.closed.emit();
    } catch (e) {
      this.confirmDelete.set(false);
      this.error.set(e instanceof Error ? e.message : 'Could not delete the record.');
    } finally {
      this.saving.set(false);
    }
  }
}
