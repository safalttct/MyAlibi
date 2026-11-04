import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

export type LogoSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex max-w-full items-center',
    '[attr.aria-label]': '"MyAlibi"',
  },
  template: `
    <img
      [src]="src()"
      alt="MyAlibi"
      [class]="imgClass()"
      width="200"
      height="48"
      decoding="async"
    />
  `,
})
export class AppLogo {
  private readonly theme = inject(ThemeService);

  /** Override automatic theme-based logo selection. */
  readonly forceTheme = input<'dark' | 'light' | null>(null);
  readonly size = input<LogoSize>('md');

  protected readonly src = computed(() => {
    const mode = this.forceTheme() ?? this.theme.theme();
    // Filenames mean “for this UI theme”: dark UI uses lavender mark, light UI uses deep purple.
    return mode === 'light'
      ? '/assets/branding/myalibi-light.png'
      : '/assets/branding/myalibi-dark.png';
  });

  protected readonly imgClass = computed(() => {
    const sizes: Record<LogoSize, string> = {
      sm: 'h-9 w-auto',
      md: 'h-10 w-auto',
      lg: 'h-12 w-auto sm:h-14',
    };
    return `${sizes[this.size()]} max-w-[200px] object-contain object-left select-none`;
  });
}
