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

interface Point {
  x: number;
  y: number;
  title: string;
  delay: number;
  key: string;
  label: string;
  seriesName: string;
  value: number;
  color: string;
}

interface Line {
  name: string;
  color: string;
  path: string;
  area: string;
  delay: number;
  key: string;
  points: Point[];
}

interface HoverTip {
  text: string;
  color: string;
  xPct: number;
  yPct: number;
}

@Component({
  selector: 'ui-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: `
    .chart-root {
      position: relative;
    }

    .chart-line {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: chart-line-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--line-delay, 0ms);
      transition: opacity 0.15s ease, stroke-width 0.15s ease;
    }

    .chart-line.is-dimmed {
      opacity: 0.25;
    }

    .chart-line.is-active {
      stroke-width: 3;
    }

    .chart-area {
      opacity: 0;
      animation: chart-area-fade 0.55s ease-out both;
      animation-delay: calc(var(--line-delay, 0ms) + 420ms);
      transition: opacity 0.15s ease;
      pointer-events: none;
    }

    .chart-area.is-dimmed {
      opacity: 0.04 !important;
    }

    .chart-area.is-active {
      opacity: 0.18 !important;
    }

    .chart-point {
      transform-box: fill-box;
      transform-origin: center;
      animation: chart-point-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--point-delay, 0ms);
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .chart-point.is-dimmed {
      opacity: 0.3;
    }

    .chart-point-hit {
      fill: transparent;
      cursor: pointer;
    }

    .chart-point-ring {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }

    .chart-point-ring.is-active {
      opacity: 0.9;
    }

    .chart-guide {
      stroke: var(--muted-foreground);
      stroke-width: 1;
      stroke-dasharray: 3 4;
      opacity: 0.55;
      pointer-events: none;
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
      animation-delay: calc(500ms + var(--legend-i, 0) * 40ms);
    }

    @keyframes chart-line-draw {
      to {
        stroke-dashoffset: 0;
      }
    }

    @keyframes chart-area-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 0.12;
      }
    }

    @keyframes chart-point-pop {
      from {
        opacity: 0;
        transform: scale(0.4);
      }
      to {
        opacity: 1;
        transform: scale(1);
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
      .chart-line {
        stroke-dasharray: none;
        stroke-dashoffset: 0;
        animation: none;
      }

      .chart-area {
        opacity: 0.12;
        animation: none;
      }

      .chart-point,
      .chart-legend-item {
        animation: none;
      }

      .chart-line,
      .chart-area,
      .chart-point,
      .chart-point-ring {
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

        @if (guideX() != null) {
          <line
            class="chart-guide"
            [attr.x1]="guideX()"
            [attr.x2]="guideX()"
            [attr.y1]="g().top"
            [attr.y2]="g().top + plotH()"
          />
        }

        @for (line of lines(); track line.key) {
          <path
            class="chart-area"
            [class.is-active]="hoverSeries() === line.name"
            [class.is-dimmed]="!!hoverSeries() && hoverSeries() !== line.name"
            [attr.d]="line.area"
            [attr.fill]="line.color"
            [style.--line-delay]="line.delay + 'ms'"
          />
          <path
            class="chart-line"
            [class.is-active]="hoverSeries() === line.name"
            [class.is-dimmed]="!!hoverSeries() && hoverSeries() !== line.name"
            [attr.d]="line.path"
            pathLength="1"
            fill="none"
            [attr.stroke]="line.color"
            stroke-width="2.25"
            stroke-linejoin="round"
            stroke-linecap="round"
            [style.--line-delay]="line.delay + 'ms'"
          />
          @for (p of line.points; track p.key) {
            <circle
              class="chart-point-hit"
              [attr.cx]="p.x"
              [attr.cy]="p.y"
              r="14"
              (mouseenter)="onPointEnter(p)"
              (focus)="onPointEnter(p)"
              (blur)="clearHover()"
              tabindex="0"
              role="img"
              [attr.aria-label]="p.title"
            />
            <circle
              class="chart-point-ring"
              [class.is-active]="hoverKey() === p.key"
              [attr.cx]="p.x"
              [attr.cy]="p.y"
              r="7"
              [attr.stroke]="p.color"
            />
            <circle
              class="chart-point"
              [class.is-dimmed]="!!hoverKey() && hoverKey() !== p.key"
              [attr.cx]="p.x"
              [attr.cy]="p.y"
              r="3.5"
              [attr.fill]="p.color"
              stroke="var(--card)"
              stroke-width="1.5"
              [style.--point-delay]="p.delay + 'ms'"
              pointer-events="none"
            />
          }
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
export class UiLineChart {
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly showLegend = input(true);
  readonly compact = input(false);
  readonly ariaLabel = input('Line chart');

  protected readonly hoverKey = signal<string | null>(null);
  protected readonly hoverSeries = signal<string | null>(null);
  protected readonly guideX = signal<number | null>(null);
  protected readonly tip = signal<HoverTip | null>(null);

  protected readonly g = computed<ChartGeometry>(() =>
    this.compact() ? CHART_GEOMETRY_COMPACT : CHART_GEOMETRY,
  );

  protected readonly plotH = computed(() => this.g().height - this.g().top - this.g().bottom);

  protected readonly activeSeries = computed(() => seriesWithData(this.series()));

  private readonly maxValue = computed(() =>
    niceMax(Math.max(0, ...this.activeSeries().flatMap((s) => [...s.values]))),
  );

  protected readonly ticks = computed(() => buildTicks(this.maxValue(), this.g()));

  protected readonly xLabels = computed(() => {
    const n = this.labels().length;
    return buildXLabels(this.labels(), this.g(), n > 7 ? 6 : n);
  });

  private xAt(i: number, g: ChartGeometry, n: number): number {
    const band = (g.width - g.left - g.right) / Math.max(1, n);
    return g.left + band * i + band / 2;
  }

  protected readonly lines = computed<Line[]>(() => {
    const max = this.maxValue();
    const g = this.g();
    const labels = this.labels();
    const n = labels.length;
    const plotH = g.height - g.top - g.bottom;
    const baseY = g.top + plotH;

    return this.activeSeries().map((s, seriesIndex) => {
      const lineDelay = seriesIndex * 120;
      const points: Point[] = labels.map((label, i) => {
        const value = s.values[i] ?? 0;
        return {
          x: this.xAt(i, g, n),
          y: baseY - (value / max) * plotH,
          title: `${label} · ${s.name}: ${value}`,
          delay: lineDelay + 350 + i * 45,
          key: `${s.name}|${label}|${value}`,
          label,
          seriesName: s.name,
          value,
          color: s.color,
        };
      });
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const first = points[0];
      const last = points[points.length - 1];
      const area =
        first && last
          ? `${path} L${last.x.toFixed(1)} ${baseY} L${first.x.toFixed(1)} ${baseY} Z`
          : '';
      const valuesKey = s.values.join(',');
      return {
        name: s.name,
        color: s.color,
        path,
        area,
        delay: lineDelay,
        key: `${s.name}|${valuesKey}`,
        points,
      };
    });
  });

  protected onPointEnter(point: Point): void {
    this.hoverKey.set(point.key);
    this.hoverSeries.set(point.seriesName);
    this.guideX.set(point.x);
    this.tip.set({
      text: `${point.label} · ${point.seriesName}: ${point.value}`,
      color: point.color,
      xPct: (point.x / this.g().width) * 100,
      yPct: (point.y / this.g().height) * 100,
    });
  }

  protected clearHover(): void {
    this.hoverKey.set(null);
    this.hoverSeries.set(null);
    this.guideX.set(null);
    this.tip.set(null);
  }
}
