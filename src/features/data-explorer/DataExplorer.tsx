import { useMemo, useState } from 'react';
import type { Dataset, IndicatorId, Status } from '../../types/data';
import { downloadCsv } from '../../lib/csv';
import { fmtInt, fmtRate, STATUS_LABEL } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

const PAGE_SIZE = 50;

export function DataExplorer({ data }: { data: Dataset }) {
  const periods = useMemo(() => [...new Set(data.observations.map((o) => o.period))].sort(), [data]);
  const geos = useMemo(() => {
    const seen = new Map<string, string>();
    data.observations.forEach((o) => seen.set(o.geo, o.geo_name));
    return [...seen.entries()];
  }, [data]);
  const [geo, setGeo] = useState('all');
  const [indicator, setIndicator] = useState<IndicatorId | 'all'>('road_fatalities');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [from, setFrom] = useState(periods[0] ?? '');
  const [to, setTo] = useState(periods[periods.length - 1] ?? '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.observations.filter((o) =>
      (geo === 'all' || o.geo === geo)
      && (indicator === 'all' || o.indicator === indicator)
      && (status === 'all' || o.status === status)
      && o.period >= from && o.period <= to
      && (!q || o.geo_name.toLowerCase().includes(q) || o.geo.toLowerCase() === q || o.period.includes(q)));
  }, [data, geo, indicator, status, from, to, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <section className="panel" aria-labelledby="explorer-heading">
      <h2 id="explorer-heading">Data explorer</h2>
      <p>
        All observations used by this dashboard, with their status and source. Missing values are listed explicitly.
        The CSV export contains exactly the rows matching the current filters. See the{' '}
        <a href="#/methodology">methodology</a> for definitions.
      </p>
      <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter observations">
        <label className="field"><span>Search</span>
          <input type="search" value={query} placeholder="Country or year" onChange={(e) => reset(setQuery)(e.target.value)} />
        </label>
        <label className="field"><span>Geography</span>
          <select value={geo} onChange={(e) => reset(setGeo)(e.target.value)}>
            <option value="all">All</option>
            {geos.map(([g, n]) => <option key={g} value={g}>{n}</option>)}
          </select>
        </label>
        <label className="field"><span>Indicator</span>
          <select value={indicator} onChange={(e) => reset(setIndicator)(e.target.value as IndicatorId | 'all')}>
            <option value="all">All</option>
            {data.indicators.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select value={status} onChange={(e) => reset(setStatus)(e.target.value as Status | 'all')}>
            <option value="all">All</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field"><span>From</span>
          <select value={from} onChange={(e) => reset(setFrom)(e.target.value)}>
            {periods.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field"><span>To</span>
          <select value={to} onChange={(e) => reset(setTo)(e.target.value)}>
            {periods.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </form>
      <div className="explorer-bar">
        <p aria-live="polite">{filtered.length.toLocaleString('en-GB')} observation(s)</p>
        <button type="button" className="button" disabled={!filtered.length}
          onClick={() => downloadCsv(filtered, `eu-road-safety-observations-${new Date().toISOString().slice(0, 10)}.csv`)}>
          Download CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="state state--empty">No observations match these filters.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Filtered observations</caption>
            <thead>
              <tr>
                <th scope="col">Geography</th><th scope="col">Year</th><th scope="col">Indicator</th>
                <th scope="col" className="num">Value</th><th scope="col">Unit</th><th scope="col">Status</th><th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={`${o.geo}-${o.indicator}-${o.period}`}>
                  <th scope="row">{o.geo_name} <span className="muted">({o.geo})</span></th>
                  <td>{o.period}</td>
                  <td>{data.indicators.find((i) => i.id === o.indicator)?.name ?? o.indicator}</td>
                  <td className="num">{o.indicator === 'road_fatalities_per_million' ? fmtRate(o.value) : fmtInt(o.value)}</td>
                  <td>{o.unit}</td>
                  <td><StatusBadge status={o.status} flag={o.source_flag} compact /></td>
                  <td><a href={o.source_url}>{o.source_id.replace('eurostat:', 'Eurostat ').replace('derived:', 'Derived: ')}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button type="button" className="button button--ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
          <span>Page {current + 1} of {pages}</span>
          <button type="button" className="button button--ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}
