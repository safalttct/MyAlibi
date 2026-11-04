import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CHART_GEOMETRY, ChartSeries, buildTicks, niceMax } from './chart-utils';

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  title: string;
}

@Component({
  selector: 'ui-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height"
      class="h-auto w-full"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (tick of ticks(); track $index) {
        <line [attr.x1]="g.left" [attr.x2]="g.width - g.right" [attr.y1]="tick.y" [attr.y2]="tick.y"
          stroke="var(--border)" stroke-dasharray="3 4" />
        <text [attr.x]="g.left - 6" [attr.y]="tick.y + 3" text-anchor="end" font-size="10" fill="var(--muted)">
          {{ tick.label }}
        </text>
      }
      @for (bar of bars(); track $index) {
        <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h" rx="2"
          [attr.fill]="bar.color">
          <title>{{ bar.title }}</title>
        </rect>
      }
      @for (label of xLabels(); track $index) {
        <text [attr.x]="label.x" [attr.y]="g.height - 10" text-anchor="middle" font-size="10" fill="var(--muted)">
          {{ label.text }}
        </text>
      }
    </svg>
    @if (showLegend() && series().length > 1) {
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        @for (s of series(); track s.name) {
          <li class="flex items-center gap-1.5">
            <span class="size-2 rounded-full" [style.background-color]="s.color"></span>{{ s.name }}
          </li>
        }
      </ul>
    }
  `,
})
export class UiBarChart {
  protected readonly g = CHART_GEOMETRY;

  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly stacked = input(true);
  readonly showLegend = input(true);
  readonly ariaLabel = input('Bar chart');

  private readonly maxValue = computed(() => {
    const n = this.labels().length;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const vals = this.series().map((s) => s.values[i] ?? 0);
      max = Math.max(max, this.stacked() ? vals.reduce((a, b) => a + b, 0) : Math.max(0, ...vals));
    }
    return niceMax(max);
  });

  protected readonly ticks = computed(() => buildTicks(this.maxValue()));

  private readonly plotW = this.g.width - this.g.left - this.g.right;
  private readonly plotH = this.g.height - this.g.top - this.g.bottom;

  protected readonly xLabels = computed(() => {
    const n = Math.max(1, this.labels().length);
    const band = this.plotW / n;
    return this.labels().map((text, i) => ({ text, x: this.g.left + band * i + band / 2 }));
  });

  protected readonly bars = computed<Bar[]>(() => {
    const labels = this.labels();
    const series = this.series();
    const max = this.maxValue();
    const n = Math.max(1, labels.length);
    const band = this.plotW / n;
    const groupW = band * 0.64;
    const baseY = this.g.top + this.plotH;
    const result: Bar[] = [];

    labels.forEach((label, i) => {
      const groupX = this.g.left + band * i + (band - groupW) / 2;
      let stackTop = baseY;
      series.forEach((s, si) => {
        const value = s.values[i] ?? 0;
        if (value <= 0) {
          return;
        }
        const h = (value / max) * this.plotH;
        const title = `${label} · ${s.name}: ${value}`;
        if (this.stacked()) {
          stackTop -= h;
          result.push({ x: groupX, y: stackTop, w: groupW, h, color: s.color, title });
        } else {
          const w = groupW / series.length;
          result.push({ x: groupX + w * si, y: baseY - h, w: Math.max(1, w - 2), h, color: s.color, title });
        }
      });
    });
    return result;
  });
}
