import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'myalibi-coach-tips';

export type CoachTipId =
  | 'calendar-swipe'
  | 'calendar-day-add'
  | 'leave-comp-off-nudge'
  | 'comp-off-fy-scope'
  | 'records-import-empty-year';

/** One-time / dismissible in-product coach tips (localStorage). */
@Injectable({ providedIn: 'root' })
export class CoachTipsService {
  private readonly dismissed = signal<ReadonlySet<string>>(this.read());

  /** Reactive: safe to call from computed()/templates. */
  isVisible(id: CoachTipId): boolean {
    return !this.dismissed().has(id);
  }

  dismiss(id: CoachTipId): void {
    if (this.dismissed().has(id)) {
      return;
    }
    const next = new Set(this.dismissed());
    next.add(id);
    this.dismissed.set(next);
    this.write(next);
  }

  private read(): ReadonlySet<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return new Set();
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }

  private write(ids: ReadonlySet<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      /* private mode / quota */
    }
  }
}
