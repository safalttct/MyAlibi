import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideListChecks,
  LucideSettings,
  LucideShare2,
  LucideSparkles,
} from '@lucide/angular';
import { OnboardingGuideService } from '../../core/services/onboarding-guide.service';
import { UiButton } from '../ui/ui-button';
import { UiDialog } from '../ui/ui-dialog';

interface GuideStep {
  readonly title: string;
  readonly body: string;
  readonly tip?: string;
  readonly icon: 'welcome' | 'allocations' | 'records' | 'share';
  readonly ctaPath?: string;
  readonly ctaLabel?: string;
}

const STEPS: readonly GuideStep[] = [
  {
    title: 'Welcome to MyAlibi',
    body: 'Track leave, work from home, and compensatory off for your financial year (April–March). This short guide covers the basics — you can skip anytime.',
    tip: 'Your data is private to your account.',
    icon: 'welcome',
  },
  {
    title: 'Your year is ready',
    body: 'Team defaults are already set for this fiscal year: WFH 16, Casual 12, and Sick 12 days. Open Allocations only if you need to review or adjust.',
    tip: 'You can change entitlements anytime under Settings → Allocations.',
    icon: 'allocations',
    ctaPath: '/settings/allocations',
    ctaLabel: 'Review allocations',
  },
  {
    title: 'Log leave and WFH',
    body: 'From the dashboard, tap Add leave or WFH. Pick the date, type, and Full / Half day. Incomplete rows stay under Needs review until you finish them.',
    icon: 'records',
    ctaPath: '/dashboard',
    ctaLabel: 'Go to dashboard',
  },
  {
    title: 'Comp Off & Share to HR',
    body: 'After your project manager approves Comp Off for extra hours, add an Earn entry — it expires in 90 days. Use it before then. For HR, create a view-only link under Settings → Share to HR.',
    tip: 'Share links never allow edits. Reopen this guide anytime from the account menu.',
    icon: 'share',
    ctaPath: '/settings/share',
    ctaLabel: 'Share settings',
  },
];

@Component({
  selector: 'app-onboarding-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiDialog,
    UiButton,
    LucideSparkles,
    LucideSettings,
    LucideListChecks,
    LucideShare2,
  ],
  template: `
    <ui-dialog
      [open]="guide.isOpen()"
      [title]="step().title"
      description="Quick start guide"
      size="md"
      (closed)="onClose()"
    >
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
            aria-hidden="true"
          >
            @switch (step().icon) {
              @case ('welcome') {
                <svg lucideSparkles size="20"></svg>
              }
              @case ('allocations') {
                <svg lucideSettings size="20"></svg>
              }
              @case ('records') {
                <svg lucideListChecks size="20"></svg>
              }
              @case ('share') {
                <svg lucideShare2 size="20"></svg>
              }
            }
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm leading-relaxed text-foreground">{{ step().body }}</p>
            @if (step().tip) {
              <p class="mt-2 text-xs text-muted">{{ step().tip }}</p>
            }
          </div>
        </div>

        <div class="flex items-center justify-between gap-3" aria-hidden="true">
          <div class="flex flex-1 gap-1.5">
            @for (s of steps; track s.title; let i = $index) {
              <span
                class="h-1 flex-1 rounded-full transition-colors"
                [class]="i <= index() ? 'bg-primary' : 'bg-border'"
              ></span>
            }
          </div>
          <span class="shrink-0 text-[11px] tabular-nums text-muted"
            >{{ index() + 1 }} / {{ steps.length }}</span
          >
        </div>
      </div>

      <ng-container dialogFooter>
        <button uiButton variant="ghost" type="button" (click)="skip()">Skip guide</button>
        <div class="flex flex-1 flex-wrap justify-end gap-2">
          @if (!isFirst()) {
            <button uiButton variant="outline" type="button" (click)="back()">Back</button>
          }
          @if (step().ctaPath; as path) {
            <button uiButton variant="outline" type="button" (click)="go(path)">
              {{ step().ctaLabel }}
            </button>
          }
          @if (isLast()) {
            <button uiButton type="button" (click)="finish()">Get started</button>
          } @else {
            <button uiButton type="button" (click)="next()">Next</button>
          }
        </div>
      </ng-container>
    </ui-dialog>
  `,
})
export class OnboardingGuide {
  protected readonly guide = inject(OnboardingGuideService);
  private readonly router = inject(Router);

  protected readonly steps = STEPS;
  protected readonly index = signal(0);

  protected readonly step = computed(() => this.steps[this.index()] ?? this.steps[0]);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() === this.steps.length - 1);

  constructor() {
    effect(() => {
      if (this.guide.isOpen()) {
        this.index.set(0);
      }
    });
  }

  protected next(): void {
    if (this.isLast()) {
      return;
    }
    this.index.update((i) => i + 1);
  }

  protected back(): void {
    if (this.isFirst()) {
      return;
    }
    this.index.update((i) => i - 1);
  }

  protected async skip(): Promise<void> {
    this.index.set(0);
    await this.guide.skip();
  }

  protected async finish(): Promise<void> {
    this.index.set(0);
    await this.guide.complete();
  }

  /** X / Escape / backdrop — remind later; do not mark completed. */
  protected onClose(): void {
    this.guide.dismissWithoutSaving();
  }

  protected go(path: string): void {
    this.guide.dismissWithoutSaving();
    void this.router.navigateByUrl(path);
  }
}
