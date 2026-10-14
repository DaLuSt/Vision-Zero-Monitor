import type { Observation } from '../types/data';

export const CSV_COLUMNS: (keyof Observation)[] = [
  'geo', 'geo_name', 'period', 'indicator', 'value', 'unit', 'status', 'source_flag',
  'source_id', 'source_url', 'source_published_at', 'retrieved_at',
];

function cell(v: unknown): string {
  if (v == null) return '';
  let s = String(v);
  // Guard against spreadsheet formula injection from text fields.
  if (typeof v === 'string' && /^[=+@\t\r-]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Observation[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell(r[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(rows: Observation[], filename: string): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
