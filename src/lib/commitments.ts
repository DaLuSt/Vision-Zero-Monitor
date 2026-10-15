import type { Commitment, CommitmentForm, CommitmentLevel, Commitments, Observation, TargetOutcome } from '../types/data';
import { EU, series } from './indicators';

export const FORM_LABEL: Record<CommitmentForm, string> = {
  commission_policy: 'Commission policy',
  council_conclusions: 'Council conclusions',
  ministerial_declaration: 'Ministerial declaration',
  un_resolution: 'UN resolution',
  national_strategy: 'National strategy',
};

export const LEVEL_LABEL: Record<CommitmentLevel, string> = {
  eu: 'European Union',
  global: 'Global',
  national: 'National',
};

export const BASIS_LABEL: Record<TargetOutcome['basis'], string> = {
  as_stated: 'As stated in the document',
  commission_monitoring: 'Commission monitoring baseline',
};

/** "2019" stays a year; full dates are formatted by the caller. */
export function isYearOnly(date: string): boolean {
  return /^\d{4}$/.test(date);
}

export function byLevel(doc: Commitments): { level: CommitmentLevel; items: Commitment[] }[] {
  const order: CommitmentLevel[] = ['eu', 'national', 'global'];
  return order
    .map((level) => ({ level, items: doc.commitments.filter((c) => c.level === level) }))
    .filter((g) => g.items.length > 0);
}

export interface TargetPath {
  key: string;
  label: string;
  color: string;
  dashed: boolean;
  from: { year: number; value: number };
  to: { year: number; value: number };
}

const PATH_COLORS = ['var(--cat-2)', 'var(--cat-3)', 'var(--cat-7)', 'var(--cat-4)'];

/**
 * One straight line per distinct measured target (baseline value → target value), for the chart.
 * Targets repeated in several commitments (e.g. the 2010–2020 halving) are drawn once.
 */
export function targetPaths(doc: Commitments): TargetPath[] {
  const seen = new Map<string, TargetPath>();
  for (const c of doc.commitments) {
    for (const t of c.targets) {
      for (const o of t.outcomes) {
        if (o.baseline_value == null || o.target_value == null) continue;
        const key = `t${o.baseline_year}_${o.target_year}`;
        if (seen.has(key)) continue;
        const label = o.basis === 'commission_monitoring'
          ? `−50 % by ${o.target_year}, measured from ${o.baseline_year} (Commission monitoring)`
          : `−${Math.round(-o.required_change_pct)} % from ${o.baseline_year} to ${o.target_year} (as stated)`;
        seen.set(key, {
          key, label, color: PATH_COLORS[seen.size % PATH_COLORS.length], dashed: true,
          from: { year: o.baseline_year, value: o.baseline_value },
          to: { year: o.target_year, value: o.target_value },
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.from.year - b.from.year || a.to.year - b.to.year);
}

export interface ChartRow {
  year: number;
  deaths: number | null;
  [key: string]: number | null;
}

/** Official EU road deaths per year plus the end points of each target line (straight lines between them). */
export function chartRows(observations: Observation[], paths: TargetPath[], fromYear = 2001): ChartRow[] {
  const pts = series(observations, EU, 'road_fatalities').filter((p) => Number(p.period) >= fromYear);
  if (!pts.length) return [];
  const last = Math.max(Number(pts[pts.length - 1].period), ...paths.map((p) => p.to.year));
  const byYear = new Map(pts.map((p) => [Number(p.period), p.value]));
  const rows: ChartRow[] = [];
  for (let y = Number(pts[0].period); y <= last; y++) {
    const row: ChartRow = { year: y, deaths: byYear.get(y) ?? null };
    for (const p of paths) {
      row[p.key] = y === p.from.year ? p.from.value : y === p.to.year ? p.to.value : null;
    }
    rows.push(row);
  }
  return rows;
}
