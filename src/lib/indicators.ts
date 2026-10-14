import type { Country, IndicatorId, Observation, Status, Target } from '../types/data';

export const EU = 'EU27_2020';

export interface Point {
  period: string;
  value: number | null;
  status: Status;
  flag: string | null;
  note?: string;
}

export function series(obs: Observation[], geo: string, indicator: IndicatorId): Point[] {
  return obs
    .filter((o) => o.geo === geo && o.indicator === indicator)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((o) => ({ period: o.period, value: o.value, status: o.status, flag: o.source_flag, note: o.status_note }));
}

export function latestPoint(s: Point[]): Point | null {
  for (let i = s.length - 1; i >= 0; i--) if (s[i].value != null) return s[i];
  return null;
}

export function pointAt(s: Point[], period: string): Point | null {
  return s.find((p) => p.period === period) ?? null;
}

export function pctChange(current: number | null | undefined, base: number | null | undefined): number | null {
  if (current == null || base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}

/** Worst-case status for a value combining two observations. */
export function combineStatus(a: Status, b: Status): Status {
  const order: Status[] = ['missing', 'estimated', 'provisional', 'unknown', 'final'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))];
}

export interface Kpi {
  value: number | null;
  period: string | null;
  comparisonPeriod?: string | null;
  status: Status;
  note?: string;
}

export interface EuKpis {
  fatalities: Kpi;
  yoyAbs: Kpi;
  yoyPct: Kpi;
  rate: Kpi;
  baselineChangePct: Kpi;
  progress: Kpi & { reductionAchieved: number | null; reductionRequired: number | null };
  target: Target | null;
}

const NA: Kpi = { value: null, period: null, status: 'missing' };

export function computeEuKpis(obs: Observation[], targets: Target[]): EuKpis {
  const deaths = series(obs, EU, 'road_fatalities');
  const rates = series(obs, EU, 'road_fatalities_per_million');
  const target = targets.find((t) => t.geo === EU && t.indicator === 'road_fatalities') ?? null;
  const latest = latestPoint(deaths);
  if (!latest) {
    return {
      fatalities: NA, yoyAbs: NA, yoyPct: NA, rate: NA, baselineChangePct: NA,
      progress: { ...NA, reductionAchieved: null, reductionRequired: null }, target,
    };
  }
  const prevPeriod = String(Number(latest.period) - 1);
  const prev = pointAt(deaths, prevPeriod);
  const yoyStatus = prev?.value != null ? combineStatus(latest.status, prev.status) : 'missing';
  const yoyAbs = prev?.value != null ? latest.value! - prev.value : null;
  const rate = pointAt(rates, latest.period);
  const base = target ? pointAt(deaths, target.baseline_period) : null;
  const baseStatus = base?.value != null ? combineStatus(latest.status, base.status) : 'missing';
  const reductionAchieved = base?.value != null ? base.value - latest.value! : null;
  const reductionRequired = base?.value != null && target ? base.value * target.reduction_fraction : null;
  const progress = reductionAchieved != null && reductionRequired ? reductionAchieved / reductionRequired : null;

  return {
    fatalities: { value: latest.value, period: latest.period, status: latest.status },
    yoyAbs: { value: yoyAbs, period: latest.period, comparisonPeriod: prevPeriod, status: yoyStatus },
    yoyPct: { value: pctChange(latest.value, prev?.value), period: latest.period, comparisonPeriod: prevPeriod, status: yoyStatus },
    rate: { value: rate?.value ?? null, period: latest.period, status: rate?.status ?? 'missing', note: rate?.note },
    baselineChangePct: {
      value: pctChange(latest.value, base?.value), period: latest.period,
      comparisonPeriod: target?.baseline_period ?? null, status: baseStatus,
    },
    progress: {
      value: progress, period: latest.period, comparisonPeriod: target?.baseline_period ?? null,
      status: baseStatus, reductionAchieved, reductionRequired,
    },
    target,
  };
}

/** Linear analytical benchmark path from baseline to target. Not an official forecast. */
export function benchmarkPath(target: Target | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!target || target.baseline_value == null || target.target_value == null) return out;
  const y0 = Number(target.baseline_period);
  const y1 = Number(target.target_period);
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / (y1 - y0);
    out.set(String(y), target.baseline_value + t * (target.target_value - target.baseline_value));
  }
  return out;
}

export interface CountryRow {
  geo: string;
  name: string;
  period: string | null;
  fatalities: number | null;
  status: Status;
  rate: number | null;
  rateStatus: Status;
  yoyPct: number | null;
  baselinePct: number | null;
}

export function countryRows(obs: Observation[], countries: Country[], baselinePeriod = '2019'): CountryRow[] {
  return countries.map((c) => {
    const d = series(obs, c.geo, 'road_fatalities');
    const latest = latestPoint(d);
    const rate = latest ? pointAt(series(obs, c.geo, 'road_fatalities_per_million'), latest.period) : null;
    const prev = latest ? pointAt(d, String(Number(latest.period) - 1)) : null;
    const base = pointAt(d, baselinePeriod);
    return {
      geo: c.geo,
      name: c.name,
      period: latest?.period ?? null,
      fatalities: latest?.value ?? null,
      status: latest?.status ?? 'missing',
      rate: rate?.value ?? null,
      rateStatus: rate?.status ?? 'missing',
      yoyPct: latest ? pctChange(latest.value, prev?.value) : null,
      baselinePct: latest ? pctChange(latest.value, base?.value) : null,
    };
  });
}

export type SortKey = 'name' | 'fatalities' | 'rate' | 'yoyPct' | 'baselinePct' | 'period';
export type SortDir = 'asc' | 'desc';

/** Sort rows; missing values always sort last regardless of direction. */
export function sortRows(rows: CountryRow[], key: SortKey, dir: SortDir): CountryRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return c !== 0 ? sign * c : a.name.localeCompare(b.name);
  });
}

export function missingPeriods(s: Point[]): string[] {
  const first = s.findIndex((p) => p.value != null);
  const last = s.length - 1 - [...s].reverse().findIndex((p) => p.value != null);
  if (first < 0) return s.map((p) => p.period);
  return s.slice(first, last + 1).filter((p) => p.value == null).map((p) => p.period);
}
