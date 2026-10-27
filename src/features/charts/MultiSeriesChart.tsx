import { useId, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Point } from '../../lib/indicators';
import type { Status } from '../../types/data';
import { fmtInt, fmtRate, isQualified, STATUS_LABEL } from '../../lib/format';
import { describeSeries } from '../../lib/summary';
import { chartCsv, INDEX_BASE, MEASURES, wideRows, type Measure, type WideRow } from '../../lib/chartData';
import { downloadChartPng, downloadText, resolveColor, slug } from '../../lib/exportChart';
import { StatusBadge } from '../../components/StatusBadge';
import { scrollArea } from '../../lib/scrollArea';

export interface ChartSeries {
  geo: string;
  name: string;
  points: Point[];
  color: string; // CSS colour expression, e.g. var(--cat-1)
}

interface Props {
  title: string;
  /** Overrides the default "<measure>, <from>–<to>" subtitle. */
  subtitle?: string;
  /** Source line for exported images. */
  source?: string;
  series: ChartSeries[];
  measure: Measure;
  from: string;
  to: string;
  height?: number;
  yDomain?: [number, number];
  compact?: boolean;
}

export const SOURCE_LINE =
  'Source: Eurostat (tran_sf_roadus, demo_gind) · Vision Zero Monitor';

/** Source line naming the Eurostat datasets a chart actually uses. */
export function sourceLine(datasets: string[]): string {
  return `Source: Eurostat (${[...new Set(datasets)].join(', ')}) · Vision Zero Monitor`;
}

export function formatFor(measure: Measure): (v: number) => string {
  if (measure === 'share') return (v: number) => `${fmtRate(v)}%`;
  return measure === 'deaths' ? fmtInt : fmtRate;
}

function makeDot(geo: string, color: string) {
  return function SeriesDot(props: { cx?: number; cy?: number; payload?: WideRow }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload || payload[geo] == null) return <g key={`${geo}-${payload?.period}`} />;
    const status = payload[`${geo}__status`] as Status;
    const key = `${geo}-${payload.period}`;
    if (isQualified(status)) {
      const s = 5;
      return <path key={key} d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
        fill="var(--surface)" stroke={color} strokeWidth={2} />;
    }
    return <circle key={key} cx={cx} cy={cy} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />;
  };
}

function MultiTooltip({ active, payload, label, series, format }: {
  active?: boolean; label?: string; payload?: { payload: WideRow }[]; series: ChartSeries[]; format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const items = series
    .map((s) => ({ s, v: row[s.geo] as number | null, st: row[`${s.geo}__status`] as Status }))
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__period">{label}</p>
      {items.map(({ s, v, st }) => (
        <p key={s.geo} className="chart-tooltip__row">
          <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
          {s.name}: <strong>{v != null ? format(v) : 'n/a'}</strong>
          {v != null && st !== 'unknown' ? <span className="muted"> · {STATUS_LABEL[st]}</span> : null}
        </p>
      ))}
    </div>
  );
}

