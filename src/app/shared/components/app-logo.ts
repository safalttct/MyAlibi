import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

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
      width="280"
      height="86"
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
      sm: 'h-8 w-auto',
      md: 'h-9 w-auto sm:h-10',
      lg: 'h-11 w-auto sm:h-12',
      xl: 'h-14 w-auto sm:h-16',
    };
    return `${sizes[this.size()]} max-w-[min(100%,280px)] object-contain object-left select-none`;
  });
}
