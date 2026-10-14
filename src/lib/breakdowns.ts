import type { BreakdownDimension, BreakdownDimensionId, Breakdowns, Observation, Status } from '../types/data';
import { combineStatus, EU, series, type Point } from './indicators';

export const MEMBER_STATE_COUNT = 27;

/** Categories that hold deaths whose category is unknown or unspecified. */
export const UNSPECIFIED_CATEGORIES = new Set(['road_user.UNK', 'vehicle.OTHER']);

/** First period from which every Member State reports the breakdown (EU values comparable). */
export function euComparableFrom(bd: Breakdowns, dim: BreakdownDimension): string | null {
  const cov = dim.eu_members_reporting ?? [];
  for (let i = 0; i < bd.periods.length; i++) {
    if (bd.periods.slice(i).every((_, j) => (cov[i + j] ?? 0) >= MEMBER_STATE_COUNT)) return bd.periods[i];
  }
  return null;
}

/**
 * Fixed colour per category (colour follows the entity). Pedestrians share one colour in both
 * dimensions; "unknown"/"other" categories use a neutral grey rather than a categorical hue.
 */
const CATEGORY_COLOR: Record<string, string> = {
  'road_user.DRIV': 'var(--cat-1)',
  'road_user.PAS': 'var(--cat-2)',
  'road_user.PED': 'var(--cat-7)',
  'road_user.UNK': 'var(--cat-neutral)',
  'vehicle.CAR': 'var(--cat-1)',
  'vehicle.MOTO': 'var(--cat-2)',
  'vehicle.MOP': 'var(--cat-5)',
  'vehicle.CYCLE': 'var(--cat-3)',
  'vehicle.GOODS': 'var(--cat-4)',
  'vehicle.BUS': 'var(--cat-6)',
  'vehicle.PED': 'var(--cat-7)',
  'vehicle.OTHER': 'var(--cat-neutral)',
};

export function categoryColor(dim: BreakdownDimensionId, cat: string): string {
  return CATEGORY_COLOR[`${dim}.${cat}`] ?? 'var(--cat-neutral)';
}

/** "vehicle.CYCLE" ⇄ { dimension, category }; used in URLs. */
export function parseCategoryKey(key: string | null | undefined, bd: Breakdowns | null | undefined) {
  if (!key || !bd) return null;
  const [dimension, category] = key.split('.');
  const dim = bd.dimensions.find((d) => d.id === dimension);
  const cat = dim?.categories.find((c) => c.id === category);
  return dim && cat ? { dimension: dim, category: cat, key: `${dim.id}.${cat.id}` } : null;
}

export function getDimension(bd: Breakdowns, id: BreakdownDimensionId): BreakdownDimension | undefined {
  return bd.dimensions.find((d) => d.id === id);
}

/**
 * Deaths for one category as points (same shape as other series).
 * EU values are withheld for years in which not every Member State reported the breakdown:
 * Eurostat's EU aggregate then counts the non-reporting countries' deaths as "unknown",
 * so those years are not comparable with later ones.
 */
export function categoryPoints(bd: Breakdowns, geo: string, dim: BreakdownDimensionId, cat: string): Point[] {
  const s = bd.series.find((x) => x.geo === geo && x.dimension === dim && x.category === cat);
  const cov = bd.dimensions.find((d) => d.id === dim)?.eu_members_reporting;
  return bd.periods.map((period, i) => {
    if (geo === EU && cov && (cov[i] ?? 0) < MEMBER_STATE_COUNT) {
      return { period, value: null, status: 'missing' as Status, flag: null, note: 'EU breakdown incomplete' };
    }
    return {
      period,
      value: s ? s.values[i] : null,
      status: s ? s.statuses[i] : ('missing' as Status),
      flag: null,
    };
  });
}