export function MultiSeriesChart({ title, subtitle: subtitleOverride, source = SOURCE_LINE, series, measure, from, to, height = 360, yDomain, compact = false }: Props) {
  const id = useId();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const format = formatFor(measure);
  const m = MEASURES[measure];
  const rows = useMemo(() => wideRows(series, from, to), [series, from, to]);
  const hasData = series.some((s) => s.points.some((p) => p.value != null));
  const hasQualified = series.some((s) => s.points.some((p) => p.value != null && isQualified(p.status)));
  // Direct end labels for 2–4 lines (palette relief rule); omitted on narrow screens where the legend suffices.
  const wide = typeof window === 'undefined' || window.innerWidth >= 600;
  const endLabels = series.length > 1 && series.length <= 4 && !compact && wide;
  const subtitle = subtitleOverride ?? `${m.axis}, ${from}–${to}`;
  const fileBase = slug(`${title}-${measure}-${from}-${to}`);

  const lastIndex = (geo: string) => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i][geo] != null) return i;
    return -1;
  };

  const onPng = async () => {
    setExportError(null);
    const svg = canvasRef.current?.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!svg) { setExportError('The chart is not rendered yet.'); return; }
    try {
      await downloadChartPng(svg, {
        title, subtitle,
        legend: series.length > 1 ? series.map((s) => ({ label: s.name, color: resolveColor(s.color) })) : [],
        source,
      }, `${fileBase}.png`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  const onCsv = () => downloadText(chartCsv(series.map((s) => ({ ...s, points: s.points.filter((p) => p.period >= from && p.period <= to) })), measure), `${fileBase}.csv`);

  return (
    <figure className={`chart${compact ? ' chart--compact' : ''}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
      <div className="chart__header">
        <figcaption id={`${id}-title`} className="chart__title">
          {title}<span className="visually-hidden">:</span>{' '}
          <span className="chart__subtitle">{subtitle}</span>
        </figcaption>
        <div className="chart__actions">
          <button type="button" className="button button--ghost button--small" onClick={onPng} disabled={!hasData}>
            PNG{' '}<span className="visually-hidden">image of {title}</span>
          </button>
          <button type="button" className="button button--ghost button--small" onClick={onCsv} disabled={!hasData}>
            CSV{' '}<span className="visually-hidden">data for {title}</span>
          </button>
        </div>
      </div>
      {exportError && <p className="small" role="alert">{exportError}</p>}
      {!hasData ? (
        <p className="state state--empty">No data available for this selection.</p>
      ) : (
        <div className="chart__canvas" ref={canvasRef}>
          <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
            <LineChart data={rows} margin={{ top: 12, right: endLabels ? Math.min(170, 16 + Math.max(...series.map((s) => s.name.length)) * 6.6) : 16, bottom: 4, left: 4 }} accessibilityLayer title={title}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false}
                axisLine={{ stroke: 'var(--axis)' }} minTickGap={compact ? 24 : 16} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => fmtInt(v)} width={compact ? 48 : 60}
                domain={yDomain ?? [0, 'auto']} allowDataOverflow={false} />
              <Tooltip content={<MultiTooltip series={series} format={format} />} cursor={{ stroke: 'var(--axis)' }} />
              {INDEX_BASE >= from && INDEX_BASE <= to && (
                <ReferenceLine x={INDEX_BASE} stroke="var(--text-secondary)"
                  label={compact || !wide ? undefined : { value: `${INDEX_BASE} baseline`, position: 'insideTopLeft', fill: 'var(--text-secondary)', fontSize: 12 }} />
              )}
              {measure === 'index' && <ReferenceLine y={100} stroke="var(--axis)" />}
              {series.map((s) => {
                const last = lastIndex(s.geo);
                return (
                  <Line key={s.geo} type="linear" dataKey={s.geo} name={s.name} stroke={s.color} strokeWidth={2}
                    dot={makeDot(s.geo, s.color)} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: s.color }}
                    connectNulls={false} isAnimationActive={false}
                    label={endLabels ? (p: { x?: number | string; y?: number | string; index?: number }) => (
                      p.index === last && p.x != null && p.y != null
                        ? <text key={`${s.geo}-label`} x={Number(p.x) + 8} y={Number(p.y) + 4} fontSize={12} fill="var(--text)">{s.name}</text>
                        : <g key={`${s.geo}-nolabel-${p.index}`} />
                    ) : undefined} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {series.length > 1 && (
        <ul className="chart-legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.geo}><span className="legend-swatch" style={{ borderTop: `2px solid ${s.color}` }} aria-hidden="true" /> {s.name}</li>
          ))}
        </ul>
      )}
      {hasData && (
        <ul className="chart-legend chart-legend--notes">
          {hasQualified && <li><span className="legend-swatch legend-swatch--diamond" aria-hidden="true" /> Provisional or estimated</li>}
          <li className="muted">Gaps mean no official value, not zero.</li>
          {measure === 'index' && <li className="muted">Index: deaths in each year ÷ deaths in {INDEX_BASE} × 100.</li>}
        </ul>
      )}
      <div id={`${id}-summary`} className="chart__summary">
        {series.map((s) => (
          <p key={s.geo}>{describeSeries(s.points.filter((p) => p.period >= from && p.period <= to), s.name, format)}</p>
        ))}
      </div>
      {hasData && (
        <details className="chart__table">
          <summary>Show data table</summary>
          <div {...scrollArea(`Data table: ${title}`)}>
            <table>
              <caption className="visually-hidden">{title}: {subtitle}</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  {series.map((s) => <th key={s.geo} scope="col" className="num">{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period}>
                    <th scope="row">{r.period}</th>
                    {series.map((s) => {
                      const v = r[s.geo] as number | null;
                      const st = r[`${s.geo}__status`] as Status;
                      return (
                        <td key={s.geo} className="num">
                          {v != null ? format(v) : 'Not available'}
                          {v != null && isQualified(st) ? <> <StatusBadge status={st} compact /></> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
