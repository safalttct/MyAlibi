import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

export type LogoSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center',
    '[attr.aria-label]': '"MyAlibi"',
  },
  template: `
    <img
      [src]="src()"
      alt="MyAlibi"
      [class]="imgClass()"
      width="180"
      height="40"
      decoding="async"
    />
  `,
})
export class AppLogo {
  private readonly theme = inject(ThemeService);

  /** Override automatic theme-based logo selection. */
  readonly forceTheme = input<'dark' | 'light' | null>(null);
  readonly size = input<LogoSize>('md');
  readonly markOnly = input(false);

  protected readonly src = computed(() => {
    const mode = this.forceTheme() ?? this.theme.theme();
    // Dark UI → light-on-dark asset; light UI → dark-on-light asset.
    return mode === 'light'
      ? '/assets/branding/myalibi-light.png'
      : '/assets/branding/myalibi-dark.png';
  });

  protected readonly imgClass = computed(() => {
    const sizes: Record<LogoSize, string> = {
      sm: 'h-7 w-auto',
      md: 'h-8 w-auto sm:h-9',
      lg: 'h-10 w-auto sm:h-11',
    };
    return `${sizes[this.size()]} max-w-[160px] object-contain object-left select-none`;
  });
}
