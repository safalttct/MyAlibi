import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryMeta, LeaveBalance } from '../../core/models/leave.models';
import { UiProgress } from '../ui/ui-progress';

@Component({
  selector: 'app-balance-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiProgress],
  host: { class: 'block h-full min-w-0' },
  template: `
    <a
      [routerLink]="link()"
      [queryParams]="queryParams()"
      [class]="
        'group relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl glass-panel border ' +
        'transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
        (compact() ? 'p-2.5 sm:p-3' : 'p-4 sm:p-5')
      "
      [attr.aria-label]="ariaLabel()"
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-90"
        [style.background]="meta().color"
        [style.box-shadow]="'0 0 10px -2px ' + meta().color"
        aria-hidden="true"
      ></div>

      <div class="flex items-center justify-between gap-2">
        <h3
          class="min-w-0 truncate font-medium tracking-wide text-muted uppercase"
          [class]="compact() ? 'text-[10px]' : 'text-xs'"
        >
          {{ compact() ? meta().short : meta().label }}
        </h3>
        <span class="size-2 shrink-0 rounded-full" [style.background]="meta().color"></span>
      </div>

      @if (balance(); as b) {
        <p
          class="font-display leading-none font-semibold tabular-nums tracking-tight"
          [class]="
            compact()
              ? 'mt-1.5 text-lg sm:text-xl'
              : 'mt-3 text-[1.75rem] sm:text-2xl lg:text-[1.75rem]'
          "
          [class.text-danger]="b.is_negative"
          [style.color]="b.is_negative ? null : meta().color"
        >
          {{ b.remaining }}
          @if (!compact()) {
            <span class="ml-1 text-sm font-medium text-muted">left</span>
          }
        </p>
        @if (!compact()) {
          <ui-progress
            class="mt-3"
            [value]="b.usage_percent"
            [color]="meta().color"
            [negative]="b.is_negative"
          />
          <p class="mt-2 truncate text-xs text-muted tabular-nums">
            {{ b.used }} used of {{ b.total_available }} · {{ b.usage_percent }}%
          </p>
        } @else {
          <p class="mt-1 text-[10px] text-muted tabular-nums">{{ b.usage_percent }}% used</p>
        }
      } @else {
        <p
          class="font-display font-semibold text-muted"
          [class]="compact() ? 'mt-2 text-xl' : 'mt-3 text-[1.75rem] sm:text-2xl'"
        >
          –
        </p>
        @if (!compact()) {
          <p class="mt-3 text-xs text-muted">
            No allocation yet.
            <span class="font-medium text-accent group-hover:underline">Set one</span>
          </p>
        }
      }
    </a>
  `,
})
export class BalanceCard {
  readonly meta = input.required<CategoryMeta>();
  readonly balance = input<LeaveBalance | null>(null);
  /** Compact chip for horizontal balance strip. */
  readonly compact = input(false);

  protected readonly link = computed(() =>
    this.balance() ? ['/records'] : ['/settings/allocations'],
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
