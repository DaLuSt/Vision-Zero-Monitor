import { useMemo } from 'react';
import type { Dataset } from '../../types/data';
import { countryRows, latestPoint, missingPeriods, pointAt, series } from '../../lib/indicators';
import { fmtDate, fmtInt, fmtPct, fmtRate } from '../../lib/format';
import { SeriesChart } from '../trends/SeriesChart';
import { EmptyState } from '../../components/States';

export function CountryDetail({ data, geo }: { data: Dataset; geo: string }) {
  const country = data.countries.find((c) => c.geo === geo);
  const baseline = data.metadata.targets[0]?.baseline_period ?? '2019';
  const counts = useMemo(() => series(data.observations, geo, 'road_fatalities'), [data, geo]);
  const rates = useMemo(() => series(data.observations, geo, 'road_fatalities_per_million'), [data, geo]);

  const select = (
    <label className="field">
      <span>Member State</span>
      <select value={country ? geo : ''} onChange={(e) => { window.location.hash = `#/countries/${e.target.value}`; }}>
        {!country && <option value="">Select a country…</option>}
        {[...data.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
          <option key={c.geo} value={c.geo}>{c.name}</option>
        ))}
      </select>
    </label>
  );

  if (!country) {
    return (
      <section className="panel">
        <h2>Country not found</h2>
        <EmptyState>“{geo}” is not an EU Member State code used by this dashboard.</EmptyState>
        {select}
      </section>
    );
  }

  const row = countryRows(data.observations, [country], baseline)[0];
  const latest = latestPoint(counts);
  const base = pointAt(counts, baseline);
  const gaps = missingPeriods(counts);
  const primary = data.metadata.sources.find((s) => s.role === 'primary');
  const popSource = data.metadata.sources.find((s) => s.role === 'denominator');
  const firstYear = counts.find((p) => p.value != null)?.period;

  return (
    <>
      <section className="panel" aria-labelledby="country-heading">
        <p className="breadcrumb"><a href="#/countries">Countries</a> / {country.name}</p>
        <div className="panel__head">
          <h2 id="country-heading">{country.name}</h2>
          {select}
        </div>
        <dl className="facts facts--wide">
          <div><dt>Deaths ({row.period ?? 'n/a'})</dt><dd>{fmtInt(row.fatalities)}</dd></div>
          <div><dt>Per million inhabitants</dt><dd>{fmtRate(row.rate)}</dd></div>
          <div><dt>Change on previous year</dt><dd>{fmtPct(row.yoyPct)}</dd></div>
          <div>
            <dt>Change since {baseline}</dt>
            <dd>{fmtPct(row.baselinePct)}{base?.value != null ? ` (from ${fmtInt(base.value)})` : ''}</dd>
          </div>
        </dl>
        <p>
          <a href={`#/charts?geo=EU27_2020,${geo}&measure=rate`}>Compare {country.name} with the EU total in the chart builder</a>
        </p>
        {latest && base?.value != null && (
          <p className="small muted">
            A 50% reduction from {baseline} would correspond to {fmtInt(base.value * 0.5)} deaths in 2030. National
            targets may differ; this is shown only for comparison with the EU-wide benchmark.
          </p>
        )}
      </section>
      <section className="panel">
        <SeriesChart title={`Road deaths, ${country.name}`} subject={`Road deaths in ${country.name}`} points={counts}
          unitLabel="deaths" format={fmtInt} baselinePeriod={baseline} height={280} />
      </section>
      <section className="panel">
        <SeriesChart title={`Road deaths per million inhabitants, ${country.name}`}
          subject={`Road deaths per million inhabitants in ${country.name}`} points={rates}
          unitLabel="per million" format={fmtRate} baselinePeriod={baseline} height={280} />
      </section>
      <section className="panel" aria-labelledby="availability-heading">
        <h2 id="availability-heading">Data availability and sources</h2>
        <ul>
          <li>Years with data: {firstYear ? `${firstYear}–${latest?.period}` : 'none'}{gaps.length ? `; gaps in ${gaps.join(', ')}` : '; no gaps'}.</li>
          <li>Death counts: <a href={primary?.url}>Eurostat {primary?.dataset}</a> (CARE database, DG MOVE), last updated {fmtDate(primary?.source_published_at)}.</li>
          <li>Population: <a href={popSource?.url}>Eurostat {popSource?.dataset}</a> (average population), last updated {fmtDate(popSource?.source_published_at)}.</li>
          <li>Full status per year is listed in the data tables under each chart and in the <a href="#/explorer">data explorer</a>.</li>
        </ul>
      </section>
    </>
  );
}
