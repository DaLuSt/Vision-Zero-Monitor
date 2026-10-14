import type { Breakdowns, Observation, Status } from '../types/data';
import { combineStatus, EU, series, type Point } from './indicators';
import { categoryPoints, parseCategoryKey, perMillion } from './breakdowns';

export type Measure = 'deaths' | 'rate' | 'index' | 'share';
/** Measures offered by the chart builder ('share' only makes sense within one breakdown). */
export const BUILDER_MEASURES: Measure[] = ['deaths', 'rate', 'index'];
export type Layout = 'combined' | 'separate';

export const MEASURES: Record<Measure, { label: string; unit: string; axis: string }> = {
  deaths: { label: 'Deaths', unit: 'deaths', axis: 'Road deaths' },
  rate: { label: 'Per million inhabitants', unit: 'per million', axis: 'Road deaths per million inhabitants' },
  index: { label: 'Index (2019 = 100)', unit: 'index', axis: 'Road deaths, index 2019 = 100' },
  share: { label: 'Share of deaths', unit: '%', axis: 'Share of road deaths (%)' },
};

/** Categorical palette slots (validated: see docs/METHODOLOGY.md § Charts). */
export const MAX_COMBINED_SERIES = 8;
export const INDEX_BASE = '2019';

export interface BuilderState {
  geos: string[];
  /** Breakdown category as "dimension.category" (e.g. "vehicle.CYCLE"); null = all road deaths. */
  cat: string | null;
  measure: Measure;
  layout: Layout;
  from: string;
  to: string;
}

/**
 * Points for one geography and measure, optionally for one breakdown category.
 * Index = value / value[2019] * 100 on death counts. Category rates use average population.
 */
export function measureSeries(obs: Observation[], geo: string, measure: Measure,
  bd?: Breakdowns | null, catKey?: string | null): Point[] {
  const cat = parseCategoryKey(catKey, bd);
  let deaths: Point[];
  if (cat && bd) {
    deaths = categoryPoints(bd, geo, cat.dimension.id, cat.category.id);
    if (measure === 'rate') return perMillion(deaths, obs, geo);
  } else {
    if (measure === 'rate') return series(obs, geo, 'road_fatalities_per_million');
    deaths = series(obs, geo, 'road_fatalities');
  }
  if (measure === 'deaths' || measure === 'share') return deaths;
  const base = deaths.find((p) => p.period === INDEX_BASE);
  return deaths.map((p) => {
    if (p.value == null || base?.value == null || base.value === 0) {
      return { ...p, value: null, status: 'missing' as Status };
    }
    return { ...p, value: (p.value / base.value) * 100, status: combineStatus(p.status, base.status) };
  });
}

export function inRange(points: Point[], from: string, to: string): Point[] {
  return points.filter((p) => p.period >= from && p.period <= to);
}

export interface WideRow {
  period: string;
  [key: string]: string | number | null;
}

/** Wide rows for Recharts: one row per year, `<geo>` = value, `<geo>__status` = status. */
export function wideRows(bySeries: { geo: string; points: Point[] }[], from: string, to: string): WideRow[] {
  const rows: WideRow[] = [];
  for (let y = Number(from); y <= Number(to); y++) {
    const period = String(y);
    const row: WideRow = { period };
    for (const s of bySeries) {
      const p = s.points.find((q) => q.period === period);
      row[s.geo] = p?.value ?? null;
      row[`${s.geo}__status`] = p?.status ?? 'missing';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Give each selected geography a stable palette slot: a geography keeps its colour
 * while others are added or removed (colour follows the entity, not its position).
 */
export function assignSlots(geos: string[], previous: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of geos) if (previous[g] != null) out[g] = previous[g];
  for (const g of geos) {
    if (out[g] != null) continue;
    const used = new Set(Object.values(out));
    let slot = 0;
    while (used.has(slot) && slot < MAX_COMBINED_SERIES - 1) slot++;
    out[g] = slot;
  }
  return out;
}

const VALID_MEASURES = new Set<Measure>(BUILDER_MEASURES);

/** Parse builder state from a query string, keeping only known geographies, categories and years. */
export function parseBuilderParams(query: string, knownGeos: string[], periods: string[], knownCats: string[] = []): BuilderState {
  const q = new URLSearchParams(query);
  const known = new Set(knownGeos);
  const geos = [...new Set((q.get('geo') ?? EU).split(',').map((g) => g.trim().toUpperCase()))].filter((g) => known.has(g));
  const measure = (q.get('measure') ?? 'deaths') as Measure;
  const first = periods[0] ?? '';
  const last = periods[periods.length - 1] ?? '';
  let from = periods.includes(q.get('from') ?? '') ? q.get('from')! : first;
  let to = periods.includes(q.get('to') ?? '') ? q.get('to')! : last;
  if (from > to) [from, to] = [to, from];
  const cat = q.get('cat');
  return {
    geos: geos.length || q.has('geo') ? geos : [EU],
    cat: cat && knownCats.includes(cat) ? cat : null,
    measure: VALID_MEASURES.has(measure) ? measure : 'deaths',
    layout: q.get('layout') === 'separate' ? 'separate' : 'combined',
    from,
    to,
  };
}

export function builderQuery(s: BuilderState): string {
  const q = new URLSearchParams();
  q.set('geo', s.geos.join(','));
  if (s.cat) q.set('cat', s.cat);
  q.set('measure', s.measure);
  q.set('layout', s.layout);
  q.set('from', s.from);
  q.set('to', s.to);
  return q.toString().replace(/%2C/g, ',');
}

/** Round up to a tidy axis maximum (1, 2, 2.5, 5 × 10^n). */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * mag >= v) return f * mag;
  return 10 * mag;
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of exactly the values plotted. */
export function chartCsv(bySeries: { geo: string; name: string; points: Point[] }[], measure: Measure): string {
  const lines = ['geo,geo_name,period,measure,value,status'];
  for (const s of bySeries) {
    for (const p of s.points) {
      const v = p.value == null ? '' : measure === 'deaths' ? p.value : Math.round(p.value * 10) / 10;
      lines.push([s.geo, s.name, p.period, measure, v, p.status].map(csvCell).join(','));
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}
