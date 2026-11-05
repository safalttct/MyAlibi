import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaveRecord, LeaveRecordInput } from '../models/leave.models';
import { AuthService } from './auth.service';
import { LeaveRecordsService } from './leave-records.service';
import { LeaveRecordsStore } from './leave-records.store';
import { ToastService } from './toast.service';

function sampleInput(overrides: Partial<LeaveRecordInput> = {}): LeaveRecordInput {
  return {
    title: 'WFH',
    category: 'Work From Home',
    date: '2026-04-01',
    duration: 'Full Day',
    notes: null,
    status: 'complete',
    ...overrides,
  };
}

function sampleRecord(overrides: Partial<LeaveRecord> = {}): LeaveRecord {
  const input = sampleInput();
  return {
    id: 'rec-1',
    user_id: 'user-1',
    title: input.title,
    category: input.category,
    date: input.date,
    duration: input.duration,
    days: 1,
    notes: null,
    status: 'complete',
    source_key: null,
    import_batch_id: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('LeaveRecordsStore', () => {
  let store: LeaveRecordsStore;
  let createMany: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;
  let restore: ReturnType<typeof vi.fn>;
  let showWithAction: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;
  let error: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMany = vi.fn();
    update = vi.fn();
    del = vi.fn();
    restore = vi.fn();
    showWithAction = vi.fn();
    success = vi.fn();
    error = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        LeaveRecordsStore,
        {
          provide: LeaveRecordsService,
          useValue: {
            list: vi.fn().mockResolvedValue([]),
            createMany,
            update,
            delete: del,
            restore,
          },
        },
        {
          provide: ToastService,
          useValue: {
            success,
            error,
            show: vi.fn(),
            showWithAction,
            info: vi.fn(),
            dismiss: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(true),
            requireUserId: () => 'user-1',
          },
        },
      ],
    });
    store = TestBed.inject(LeaveRecordsStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('rolls back optimistic add when createMany fails', async () => {
    createMany.mockRejectedValue(new Error('no balance'));
    await expect(store.add([sampleInput()])).rejects.toThrow('no balance');
    expect(store.records().length).toBe(0);
    expect(error).toHaveBeenCalled();
    expect(store.changes()).toBe(0);
  });

  it('swaps temp rows for server rows on successful add', async () => {
    const saved = [sampleRecord({ id: 'server-1' })];
    createMany.mockResolvedValue(saved);
    const result = await store.add([sampleInput()]);
    expect(result).toEqual(saved);
    expect(store.records()).toEqual(saved);
    expect(store.changes()).toBe(1);
    expect(success).toHaveBeenCalled();
  });

  it('restores a deleted record via Undo', async () => {
    const record = sampleRecord();
    store.records.set([record]);
    del.mockResolvedValue(undefined);
    restore.mockResolvedValue(record);

    await store.remove(record);
    expect(store.records()).toEqual([]);
    expect(showWithAction).toHaveBeenCalled();

    const action = showWithAction.mock.calls[0][1] as {
      label: string;
      run: () => void | Promise<void>;
    };
    expect(action.label).toBe('Undo');
    await action.run();
    expect(restore).toHaveBeenCalledWith(record);
    expect(store.records()).toEqual([record]);
  });
});
