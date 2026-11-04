import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryMeta, LeaveBalance } from '../../core/models/leave.models';
import { UiProgress } from '../ui/ui-progress';

@Component({
  selector: 'app-balance-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiProgress],
  host: { class: 'block' },
  template: `
    <article
      class="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors sm:p-5"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        [style.background]="meta().color"
        aria-hidden="true"
      ></div>

      <div class="flex items-center justify-between gap-2">
        <h3 class="text-xs font-medium tracking-wide text-muted uppercase">{{ meta().label }}</h3>
        <span class="size-2 shrink-0 rounded-full" [style.background]="meta().color"></span>
      </div>

      @if (balance(); as b) {
        <p
          class="mt-3 text-[1.75rem] leading-none font-semibold tabular-nums tracking-tight sm:text-3xl"
          [class]="b.is_negative ? 'text-danger' : ''"
          [style.color]="b.is_negative ? null : meta().color"
        >
          {{ b.remaining }}
          <span class="ml-1 text-sm font-medium text-muted">left</span>
        </p>
        <ui-progress
          class="mt-3"
          [value]="b.usage_percent"
          [color]="meta().color"
          [negative]="b.is_negative"
        />
        <p class="mt-2 text-xs text-muted tabular-nums">
          {{ b.used }} used of {{ b.total_available }} · {{ b.usage_percent }}%
        </p>
      } @else {
        <p class="mt-3 text-[1.75rem] font-semibold text-muted-fg sm:text-3xl">–</p>
        <p class="mt-3 text-xs text-muted">
          No allocation yet.
          <a routerLink="/settings/allocations" class="font-medium text-accent hover:underline"
            >Set one</a
          >
        </p>
      }
    </article>
  `,
})
export class BalanceCard {
  readonly meta = input.required<CategoryMeta>();
  readonly balance = input<LeaveBalance | null>(null);

  protected readonly hasBalance = computed(() => this.balance() !== null);
}
