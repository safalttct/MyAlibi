export interface ChartSeries {
  name: string;
  color: string;
  values: readonly number[];
}

export interface ChartGeometry {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Default desktop-ish viewBox for charts. */
export const CHART_GEOMETRY: ChartGeometry = {
  width: 640,
  height: 240,
  left: 32,
  right: 12,
  top: 12,
  bottom: 28,
};

/** Tighter viewBox for narrow screens / dense labels. */
export const CHART_GEOMETRY_COMPACT: ChartGeometry = {
  width: 360,
  height: 220,
  left: 28,
  right: 8,
  top: 10,
  bottom: 36,
};

export interface AxisTick {
  y: number;
  label: string;
}

export interface AxisLabel {
  text: string;
  x: number;
  /** Hide visually but keep for screen readers via title on nearby marks. */
  hidden?: boolean;
}

/** Rounds the max up to a "nice" number and returns evenly spaced ticks. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    return 1;
  }
  if (max <= 4) {
    return Math.ceil(max);
  }
  const step = max <= 10 ? 2 : max <= 20 ? 5 : 10;
  return Math.ceil(max / step) * step;
}

export function buildTicks(max: number, g: ChartGeometry = CHART_GEOMETRY, count = 4): AxisTick[] {
  const plotH = g.height - g.top - g.bottom;
  const ticks: AxisTick[] = [];
  for (let i = 0; i <= count; i++) {
    const value = (max / count) * i;
    ticks.push({
      y: g.top + plotH - (value / max) * plotH,
      label: Number.isInteger(value) ? String(value) : value.toFixed(1),
    });
  }
  return ticks;
}

/**
 * Build x-axis labels, thinning when there are many (e.g. 12 months on a phone).
 * Always shows first + last; keeps roughly `maxVisible` labels.
 */
export function buildXLabels(
  labels: readonly string[],
  g: ChartGeometry,
  maxVisible = 6,
): AxisLabel[] {
  const n = Math.max(1, labels.length);
  const band = (g.width - g.left - g.right) / n;
  const step = n <= maxVisible ? 1 : Math.ceil((n - 1) / (maxVisible - 1));

  return labels.map((text, i) => {
    const isEdge = i === 0 || i === n - 1;
    const show = isEdge || i % step === 0;
    return {
      text: show ? text : '',
      x: g.left + band * i + band / 2,
      hidden: !show,
    };
  });
}

/** Drop series that are entirely zero — keeps legends readable. */
export function seriesWithData(series: readonly ChartSeries[]): ChartSeries[] {
  return series.filter((s) => s.values.some((v) => v > 0));
}
