import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

/** Password field with show/hide toggle. Use with `formControlName`. */
@Component({
  selector: 'ui-password-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideEye, LucideEyeOff],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiPasswordInput),
      multi: true,
    },
  ],
  host: { class: 'block' },
  template: `
    <div class="relative">
      <input
        class="block w-full rounded-lg border border-border bg-background min-h-11 py-2 pr-11 pl-3 text-sm sm:min-h-10 text-foreground placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger"
        [type]="visible() ? 'text' : 'password'"
        [value]="value()"
        [placeholder]="placeholder()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="invalid() ? true : null"
        [attr.aria-label]="ariaLabel() || null"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [attr.aria-pressed]="visible()"
        tabindex="0"
        (click)="toggle()"
      >
        @if (visible()) {
          <svg lucideEyeOff size="18" strokeWidth="1.75"></svg>
        } @else {
          <svg lucideEye size="18" strokeWidth="1.75"></svg>
        }
      </button>
    </div>
  `,
})
export class UiPasswordInput implements ControlValueAccessor {
  readonly placeholder = input('Password');
  readonly autocomplete = input('current-password');
  readonly ariaLabel = input('');
  readonly invalid = input(false);

  protected readonly value = signal('');
  protected readonly visible = signal(false);
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected toggle(): void {
    this.visible.update((v) => !v);
  }
}
