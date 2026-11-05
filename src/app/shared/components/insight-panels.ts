import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideSparkles, LucideTriangleAlert } from '@lucide/angular';
import { AnomalyHint, YearNarrative } from '../../core/services/insights';

@Component({
  selector: 'app-anomaly-hints',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideTriangleAlert],
  template: `
    @if (hints().length > 0) {
      <section
        class="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm sm:px-4"
        aria-label="Policy hints"
      >
        <div class="flex items-start gap-2">
          <svg lucideTriangleAlert size="16" class="mt-0.5 shrink-0 text-warning"></svg>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-foreground">Heads up</p>
            <ul class="mt-2 space-y-2">
              @for (hint of hints(); track hint.id) {
                <li>
                  <p class="font-medium text-foreground">{{ hint.title }}</p>
                  <p class="text-muted">{{ hint.detail }}</p>
                </li>
              }
            </ul>
          </div>
        </div>
      </section>
    }
  `,
})
export class AnomalyHintsPanel {
  readonly hints = input.required<readonly AnomalyHint[]>();
}

@Component({
  selector: 'app-year-narrative',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideSparkles],
  template: `
    @if (story(); as s) {
      <section
        class="rounded-xl border px-3 py-3 text-sm sm:px-4"
        [class]="
          s.closing
            ? 'border-primary/30 bg-primary-soft'
            : 'border-border bg-card'
        "
        aria-label="Leave year summary"
      >
        <div class="flex items-start gap-2">
          <svg lucideSparkles size="16" class="mt-0.5 shrink-0 text-primary"></svg>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-foreground">{{ s.headline }}</p>
            <ul class="mt-2 space-y-1 text-muted">
              @for (line of s.lines; track line) {
                <li>{{ line }}</li>
              }
            </ul>
            @if (showAnalyticsLink()) {
              <a routerLink="/analytics" class="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                Open analytics
              </a>
            }
          </div>
        </div>
      </section>
    }
  `,
})
export class YearNarrativePanel {
  readonly story = input<YearNarrative | null>(null);
  readonly showAnalyticsLink = input(false);
}
