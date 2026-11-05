import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  CHART_GEOMETRY,
  CHART_GEOMETRY_COMPACT,
  ChartGeometry,
  ChartSeries,
  buildTicks,
  buildXLabels,
  niceMax,
  seriesWithData,
} from './chart-utils';

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  title: string;
  label: string;
  seriesName: string;
  value: number;
  delay: number;
  key: string;
  /** Full column band for easier hover hit-testing. */
  bandX: number;
  bandW: number;
}

interface HoverTip {
  text: string;
  color: string;
  xPct: number;
  yPct: number;
}

@Component({
  selector: 'ui-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: `
    .chart-root {
      position: relative;
    }

    .chart-bar {
      transform-box: fill-box;
      transform-origin: bottom center;
      animation: chart-bar-grow 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--bar-delay, 0ms);
      cursor: pointer;
      transition: opacity 0.15s ease, filter 0.15s ease;
    }

    .chart-bar.is-dimmed {
      opacity: 0.35;
    }

    .chart-bar.is-active {
      opacity: 1;
      filter: brightness(1.18);
    }

    .chart-band {
      fill: transparent;
      cursor: pointer;
      transition: fill 0.15s ease;
    }

    .chart-band.is-active {
      fill: color-mix(in oklab, var(--foreground) 6%, transparent);
    }

    .chart-tip {
      pointer-events: none;
      position: absolute;
      z-index: 2;
      max-width: 14rem;
      transform: translate(-50%, calc(-100% - 10px));
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--card);
      padding: 0.4rem 0.6rem;
      font-size: 0.75rem;
      line-height: 1.25;
      color: var(--foreground);
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
      white-space: nowrap;
    }

    .chart-tip-swatch {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      margin-right: 0.35rem;
      vertical-align: middle;
    }

    .chart-legend-item {
      animation: chart-fade-up 0.4s ease-out both;
      animation-delay: calc(280ms + var(--legend-i, 0) * 40ms);
    }

    @keyframes chart-bar-grow {
      from {
        transform: scaleY(0.08);
        opacity: 0.35;
      }
      to {
        transform: scaleY(1);
        opacity: 1;
      }
    }

    @keyframes chart-fade-up {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .chart-bar,
      .chart-legend-item {
        animation: none;
      }

      .chart-bar,
      .chart-band {
        transition: none;
      }
    }
  `,
  template: `
    <div
      class="chart-root -mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:overflow-visible sm:px-0"
      (mouseleave)="clearHover()"
    >
      <svg
        [attr.viewBox]="'0 0 ' + g().width + ' ' + g().height"
        class="h-auto w-full min-w-[280px] sm:min-w-0"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        @for (tick of ticks(); track $index) {
          <line
            [attr.x1]="g().left"
            [attr.x2]="g().width - g().right"
            [attr.y1]="tick.y"
            [attr.y2]="tick.y"
            stroke="var(--border)"
            stroke-dasharray="3 4"
          />
          <text
            [attr.x]="g().left - 6"
            [attr.y]="tick.y + 3"
            text-anchor="end"
            font-size="10"
            fill="var(--muted-foreground)"
          >
            {{ tick.label }}
          </text>
        }

        @for (band of bands(); track band.key) {
          <rect
            class="chart-band"
            [class.is-active]="hoverLabel() === band.label"
            [attr.x]="band.x"
            [attr.y]="g().top"
            [attr.width]="band.w"
            [attr.height]="plotH()"
            (mouseenter)="onBandEnter(band.label)"
          />
        }

        @for (bar of bars(); track bar.key) {
          <rect
            class="chart-bar"
            [class.is-active]="hoverKey() === bar.key"
            [class.is-dimmed]="!!hoverKey() && hoverKey() !== bar.key"
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.w"
            [attr.height]="bar.h"
            rx="3"
            [attr.fill]="bar.color"
            [style.--bar-delay]="bar.delay + 'ms'"
            (mouseenter)="onBarEnter(bar)"
            (focus)="onBarEnter(bar)"
            (blur)="clearHover()"
            tabindex="0"
            role="img"
            [attr.aria-label]="bar.title"
          />
        }

        @for (label of xLabels(); track $index) {
          @if (label.text) {
            <text
              [attr.x]="label.x"
              [attr.y]="g().height - 10"
              text-anchor="middle"
              font-size="10"
              fill="var(--muted-foreground)"
            >
              {{ label.text }}
            </text>
          }
        }
      </svg>

      @if (tip(); as t) {
        <div
          class="chart-tip"
          [style.left.%]="t.xPct"
          [style.top.%]="t.yPct"
          role="tooltip"
        >
          <span class="chart-tip-swatch" [style.background]="t.color"></span>
          {{ t.text }}
        </div>
      }
    </div>
    @if (showLegend() && activeSeries().length > 1) {
      <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        @for (s of activeSeries(); track s.name; let i = $index) {
          <li class="chart-legend-item flex items-center gap-1.5" [style.--legend-i]="i">
            <span class="size-2.5 shrink-0 rounded-full" [style.background-color]="s.color"></span>
            {{ s.name }}
          </li>
        }
      </ul>
    }
  `,
})
export class UiBarChart {
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly stacked = input(true);
  readonly showLegend = input(true);
  readonly compact = input(false);
  readonly ariaLabel = input('Bar chart');

  protected readonly hoverKey = signal<string | null>(null);
  protected readonly hoverLabel = signal<string | null>(null);
  protected readonly tip = signal<HoverTip | null>(null);

  protected readonly g = computed<ChartGeometry>(() =>
    this.compact() ? CHART_GEOMETRY_COMPACT : CHART_GEOMETRY,
  );

  protected readonly plotH = computed(() => this.g().height - this.g().top - this.g().bottom);

  protected readonly activeSeries = computed(() => seriesWithData(this.series()));

  private readonly maxValue = computed(() => {
    const n = this.labels().length;
    const series = this.activeSeries();
    let max = 0;
    for (let i = 0; i < n; i++) {
      const vals = series.map((s) => s.values[i] ?? 0);
      max = Math.max(max, this.stacked() ? vals.reduce((a, b) => a + b, 0) : Math.max(0, ...vals));
    }
    return niceMax(max);
  });

  protected readonly ticks = computed(() => buildTicks(this.maxValue(), this.g()));

  protected readonly xLabels = computed(() => {
    const n = this.labels().length;
    return buildXLabels(this.labels(), this.g(), n > 7 ? 6 : n);
  });

  protected readonly bars = computed<Bar[]>(() => {
    const labels = this.labels();
    const series = this.activeSeries();
    const max = this.maxValue();
    const g = this.g();
    const n = Math.max(1, labels.length);
    const plotW = g.width - g.left - g.right;
    const plotH = g.height - g.top - g.bottom;
    const band = plotW / n;
    const groupW = band * 0.62;
    const baseY = g.top + plotH;
    const result: Bar[] = [];
    let order = 0;

    labels.forEach((label, i) => {
      const bandX = g.left + band * i;
      const groupX = bandX + (band - groupW) / 2;
      let stackTop = baseY;
      series.forEach((s, si) => {
        const value = s.values[i] ?? 0;
        if (value <= 0) {
          return;
        }
        const h = Math.max(1.5, (value / max) * plotH);
        const title = `${label} · ${s.name}: ${value}`;
        const delay = Math.min(order * 35, 420);
        const key = `${label}|${s.name}|${value}|${h.toFixed(2)}`;
        order += 1;
        if (this.stacked()) {
          stackTop -= h;
          result.push({
            x: groupX,
            y: stackTop,
            w: groupW,
            h,
            color: s.color,
            title,
            label,
            seriesName: s.name,
            value,
            delay,
            key,
            bandX,
            bandW: band,
          });
        } else {
          const w = groupW / Math.max(1, series.length);
          result.push({
            x: groupX + w * si,
            y: baseY - h,
            w: Math.max(2, w - 2),
            h,
            color: s.color,
            title,
            label,
            seriesName: s.name,
            value,
            delay,
            key,
            bandX,
            bandW: band,
          });
        }
      });
    });
    return result;
  });

  /** One hover band per month/category column. */
  protected readonly bands = computed(() => {
    const labels = this.labels();
    const g = this.g();
    const n = Math.max(1, labels.length);
    const band = (g.width - g.left - g.right) / n;
    return labels.map((label, i) => ({
      key: `band|${label}`,
      x: g.left + band * i,
      w: band,
      label,
    }));
  });

  protected onBarEnter(bar: Bar): void {
    this.hoverKey.set(bar.key);
    this.hoverLabel.set(bar.label);
    this.tip.set({
      text: `${bar.label} · ${bar.seriesName}: ${bar.value}`,
      color: bar.color,
      xPct: ((bar.x + bar.w / 2) / this.g().width) * 100,
      yPct: (bar.y / this.g().height) * 100,
    });
  }

  protected onBandEnter(label: string): void {
    // Prefer the top-most (last stacked) bar in this column when hovering empty band space.
    const inColumn = this.bars().filter((b) => b.label === label);
    const top = inColumn[inColumn.length - 1];
    if (top) {
      this.onBarEnter(top);
      return;
    }
    this.hoverKey.set(`band|${label}`);
    this.hoverLabel.set(label);
    const band = this.bands().find((b) => b.label === label);
    if (!band) return;
    this.tip.set({
      text: `${label}: 0`,
      color: 'var(--muted-foreground)',
      xPct: ((band.x + band.w / 2) / this.g().width) * 100,
      yPct: ((this.g().top + this.plotH() * 0.15) / this.g().height) * 100,
    });
  }

  protected clearHover(): void {
    this.hoverKey.set(null);
    this.hoverLabel.set(null);
    this.tip.set(null);
  }
}