/** Per million inhabitants using the same average population and rule as the published rates. */
export function perMillion(deaths: Point[], obs: Observation[], geo: string): Point[] {
  const pop = new Map(series(obs, geo, 'population_average').map((p) => [p.period, p]));
  return deaths.map((d) => {
    const p = pop.get(d.period);
    if (d.value == null || p?.value == null || p.value === 0) return { ...d, value: null, status: 'missing' as Status };
    return { ...d, value: Math.round((d.value / p.value) * 1e7) / 10, status: combineStatus(d.status, p.status) };
  });
}

/** Share (%) of each category in the sum of all categories; null for years with any category missing. */
export function sharePoints(bd: Breakdowns, geo: string, dim: BreakdownDimension): Record<string, Point[]> {
  const all = Object.fromEntries(dim.categories.map((c) => [c.id, categoryPoints(bd, geo, dim.id, c.id)]));
  const out: Record<string, Point[]> = {};
  for (const c of dim.categories) {
    out[c.id] = all[c.id].map((p, i) => {
      const parts = dim.categories.map((k) => all[k.id][i].value);
      if (p.value == null || parts.some((v) => v == null)) return { ...p, value: null, status: 'missing' as Status };
      const total = (parts as number[]).reduce((a, b) => a + b, 0);
      return { ...p, value: total ? (p.value / total) * 100 : null };
    });
  }
  return out;
}

export interface CategoryRow {
  id: string;
  label: string;
  description: string;
  value: number | null;
  share: number | null;
  status: Status;
  baseline: number | null;
  changeFromBaseline: number | null;
}

/** Latest year in which every category has a value (so shares add up to 100 %). */
export function latestCompletePeriod(bd: Breakdowns, geo: string, dim: BreakdownDimension): string | null {
  const pts = dim.categories.map((c) => categoryPoints(bd, geo, dim.id, c.id));
  for (let i = bd.periods.length - 1; i >= 0; i--) {
    if (pts.every((p) => p[i].value != null)) return bd.periods[i];
  }
  return null;
}

export function categoryRows(bd: Breakdowns, geo: string, dim: BreakdownDimension, period: string, baselinePeriod = '2019'): CategoryRow[] {
  const i = bd.periods.indexOf(period);
  const b = bd.periods.indexOf(baselinePeriod);
  const pts = Object.fromEntries(dim.categories.map((c) => [c.id, categoryPoints(bd, geo, dim.id, c.id)]));
  const total = dim.categories.reduce((sum, c) => sum + (pts[c.id][i]?.value ?? 0), 0);
  return dim.categories.map((c) => {
    const p = pts[c.id];
    const value = p[i]?.value ?? null;
    const baseline = b >= 0 ? p[b]?.value ?? null : null;
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      value,
      share: value != null && total ? (value / total) * 100 : null,
      status: p[i]?.status ?? 'missing',
      baseline,
      changeFromBaseline: value != null && baseline ? ((value - baseline) / baseline) * 100 : null,
    };
  });
}

export function breakdownCsv(bd: Breakdowns, geo: string, geoName: string, dim: BreakdownDimension): string {
  // Published values for every year; for the EU, the coverage column shows which years are comparable.
  const lines = ['geo,geo_name,dimension,category,category_label,period,value,status,eu_members_reporting,source_id'];
  for (const c of dim.categories) {
    const s = bd.series.find((x) => x.geo === geo && x.dimension === dim.id && x.category === c.id);
    bd.periods.forEach((period, i) => {
      const label = /[",]/.test(c.label) ? `"${c.label.replace(/"/g, '""')}"` : c.label;
      const name = /[",]/.test(geoName) ? `"${geoName.replace(/"/g, '""')}"` : geoName;
      const cov = geo === EU ? dim.eu_members_reporting?.[i] ?? '' : '';
      lines.push([geo, name, dim.id, c.id, label, period, s?.values[i] ?? '', s?.statuses[i] ?? 'missing', cov, dim.source_id].join(','));
    });
  }
  return `${lines.join('\r\n')}\r\n`;
}
