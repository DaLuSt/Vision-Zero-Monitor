import {
  assignSlots, builderQuery, chartCsv, measureSeries, niceCeil, parseBuilderParams, wideRows,
} from './chartData';
import { yearRanges } from './summary';
import { parseHash } from './router';
import { makeDataset, obs } from '../test/fixtures';

const d = makeDataset();
const periods = ['2018', '2019', '2020', '2021', '2022', '2023'];
const geos = ['EU27_2020', 'BE', 'MT', 'NL'];

describe('measureSeries', () => {
  it('returns deaths and rates as published', () => {
    expect(measureSeries(d.observations, 'NL', 'deaths').map((p) => p.value)).toEqual([100, null, null, 90, 80]);
    expect(measureSeries(d.observations, 'EU27_2020', 'rate').at(-1)).toMatchObject({ value: 40, status: 'provisional' });
  });

  it('indexes deaths to 2019 = 100 and keeps gaps as gaps', () => {
    const idx = measureSeries(d.observations, 'EU27_2020', 'index');
    expect(idx.find((p) => p.period === '2019')?.value).toBe(100);
    expect(idx.find((p) => p.period === '2023')?.value).toBeCloseTo(80);
    expect(idx.find((p) => p.period === '2021')).toMatchObject({ value: null, status: 'missing' });
  });

  it('marks the whole index missing when the 2019 base is missing', () => {
    const o = [obs('BE', 'road_fatalities', '2019', null), obs('BE', 'road_fatalities', '2020', 50)];
    expect(measureSeries(o, 'BE', 'index').every((p) => p.value === null && p.status === 'missing')).toBe(true);
  });

  it('carries the base year status into the index', () => {
    const o = [obs('BE', 'road_fatalities', '2019', 100, 'provisional', 'p'), obs('BE', 'road_fatalities', '2020', 50)];
    expect(measureSeries(o, 'BE', 'index')[1]).toMatchObject({ value: 50, status: 'provisional' });
  });
});

describe('measureSeries for a breakdown category', () => {
  const bd = d.breakdowns!;
  it('uses category deaths, computes rates from average population and indexes to 2019', () => {
    expect(measureSeries(d.observations, 'NL', 'deaths', bd, 'vehicle.CYCLE').map((p) => p.value)).toEqual([null, 40, null, null, 40, 36]);
    const rate = measureSeries(d.observations, 'NL', 'rate', bd, 'vehicle.CYCLE');
    expect(rate.find((p) => p.period === '2022')?.value).toBeCloseTo(2.3, 1); // 40 / 17.7m × 1e6
    expect(rate.find((p) => p.period === '2023')).toMatchObject({ value: 2, status: 'provisional' }); // population flagged
    expect(measureSeries(d.observations, 'NL', 'index', bd, 'vehicle.CYCLE').at(-1)?.value).toBeCloseTo(90);
  });
  it('falls back to all road deaths for an unknown category', () => {
    expect(measureSeries(d.observations, 'NL', 'deaths', bd, 'vehicle.TANK').map((p) => p.value)).toEqual([100, null, null, 90, 80]);
  });
});

describe('wideRows', () => {
  it('produces one row per year in range with null for missing values', () => {
    const rows = wideRows([{ geo: 'NL', points: measureSeries(d.observations, 'NL', 'deaths') }], '2019', '2022');
    expect(rows.map((r) => r.period)).toEqual(['2019', '2020', '2021', '2022']);
    expect(rows[1]).toMatchObject({ NL: null, NL__status: 'missing' });
    expect(rows[3]).toMatchObject({ NL: 90 });
  });
});

describe('assignSlots', () => {
  it('keeps colours with their geography when others are removed or added', () => {
    const a = assignSlots(['EU27_2020', 'BE', 'NL'], {});
    expect(a).toEqual({ EU27_2020: 0, BE: 1, NL: 2 });
    const b = assignSlots(['EU27_2020', 'NL'], a);
    expect(b).toEqual({ EU27_2020: 0, NL: 2 });
    const c = assignSlots(['EU27_2020', 'MT', 'NL'], b);
    expect(c).toEqual({ EU27_2020: 0, NL: 2, MT: 1 }); // reuses the freed slot
  });
});

describe('URL state', () => {
  it('parses a shared link', () => {
    expect(parseBuilderParams('geo=EU27_2020,nl&measure=rate&layout=separate&from=2019&to=2022', geos, periods))
      .toEqual({ geos: ['EU27_2020', 'NL'], cat: null, measure: 'rate', layout: 'separate', from: '2019', to: '2022' });
  });

  it('defaults to the EU total over all years', () => {
    expect(parseBuilderParams('', geos, periods)).toEqual({ geos: ['EU27_2020'], cat: null, measure: 'deaths', layout: 'combined', from: '2018', to: '2023' });
  });

  it('drops unknown codes and values, and swaps a reversed range', () => {
    const s = parseBuilderParams('geo=XX,BE,<script>&measure=evil&layout=x&from=2022&to=2019', geos, periods);
    expect(s).toEqual({ geos: ['BE'], cat: null, measure: 'deaths', layout: 'combined', from: '2019', to: '2022' });
  });

  it('accepts only known breakdown categories', () => {
    expect(parseBuilderParams('cat=vehicle.CYCLE', geos, periods, ['vehicle.CYCLE']).cat).toBe('vehicle.CYCLE');
    expect(parseBuilderParams('cat=vehicle.TANK', geos, periods, ['vehicle.CYCLE']).cat).toBeNull();
  });

  it('keeps an explicitly empty selection empty', () => {
    expect(parseBuilderParams('geo=', geos, periods).geos).toEqual([]);
  });

  it('round-trips through the query string', () => {
    const s = { geos: ['EU27_2020', 'NL'], cat: 'vehicle.CYCLE', measure: 'index' as const, layout: 'separate' as const, from: '2019', to: '2023' };
    expect(builderQuery(s)).toBe('geo=EU27_2020,NL&cat=vehicle.CYCLE&measure=index&layout=separate&from=2019&to=2023');
    expect(parseBuilderParams(builderQuery(s), geos, periods, ['vehicle.CYCLE'])).toEqual(s);
    expect(parseHash(`#/charts?${builderQuery(s)}`)).toEqual({ page: 'charts', query: builderQuery(s) });
  });
});

describe('chartCsv', () => {
  it('exports exactly the plotted points with status, leaving gaps empty', () => {
    const csv = chartCsv([{ geo: 'NL', name: 'Netherlands', points: measureSeries(d.observations, 'NL', 'index') }], 'index');
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('geo,geo_name,period,measure,value,status');
    expect(lines).toContain('NL,Netherlands,2019,index,100,unknown');
    expect(lines).toContain('NL,Netherlands,2020,index,,missing');
    expect(lines).toContain('NL,Netherlands,2023,index,80,unknown');
  });
});

describe('helpers', () => {
  it('niceCeil rounds up to a tidy axis maximum', () => {
    expect(niceCeil(152)).toBe(200);
    expect(niceCeil(110)).toBe(200);
    expect(niceCeil(48)).toBe(50);
    expect(niceCeil(22)).toBe(25);
    expect(niceCeil(0)).toBe(0);
  });

  it('yearRanges collapses consecutive years', () => {
    expect(yearRanges(['2013', '2014', '2015', '2018', '2020', '2021'])).toBe('2013–2015, 2018, 2020–2021');
    expect(yearRanges([])).toBe('');
  });
});
