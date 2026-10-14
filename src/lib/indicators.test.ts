import { benchmarkPath, combineStatus, computeEuKpis, countryRows, missingPeriods, pctChange, series, sortRows } from './indicators';
import { describeSeries } from './summary';
import { makeDataset } from '../test/fixtures';

const d = makeDataset();

describe('KPI calculations', () => {
  const k = computeEuKpis(d.observations, d.metadata.targets);

  it('uses the latest period with data', () => {
    expect(k.fatalities).toMatchObject({ value: 800, period: '2023' });
  });

  it('computes year-over-year change', () => {
    expect(k.yoyAbs.value).toBe(-50);
    expect(k.yoyPct.value).toBeCloseTo((-50 / 850) * 100);
  });

  it('computes change from the 2019 baseline', () => {
    expect(k.baselineChangePct.value).toBeCloseTo(-20);
  });

  it('computes progress towards the 2030 benchmark as share of required reduction', () => {
    expect(k.progress.reductionRequired).toBe(500);
    expect(k.progress.value).toBeCloseTo(200 / 500);
  });

  it('carries the status of the rate observation', () => {
    expect(k.rate).toMatchObject({ value: 40, status: 'provisional' });
  });

  it('returns null rather than zero when the previous year is missing', () => {
    const obs = d.observations.filter((o) => !(o.geo === 'EU27_2020' && o.period === '2022'));
    const k2 = computeEuKpis(obs, d.metadata.targets);
    expect(k2.yoyAbs.value).toBeNull();
    expect(k2.yoyAbs.status).toBe('missing');
  });

  it('returns not-available KPIs for an empty dataset', () => {
    const k3 = computeEuKpis([], []);
    expect(k3.fatalities.value).toBeNull();
    expect(k3.progress.value).toBeNull();
  });
});

describe('helpers', () => {
  it('pctChange handles missing and zero baselines', () => {
    expect(pctChange(5, 10)).toBe(-50);
    expect(pctChange(null, 10)).toBeNull();
    expect(pctChange(5, 0)).toBeNull();
  });

  it('combineStatus picks the most cautious status', () => {
    expect(combineStatus('unknown', 'provisional')).toBe('provisional');
    expect(combineStatus('final', 'unknown')).toBe('unknown');
  });

  it('benchmarkPath is linear from baseline to target', () => {
    const p = benchmarkPath(d.metadata.targets[0]);
    expect(p.get('2019')).toBe(1000);
    expect(p.get('2030')).toBe(500);
    expect(p.get('2024')).toBeCloseTo(1000 - (5 / 11) * 500);
  });

  it('missingPeriods lists interior gaps only', () => {
    expect(missingPeriods(series(d.observations, 'EU27_2020', 'road_fatalities'))).toEqual(['2021']);
  });

  it('describeSeries mentions gaps and provisional values', () => {
    const text = describeSeries(series(d.observations, 'EU27_2020', 'road_fatalities_per_million'), 'Rate', String);
    expect(text).toContain('Rate went from 42.5 in 2022 to 40 in 2023');
    expect(text).toContain('provisional or estimated');
    expect(describeSeries([], 'X', String)).toContain('No data');
  });
});

describe('country rows and sorting', () => {
  const rows = countryRows(d.observations, d.countries, '2019');

  it('uses each country’s own latest year', () => {
    const mt = rows.find((r) => r.geo === 'MT')!;
    expect(mt.period).toBe('2022');
    expect(mt.fatalities).toBe(12);
    expect(mt.rate).toBeNull();
  });

  it('sorts by rate descending with missing values last', () => {
    expect(sortRows(rows, 'rate', 'desc').map((r) => r.geo)).toEqual(['BE', 'NL', 'MT']);
    expect(sortRows(rows, 'rate', 'asc').map((r) => r.geo)).toEqual(['NL', 'BE', 'MT']);
  });

  it('sorts by deaths and percentage change', () => {
    expect(sortRows(rows, 'fatalities', 'desc').map((r) => r.geo)).toEqual(['BE', 'NL', 'MT']);
    expect(sortRows(rows, 'baselinePct', 'asc')[0].geo).toBe('NL'); // -20%
  });
});
