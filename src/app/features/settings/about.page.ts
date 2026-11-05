import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LucideCode2,
  LucideExternalLink,
  LucideHouse,
  LucideMessageCircleQuestion,
  LucideSparkles,
  LucideUsers,
} from '@lucide/angular';
import { environment } from '../../../environments/environment';
import { AppLogo } from '../../shared/components/app-logo';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';

@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    SettingsTabs,
    AppLogo,
    UiCard,
    UiButton,
    LucideCode2,
    LucideExternalLink,
    LucideSparkles,
    LucideUsers,
    LucideHouse,
    LucideMessageCircleQuestion,
  ],
  host: { class: 'block min-w-0 max-w-full overflow-x-hidden' },
  styles: `
    @keyframes about-rise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .about-rise {
      animation: about-rise 0.55s ease-out both;
    }

    .about-rise-delay-1 {
      animation-delay: 0.08s;
    }

    .about-rise-delay-2 {
      animation-delay: 0.16s;
    }

    .about-rise-delay-3 {
      animation-delay: 0.24s;
    }

    @media (prefers-reduced-motion: reduce) {
      .about-rise {
        animation: none;
      }
    }
  `,
  template: `
    <app-page-header eyebrow="Settings" title="About" subtitle="The story behind MyAlibi" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <!-- Hero -->
    <section
      class="about-rise relative mb-5 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm sm:mb-6"
      aria-labelledby="about-hero-title"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--primary-soft),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgb(139_92_246_/_0.12),_transparent_50%)]"
        aria-hidden="true"
      ></div>
      <div class="relative px-4 py-7 sm:px-8 sm:py-10">
        <div class="mb-5 flex max-w-full items-center gap-3 overflow-hidden">
          <app-logo size="lg" />
        </div>
        <p class="text-xs font-medium tracking-wide text-primary uppercase">MyAlibi</p>
        <h2 id="about-hero-title" class="mt-2 max-w-xl text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your leave log is your alibi.
        </h2>
        <p class="mt-3 max-w-lg text-sm leading-relaxed text-pretty text-muted sm:text-base">
          Built for personal use, then opened up so colleagues can track leave, WFH, and Comp Off in one shared workspace.
        </p>
        <p class="mt-4 text-xs text-muted tabular-nums">Version {{ version }}</p>
      </div>
    </section>

    <!-- Name meaning -->
    <ui-card class="about-rise about-rise-delay-1 mb-4 border-primary/15 sm:mb-5">
      <div class="flex items-start gap-3">
        <span
          class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <svg lucideMessageCircleQuestion size="20"></svg>
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-foreground">What “MyAlibi” means</h3>
          <blockquote
            class="mt-3 border-l-2 border-primary/50 pl-4 text-sm leading-relaxed text-foreground sm:text-[0.95rem]"
          >
            <p>
              When someone wonders,
              <span class="italic text-muted">“Where is he today? Why isn’t he at his desk?”</span>
              — this app is your alibi.
            </p>
            <p class="mt-3">
              It shows:
              <span class="font-medium text-primary">Look, I’m officially working from home / approved on leave.</span>
            </p>
          </blockquote>
        </div>
      </div>
    </ui-card>

    <!-- Story -->
    <div class="about-rise about-rise-delay-2 mb-4 grid gap-4 sm:mb-5 lg:grid-cols-2">
      <ui-card title="How it started" description="From personal tracker to team tool">
        <ol class="relative space-y-5 border-l border-border pl-5">
          <li class="relative">
            <span
              class="absolute top-1.5 -left-[1.4rem] flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary"
              aria-hidden="true"
            >
              <svg lucideSparkles size="12"></svg>
            </span>
            <p class="text-sm font-medium text-foreground">Personal use</p>
            <p class="mt-1 text-sm text-muted">
              Started as a private way to keep leave and WFH straight across the financial year.
            </p>
          </li>
          <li class="relative">
            <span
              class="absolute top-1.5 -left-[1.4rem] flex size-5 items-center justify-center rounded-full bg-wfh/15 text-wfh"
              aria-hidden="true"
            >
              <svg lucideUsers size="12"></svg>
            </span>
            <p class="text-sm font-medium text-foreground">Workspace for colleagues</p>
            <p class="mt-1 text-sm text-muted">
              Grew into a leave management app for teammates — shared holidays, Comp Off expiry, and HR-ready summaries.
            </p>
          </li>
          <li class="relative">
            <span
              class="absolute top-1.5 -left-[1.4rem] flex size-5 items-center justify-center rounded-full bg-casual/15 text-casual"
              aria-hidden="true"
            >
              <svg lucideHouse size="12"></svg>
            </span>
            <p class="text-sm font-medium text-foreground">Built for Tamimah Team</p>
            <p class="mt-1 text-sm text-muted">
              Tuned for one office workspace: Apr–Mar leave year, team public holidays, and everyday desk reality.
            </p>
          </li>
        </ol>
      </ui-card>

      <ui-card title="Created by" description="Author &amp; maintainer">
        <div
          class="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-elevated/40 p-4 sm:flex-row sm:items-center"
        >
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            SN
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-base font-semibold text-foreground">Safal Naushad</p>
            <p class="mt-0.5 text-sm text-muted">Creator of MyAlibi</p>
            <a
              uiButton
              variant="outline"
              size="sm"
              class="mt-3 max-w-full"
              href="https://github.com/SafalNaushad"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg lucideCode2 size="14"></svg>
              GitHub profile
              <svg lucideExternalLink size="12" class="opacity-60"></svg>
            </a>
          </div>
        </div>
        <p class="mt-4 text-sm leading-relaxed text-pretty text-muted">
          Designed and built to keep leave honest, simple, and shareable — so “where are you today?” always has a clear answer.
        </p>
      </ui-card>
    </div>

    <p class="about-rise about-rise-delay-3 text-center text-xs text-muted">
      &copy; {{ year }} MyAlibi · Developed for Tamimah Team
    </p>
  `,
})
export class AboutPage {
  protected readonly version = environment.version || '0.0.0';
  protected readonly year = new Date().getFullYear();
}
