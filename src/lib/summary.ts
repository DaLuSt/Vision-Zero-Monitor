import type { Point } from './indicators';
import { missingPeriods, pctChange } from './indicators';
import { fmtPct } from './format';

/** Plain-language description of a series for screen readers and non-visual users. */
export function describeSeries(points: Point[], subject: string, fmt: (v: number) => string): string {
  const withData = points.filter((p) => p.value != null);
  if (!withData.length) return `No data are available for ${subject}.`;
  const first = withData[0];
  const last = withData[withData.length - 1];
  const min = withData.reduce((a, b) => (b.value! < a.value! ? b : a));
  const max = withData.reduce((a, b) => (b.value! > a.value! ? b : a));
  const change = pctChange(last.value, first.value);
  const parts = [
    `${subject} ${first.period === last.period ? `in ${first.period} was ${fmt(first.value!)}` : `went from ${fmt(first.value!)} in ${first.period} to ${fmt(last.value!)} in ${last.period} (${fmtPct(change)})`}.`,
  ];
  if (withData.length > 2) parts.push(`The highest value was ${fmt(max.value!)} in ${max.period}; the lowest was ${fmt(min.value!)} in ${min.period}.`);
  const gaps = missingPeriods(points);
  if (gaps.length) parts.push(`No data for ${gaps.join(', ')}.`);
  const qualified = withData.filter((p) => p.status === 'provisional' || p.status === 'estimated').map((p) => p.period);
  if (qualified.length) parts.push(`Values for ${qualified.join(', ')} are provisional or estimated.`);
  return parts.join(' ');
}
