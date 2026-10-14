import type { Status } from '../types/data';

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const NOT_AVAILABLE = 'Not available';

export function fmtInt(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? NOT_AVAILABLE : nf0.format(v);
}

export function fmtRate(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? NOT_AVAILABLE : nf1.format(v);
}

export function fmtPct(v: number | null | undefined, signed = true): string {
  if (v == null || !Number.isFinite(v)) return NOT_AVAILABLE;
  const s = nf1.format(Math.abs(v));
  if (!signed) return `${s}%`;
  // Use a true minus sign for legibility.
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${s}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return `${d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })} UTC`;
}

export const STATUS_LABEL: Record<Status, string> = {
  final: 'Final',
  provisional: 'Provisional',
  estimated: 'Estimated',
  missing: 'Not available',
  unknown: 'No status flag',
};

export const STATUS_DESCRIPTION: Record<Status, string> = {
  final: 'Published by the source as final.',
  provisional: 'Flagged by the source as provisional; may be revised.',
  estimated: 'Flagged by the source as estimated.',
  missing: 'No value published for this period. Shown as a gap, never as zero.',
  unknown: 'Published by Eurostat without a status flag. Not marked provisional or estimated, but finality cannot be confirmed; official figures can still be revised.',
};

/** Provisional/estimated values are "qualified": shown with a hollow marker and a text label. */
export function isQualified(s: Status): boolean {
  return s === 'provisional' || s === 'estimated';
}
