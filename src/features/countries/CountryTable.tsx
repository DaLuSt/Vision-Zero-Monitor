import { useMemo, useState } from 'react';
import type { Dataset } from '../../types/data';
import { countryRows, sortRows, type SortDir, type SortKey } from '../../lib/indicators';
import { fmtInt, fmtPct, fmtRate } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import { Notice } from '../../components/States';
import { scrollArea } from '../../lib/scrollArea';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Country', numeric: false },
  { key: 'fatalities', label: 'Deaths', numeric: true },
  { key: 'rate', label: 'Per million inhabitants', numeric: true },
  { key: 'yoyPct', label: 'Change on previous year', numeric: true },
  { key: 'baselinePct', label: 'Change since 2019', numeric: true },
  { key: 'period', label: 'Reference year', numeric: false },
];

export function CountryTable({ data }: { data: Dataset }) {
  const baseline = data.metadata.targets[0]?.baseline_period ?? '2019';
  const rows = useMemo(() => countryRows(data.observations, data.countries, baseline), [data, baseline]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'rate', dir: 'desc' });
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  const periods = new Set(rows.map((r) => r.period).filter(Boolean));
  const missing = rows.filter((r) => r.fatalities == null);
  const qualified = rows.filter((r) => r.rateStatus === 'provisional' || r.rateStatus === 'estimated');

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  return (
    <section className="panel" aria-labelledby="countries-heading">
      <h2 id="countries-heading">Member State comparison</h2>
      <p>
        Latest available year per country. Rates per million inhabitants are the fairest basis for comparison between
        countries of different size. Select a column heading to sort; select a country for its full history.
      </p>
      {periods.size > 1 && (
        <Notice tone="warning">
          Countries are shown for different reference years ({[...periods].sort().join(', ')}). Compare with care.
        </Notice>
      )}
      {missing.length > 0 && (
        <Notice tone="warning">No data available for: {missing.map((r) => r.name).join(', ')}.</Notice>
      )}
      {qualified.length > 0 && (
        <p className="small muted">
          {qualified.length} rate(s) are based on population figures that Eurostat flags as provisional or estimated
          (marked ◇).
        </p>
      )}
      <div {...scrollArea('Road deaths by EU Member State')}>
        <table className="data-table">
          <caption className="visually-hidden">
            Road deaths by EU Member State, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label} ({sort.dir === 'asc' ? 'ascending' : 'descending'})
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="sort-button" onClick={() => toggle(c.key)}>
                    {c.label}
                    <span aria-hidden="true" className="sort-indicator">
                      {sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.geo}>
                <th scope="row"><a href={`#/countries/${r.geo}`}>{r.name}</a></th>
                <td className="num">{fmtInt(r.fatalities)}</td>
                <td className="num">{fmtRate(r.rate)}{r.rateStatus === 'provisional' || r.rateStatus === 'estimated' ? ' ◇' : ''}</td>
                <td className="num">{fmtPct(r.yoyPct)}</td>
                <td className="num">{fmtPct(r.baselinePct)}</td>
                <td>{r.period ?? 'Not available'}</td>
                <td><StatusBadge status={r.status} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
