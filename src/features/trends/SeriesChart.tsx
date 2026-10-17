import { useId, useMemo } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Point } from '../../lib/indicators';
import { isQualified, STATUS_LABEL } from '../../lib/format';
import { describeSeries } from '../../lib/summary';
import { StatusBadge } from '../../components/StatusBadge';
import { scrollArea } from '../../lib/scrollArea';

export interface Benchmark {
  baselinePeriod: string;
  targetPeriod: string;
  targetValue: number;
  path: Map<string, number>;
}

interface Row {
  period: string;
  value: number | null;
  status: Point['status'] | null;
  flag: string | null;
  benchmark: number | null;
}

interface Props {
  title: string;
  subject: string;
  points: Point[];
  unitLabel: string;
  format: (v: number) => string;
  baselinePeriod?: string;
  benchmark?: Benchmark | null;
  height?: number;
}

function Dot(props: { cx?: number; cy?: number; payload?: Row }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload || payload.value == null) return <g />;
  if (payload.status && isQualified(payload.status)) {
    // Hollow diamond: provisional / estimated.
    const s = 6;
    return (
      <path
        d={`M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`}
        fill="var(--surface)" stroke="var(--series-1)" strokeWidth={2}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />;
}

function ChartTooltip({ active, payload, format, unitLabel }: {
  active?: boolean; payload?: { payload: Row }[]; format: (v: number) => string; unitLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__period">{row.period}</p>
      {row.value != null ? (
        <p><strong>{format(row.value)}</strong> {unitLabel} · {row.status ? STATUS_LABEL[row.status] : ''}</p>
      ) : (
        <p>No official value</p>
      )}
      {row.benchmark != null && <p className="muted">Linear benchmark path: {format(row.benchmark)}</p>}
    </div>
  );
}

export function SeriesChart({ title, subject, points, unitLabel, format, baselinePeriod, benchmark, height = 320 }: Props) {
  const id = useId();
  const rows = useMemo<Row[]>(() => {
    const byPeriod = new Map(points.map((p) => [p.period, p]));
    const firstWithData = points.find((p) => p.value != null)?.period;
    if (!firstWithData) return [];
    const lastPeriod = points[points.length - 1].period;
    const end = Math.max(Number(lastPeriod), benchmark ? Number(benchmark.targetPeriod) : 0);
    const out: Row[] = [];
    for (let y = Number(firstWithData); y <= end; y++) {
      const p = byPeriod.get(String(y));
      out.push({
        period: String(y),
        value: p?.value ?? null,
        status: p?.status ?? null,
        flag: p?.flag ?? null,
        benchmark: benchmark?.path.get(String(y)) ?? null,
      });
    }
    return out;
  }, [points, benchmark]);

  const summary = describeSeries(points, subject, format);
  const hasQualified = points.some((p) => p.value != null && isQualified(p.status));

  if (!rows.length) {
    return (
      <figure className="chart">
        <figcaption className="chart__title">{title}</figcaption>
        <p className="state state--empty">No data available for this series.</p>
      </figure>
    );
  }

  return (
    <figure className="chart" aria-labelledby={`${id}-title`} aria-describedby={`${id}-summary`}>
      <figcaption id={`${id}-title`} className="chart__title">{title}</figcaption>
      <div className="chart__canvas" aria-hidden="false">
        <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
          <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: 8 }} accessibilityLayer title={title}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }} minTickGap={16} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => format(v)} width={64} domain={[0, 'auto']} />
            <Tooltip content={<ChartTooltip format={format} unitLabel={unitLabel} />} cursor={{ stroke: 'var(--axis)' }} />
            {baselinePeriod && (
              <ReferenceLine x={baselinePeriod} stroke="var(--text-secondary)"
                label={{ value: `${baselinePeriod} baseline`, position: 'insideTopLeft', fill: 'var(--text-secondary)', fontSize: 12 }} />
            )}
            {benchmark && (
              <ReferenceLine y={benchmark.targetValue} stroke="var(--benchmark)" strokeDasharray="2 4"
                label={{ value: `${benchmark.targetPeriod} benchmark: ${format(benchmark.targetValue)}`, position: 'insideBottomLeft', fill: 'var(--text-secondary)', fontSize: 12 }} />
            )}
            {benchmark && (
              <Line type="linear" dataKey="benchmark" name="Linear benchmark path" stroke="var(--benchmark)"
                strokeWidth={1.5} strokeDasharray="6 4" dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
            )}
            <Line type="linear" dataKey="value" name={subject} stroke="var(--series-1)" strokeWidth={2}
              dot={<Dot />} activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series-1)' }}
              connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="chart-legend" aria-label="Legend">
        <li><span className="legend-swatch legend-swatch--line" aria-hidden="true" /> {subject} (official)</li>
        {hasQualified && <li><span className="legend-swatch legend-swatch--diamond" aria-hidden="true" /> Provisional or estimated value</li>}
        {benchmark && <li><span className="legend-swatch legend-swatch--dashed" aria-hidden="true" /> Linear path to {benchmark.targetPeriod} benchmark (analytical, not a forecast)</li>}
        <li className="muted">Gaps in the line mean no official value; they are not zero.</li>
      </ul>
      <p id={`${id}-summary`} className="chart__summary">{summary}</p>
      <details className="chart__table">
        <summary>Show data table</summary>
        <div {...scrollArea(`Data table: ${title}`)}>
          <table>
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr><th scope="col">Year</th><th scope="col" className="num">Value ({unitLabel})</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.period}>
                  <th scope="row">{p.period}</th>
                  <td className="num">{p.value != null ? format(p.value) : 'Not available'}</td>
                  <td><StatusBadge status={p.status} flag={p.flag} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
