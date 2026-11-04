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

export const CHART_GEOMETRY: ChartGeometry = {
  width: 640,
  height: 260,
  left: 36,
  right: 8,
  top: 12,
  bottom: 30,
};

export interface AxisTick {
  y: number;
  label: string;
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
