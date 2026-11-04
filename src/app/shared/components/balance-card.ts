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
    <a
      [routerLink]="link()"
      [queryParams]="queryParams()"
      class="group relative block overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
      [attr.aria-label]="ariaLabel()"
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
        <p class="mt-3 text-[1.75rem] font-semibold text-muted sm:text-3xl">–</p>
        <p class="mt-3 text-xs text-muted">
          No allocation yet.
          <span class="font-medium text-accent group-hover:underline">Set one</span>
        </p>
      }
    </a>
  `,
})
export class BalanceCard {
  readonly meta = input.required<CategoryMeta>();
  readonly balance = input<LeaveBalance | null>(null);

  protected readonly link = computed(() =>
    this.balance()
      ? ['/records']
      : ['/settings/allocations'],
  );

  protected readonly queryParams = computed(() =>
    this.balance() ? { category: this.meta().id } : {},
  );

  protected readonly ariaLabel = computed(() => {
    const b = this.balance();
    if (!b) {
      return `${this.meta().label}: no allocation — open settings`;
    }
    return `${this.meta().label}: ${b.remaining} left — view records`;
  });
}
