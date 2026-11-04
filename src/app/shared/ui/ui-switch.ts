import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Accessible on/off switch. Supports `[checked]` / `(checkedChange)` or reactive forms. */
@Component({
  selector: 'ui-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSwitch),
      multi: true,
    },
  ],
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      role="switch"
      class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      [class]="on() ? 'border-primary bg-primary' : 'border-border bg-secondary'"
      [attr.aria-checked]="on()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled()"
      (click)="toggle()"
    >
      <span
        class="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform"
        [class.translate-x-5]="on()"
        [class.translate-x-0]="!on()"
      ></span>
    </button>
  `,
})
export class UiSwitch implements ControlValueAccessor {
  readonly ariaLabel = input('Toggle');
  readonly checked = input(false);
  readonly checkedChange = output<boolean>();

  protected readonly on = signal(false);
  protected readonly disabled = signal(false);

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      this.on.set(this.checked());
    });
  }

  writeValue(value: boolean | null): void {
    this.on.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    const next = !this.on();
    this.on.set(next);
    this.onChange(next);
    this.checkedChange.emit(next);
    this.onTouched();
  }
}
