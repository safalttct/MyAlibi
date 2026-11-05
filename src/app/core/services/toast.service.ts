import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, kind: ToastKind = 'info', durationMs = 4500): void {
    this.push({ message, kind, durationMs });
  }

  showWithAction(
    message: string,
    action: ToastAction,
    kind: ToastKind = 'success',
    durationMs = 6000,
  ): void {
    this.push({ message, kind, durationMs, action });
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 7000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(input: {
    message: string;
    kind: ToastKind;
    durationMs: number;
    action?: ToastAction;
  }): void {
    const id = this.nextId++;
    this.toasts.update((list) => [
      ...list,
      { id, kind: input.kind, message: input.message, action: input.action },
    ]);
    if (input.durationMs > 0) {
      setTimeout(() => this.dismiss(id), input.durationMs);
    }
  }
}
