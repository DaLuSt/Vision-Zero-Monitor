import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BarShapeProps } from 'recharts';
import type { BreakdownDimension, Breakdowns, Dataset } from '../../types/data';
import { EU } from '../../lib/indicators';
import {
  barRows, breakdownCsv, categoryColor, categoryPoints, categoryRows, euComparableFrom, latestCompletePeriod, sharePoints,
  UNSPECIFIED_CATEGORIES, type CategoryRow,
} from '../../lib/breakdowns';
import { measureSeries, type Measure } from '../../lib/chartData';
import { fmtInt, fmtPct, fmtRate } from '../../lib/format';
import { downloadChartPng, downloadText, slug } from '../../lib/exportChart';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, Notice } from '../../components/States';
import { MultiSeriesChart, sourceLine, type ChartSeries } from '../charts/MultiSeriesChart';
import { scrollArea } from '../../lib/scrollArea';

// A custom shape keeps zero-value bars (Recharts drops zero-size default bars), so a category with 0 deaths
// still gets its "0 · 0.0%" label.
const barShape = (props: BarShapeProps) => <Rectangle {...props} />;

type TrendMeasure = Extract<Measure, 'deaths' | 'share' | 'index'>;
const TREND_MEASURES: { id: TrendMeasure; label: string }[] = [
  { id: 'deaths', label: 'Deaths' },
  { id: 'share', label: 'Share of deaths' },
  { id: 'index', label: 'Index (2019 = 100)' },
];

