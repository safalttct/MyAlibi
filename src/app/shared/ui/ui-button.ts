import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors active:scale-[0.98] ' +
  'select-none whitespace-nowrap disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-surface-hover',
  outline: 'border border-border bg-transparent text-foreground hover:bg-surface-hover',
  ghost: 'bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 px-3.5 text-xs sm:h-8 sm:px-3',
  md: 'h-11 px-4 text-sm sm:h-9',
  lg: 'h-11 px-5 text-sm sm:h-10',
  icon: 'size-11 p-0 sm:size-9',
};

@Component({
  selector: 'button[uiButton], a[uiButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[attr.disabled]': 'loading() ? "" : null',
  },
  template: `
    @if (loading()) {
      <span
        class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      ></span>
    }
    <ng-content />
  `,
})
export class UiButton {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);

  protected readonly classes = computed(
    () => `${BASE} ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
