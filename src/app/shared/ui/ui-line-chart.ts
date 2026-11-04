import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CHART_GEOMETRY, ChartSeries, buildTicks, niceMax } from './chart-utils';

interface Line {
  name: string;
  color: string;
  path: string;
  points: { x: number; y: number; title: string }[];
}

@Component({
  selector: 'ui-line-chart',
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
      @for (line of lines(); track line.name) {
        <path [attr.d]="line.path" fill="none" [attr.stroke]="line.color" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round" />
        @for (p of line.points; track $index) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3" [attr.fill]="line.color">
            <title>{{ p.title }}</title>
          </circle>
        }
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
export class UiLineChart {
  protected readonly g = CHART_GEOMETRY;

  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly showLegend = input(true);
  readonly ariaLabel = input('Line chart');

  private readonly plotW = this.g.width - this.g.left - this.g.right;
  private readonly plotH = this.g.height - this.g.top - this.g.bottom;

  private readonly maxValue = computed(() =>
    niceMax(Math.max(0, ...this.series().flatMap((s) => [...s.values]))),
  );

  protected readonly ticks = computed(() => buildTicks(this.maxValue()));

  private xAt(i: number): number {
    const n = Math.max(1, this.labels().length);
    const band = this.plotW / n;
    return this.g.left + band * i + band / 2;
  }

  protected readonly xLabels = computed(() =>
    this.labels().map((text, i) => ({ text, x: this.xAt(i) })),
  );

  protected readonly lines = computed<Line[]>(() => {
    const max = this.maxValue();
    const baseY = this.g.top + this.plotH;
    return this.series().map((s) => {
      const points = this.labels().map((label, i) => {
        const value = s.values[i] ?? 0;
        return {
          x: this.xAt(i),
          y: baseY - (value / max) * this.plotH,
          title: `${label} · ${s.name}: ${value}`,
        };
      });
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return { name: s.name, color: s.color, path, points };
    });
  });
}