function CategoryBars({ rows, title, subtitle, source, ordinal = false }: {
  rows: CategoryRow[]; title: string; subtitle: string; source: string; ordinal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const data = barRows(rows, ordinal)
    .map((r) => ({ ...r, valueLabel: `${fmtInt(r.value)} · ${fmtRate(r.share)}%` }));
  const height = data.length * 38 + 24;
  const onPng = async () => {
    setError(null);
    const svg = ref.current?.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!svg) { setError('The chart is not rendered yet.'); return; }
    try {
      await downloadChartPng(svg, { title, subtitle, legend: [], source }, `${slug(`${title}-${subtitle}`)}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };
  return (
    <figure className="chart">
      <div className="chart__header">
        <figcaption className="chart__title">{title}<span className="chart__subtitle">{subtitle}</span></figcaption>
        <div className="chart__actions">
          <button type="button" className="button button--ghost button--small" onClick={onPng}>
            PNG<span className="visually-hidden"> image of {title}</span>
          </button>
        </div>
      </div>
      {error && <p className="small" role="alert">{error}</p>}
      <div className="chart__canvas" ref={ref}>
        <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 112, bottom: 4, left: 4 }} barCategoryGap={8} accessibilityLayer>
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }} tickFormatter={(v: number) => fmtInt(v)} />
            <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false}
              tick={{ fill: 'var(--text)', fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [fmtInt(typeof v === 'number' ? v : null), 'Deaths']}
              labelFormatter={(_, p) => (p?.[0]?.payload as CategoryRow | undefined)?.label ?? ''}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            <Bar dataKey="value" fill="var(--series-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} shape={barShape}>
              <LabelList dataKey="valueLabel" position="right" fontSize={12} fill="var(--text)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function DimensionSection({ data, bd, dim, geo, geoName }: {
  data: Dataset; bd: Breakdowns; dim: BreakdownDimension; geo: string; geoName: string;
}) {
  const [measure, setMeasure] = useState<TrendMeasure>('deaths');
  const latest = latestCompletePeriod(bd, geo, dim);
  const headingId = `dim-${dim.id}`;

  const firstYear = useMemo(() => {
    const pts = dim.categories.map((c) => categoryPoints(bd, geo, dim.id, c.id));
    const i = bd.periods.findIndex((_, k) => pts.some((p) => p[k].value != null));
    return i >= 0 ? bd.periods[i] : null;
  }, [bd, dim, geo]);

  const trendSeries: ChartSeries[] = useMemo(() => {
    const shares = measure === 'share' ? sharePoints(bd, geo, dim) : null;
    return dim.categories.map((c) => ({
      geo: c.id,
      name: c.label,
      color: categoryColor(dim.id, c.id),
      points: shares ? shares[c.id]
        : measure === 'index' ? measureSeries(data.observations, geo, 'index', bd, `${dim.id}.${c.id}`)
          : categoryPoints(bd, geo, dim.id, c.id),
    }));
  }, [bd, data, dim, geo, measure]);

  if (!latest || !firstYear) {
    return (
      <section className="panel" aria-labelledby={headingId}>
        <h2 id={headingId}>By {dim.label.toLowerCase()}</h2>
        <EmptyState>No breakdown by {dim.label.toLowerCase()} is available for {geoName}.</EmptyState>
      </section>
    );
  }
  const rows = categoryRows(bd, geo, dim, latest);
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const lastPeriod = bd.periods[bd.periods.length - 1];
  const unspecified = rows.find((r) => UNSPECIFIED_CATEGORIES.has(`${dim.id}.${r.id}`));
  const euFrom = geo === EU ? euComparableFrom(bd, dim) : null;
  const source = sourceLine([dim.source_id.replace('eurostat:', '')]);

  return (
    <section className="panel" aria-labelledby={headingId}>
      <div className="panel__head">
        <h2 id={headingId}>By {dim.label.toLowerCase()}</h2>
        <button type="button" className="button button--ghost button--small"
          onClick={() => downloadText(breakdownCsv(bd, geo, geoName, dim), `${slug(`road-deaths-by-${dim.label}-${geoName}`)}.csv`)}>
          CSV<span className="visually-hidden"> of deaths by {dim.label.toLowerCase()} in {geoName}</span>
        </button>
      </div>
      <p className="muted">{dim.description}</p>
      {latest < lastPeriod && (
        <Notice tone="warning">The latest year with a complete breakdown for {geoName} is {latest}.</Notice>
      )}
      {euFrom && euFrom > bd.periods[0] && (
        <Notice>
          EU figures start in {euFrom}, the first year in which all 27 Member States reported this breakdown. In
          earlier years Eurostat's EU total counts the deaths of non-reporting countries as “unknown”, so those
          years are not comparable. Country pages show each country's own history.
        </Notice>
      )}
      {unspecified?.share != null && unspecified.share > 10 && (
        <Notice tone="warning">
          {fmtRate(unspecified.share)}% of road deaths in {geoName} in {latest} are recorded as “{unspecified.label.toLowerCase()}”,
          so the other categories may be undercounted.
        </Notice>
      )}

      <div className="breakdown-grid">
        <CategoryBars rows={rows} ordinal={dim.ordinal === true} title={`Road deaths by ${dim.label.toLowerCase()}: ${geoName}`}
          subtitle={`${latest} · ${fmtInt(total)} deaths`} source={source} />
        <div {...scrollArea(`Road deaths by ${dim.label.toLowerCase()}, ${geoName}`)}>
          <table className="data-table">
            <caption className="visually-hidden">Road deaths by {dim.label.toLowerCase()}, {geoName}, {latest} compared with 2019</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">{latest}</th>
                <th scope="col" className="num">Share</th>
                <th scope="col" className="num">2019</th>
                <th scope="col" className="num">Change</th>
                <th scope="col"><span className="visually-hidden">Compare</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <span className="swatch" style={{ background: categoryColor(dim.id, r.id) }} aria-hidden="true" /> {r.label}
                    <span className="row-note">{r.description}</span>
                  </th>
                  <td className="num">{fmtInt(r.value)}{r.status !== 'unknown' && r.status !== 'missing' ? <> <StatusBadge status={r.status} compact /></> : null}</td>
                  <td className="num">{r.share != null ? `${fmtRate(r.share)}%` : 'Not available'}</td>
                  <td className="num">{fmtInt(r.baseline)}</td>
                  <td className="num">{fmtPct(r.changeFromBaseline)}</td>
                  <td>
                    <a href={`#/charts?geo=${geo === EU ? EU : `${EU},${geo}`}&cat=${dim.id}.${r.id}&measure=${geo === EU ? 'deaths' : 'rate'}`}
                      className="small">Compare<span className="visually-hidden"> {r.label.toLowerCase()} across countries</span></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="trend-head">
        <h3>Over time</h3>
        <div className="segmented" role="group" aria-label={`Measure for ${dim.label.toLowerCase()} trend`}>
          {TREND_MEASURES.map((m) => (
            <button key={m.id} type="button" aria-pressed={measure === m.id} onClick={() => setMeasure(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>
      <MultiSeriesChart
        title={`Road deaths by ${dim.label.toLowerCase()}: ${geoName}`}
        subtitle={`${measure === 'share' ? 'Share of road deaths (%)' : measure === 'index' ? 'Index 2019 = 100' : 'Road deaths'}, ${firstYear}–${lastPeriod}`}
        source={source} series={trendSeries} measure={measure} from={firstYear} to={lastPeriod}
      />
    </section>
  );
}

export function RoadUsers({ data, query }: { data: Dataset; query: string }) {
  const bd = data.breakdowns ?? null;
  const countries = useMemo(() => [...data.countries].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const initial = new URLSearchParams(query).get('geo')?.toUpperCase() ?? EU;
  const [geo, setGeo] = useState(initial === EU || countries.some((c) => c.geo === initial) ? initial : EU);
  const geoName = geo === EU ? 'EU total' : countries.find((c) => c.geo === geo)?.name ?? geo;

  useEffect(() => {
    const hash = `#/road-users?geo=${geo}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [geo]);

  return (
    <>
      <section className="panel" aria-labelledby="road-users-heading">
        <div className="panel__head">
          <h2 id="road-users-heading">Who dies on the roads</h2>
          <label className="field field--inline"><span>Geography</span>
            <select value={geo} onChange={(e) => setGeo(e.target.value)}>
              <option value={EU}>EU total</option>
              {countries.map((c) => <option key={c.geo} value={c.geo}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <p>
          Road deaths split five ways: by the role of the person killed (driver, passenger, pedestrian), the mode of
          transport they were using, their age and sex, and the type of road where the crash happened. Each breakdown
          adds up to the total number of road deaths.
        </p>
        {bd && (
          <nav aria-label="Breakdowns" className="small">
            Jump to:{' '}
            {bd.dimensions.map((d, i) => (
              <span key={d.id}>{i > 0 && ' · '}<a href={`#/road-users?geo=${geo}`} onClick={(e) => {
                e.preventDefault();
                document.getElementById(`dim-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}>{d.label}</a></span>
            ))}
          </nav>
        )}
      </section>
      {!bd ? (
        <section className="panel"><EmptyState>Breakdowns could not be loaded. The other pages are not affected.</EmptyState></section>
      ) : (
        <>
          {bd.dimensions.map((dim) => (
            <DimensionSection key={`${dim.id}-${geo}`} data={data} bd={bd} dim={dim} geo={geo} geoName={geoName} />
          ))}
          <section className="panel prose" aria-labelledby="bd-notes">
            <h2 id="bd-notes">About these figures</h2>
            <ul>
              <li><strong>Drivers and riders</strong> include cyclists and motorcyclists, so road-user and mode-of-transport categories overlap by design: they are two ways of splitting the same total.</li>
              <li><strong>Mode of transport</strong> groups Eurostat's 27 vehicle categories into 8. Eurostat's “Other” category contains people not using a vehicle; it matches pedestrian counts in 648 of 656 country-years and is shown as <strong>Pedestrians</strong>.</li>
              <li><strong>Age</strong> uses Eurostat's six age bands. The bands are of different widths (3 to 25 years), so compare them over time or between countries rather than with each other.</li>
              <li><strong>Type of road</strong> follows Eurostat's definitions: urban roads are inside an urban area and rural roads outside it, both excluding motorways; motorways count as motorways wherever they are. Malta did not report this breakdown for 2019, so there is no EU figure by type of road for 2019.</li>
              <li>A year is shown only when every category has a value, so shares always add up to 100%.</li>
              <li>Source: {bd.dimensions.map((d, i) => (
                <span key={d.id}>{i > 0 && ', '}<a href={d.source_url}>Eurostat {d.source_id.replace('eurostat:', '')}</a></span>
              ))}. Full mapping in the <a href="#/methodology">methodology</a>.</li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
