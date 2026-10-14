import {
  breakdownCsv, categoryColor, categoryPoints, categoryRows, euComparableFrom, latestCompletePeriod, parseCategoryKey,
  perMillion, sharePoints,
} from './breakdowns';
import { makeBreakdowns, makeDataset } from '../test/fixtures';

const bd = makeBreakdowns();
const roadUser = bd.dimensions[0];
const vehicle = bd.dimensions[1];

describe('breakdown helpers', () => {
  it('withholds EU values for years with incomplete Member State coverage', () => {
    const eu = categoryPoints(bd, 'EU27_2020', 'road_user', 'UNK');
    expect(eu[0]).toMatchObject({ period: '2018', value: null, status: 'missing' }); // 26 of 27 reported
    expect(eu[1]).toMatchObject({ period: '2019', value: 10 });
    expect(euComparableFrom(bd, roadUser)).toBe('2019');
  });

  it('keeps country values regardless of EU coverage', () => {
    expect(categoryPoints(bd, 'NL', 'vehicle', 'CYCLE').map((p) => p.value)).toEqual([null, 40, null, null, 40, 36]);
  });

  it('finds the latest year in which every category has a value', () => {
    expect(latestCompletePeriod(bd, 'NL', vehicle)).toBe('2023');
    expect(latestCompletePeriod(bd, 'MT', vehicle)).toBe('2022');
    expect(latestCompletePeriod(bd, 'BE', vehicle)).toBeNull();
  });

  it('computes shares that add up to 100 % and leave incomplete years empty', () => {
    const shares = sharePoints(bd, 'NL', vehicle);
    const y2023 = vehicle.categories.map((c) => shares[c.id][5].value!);
    expect(y2023.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(shares.CYCLE[5].value).toBeCloseTo((36 / 80) * 100);
    expect(shares.CYCLE[2].value).toBeNull();
  });

  it('builds rows with share and change since 2019', () => {
    const rows = categoryRows(bd, 'NL', vehicle, '2023');
    expect(rows.find((r) => r.id === 'CYCLE')).toMatchObject({ value: 36, baseline: 40 });
    expect(rows.find((r) => r.id === 'CYCLE')?.changeFromBaseline).toBeCloseTo(-10);
    expect(rows.find((r) => r.id === 'CAR')?.share).toBeCloseTo(37.5);
  });

  it('computes per-million rates with the population status', () => {
    const d = makeDataset();
    const rate = perMillion(categoryPoints(bd, 'NL', 'vehicle', 'CYCLE'), d.observations, 'NL');
    expect(rate[4].value).toBeCloseTo(2.3, 1);
    expect(rate[5].status).toBe('provisional');
    expect(rate[1]).toMatchObject({ value: null, status: 'missing' }); // no population for 2019 in the fixture
  });

  it('parses category keys and assigns fixed colours', () => {
    expect(parseCategoryKey('vehicle.CYCLE', bd)?.category.label).toBe('Cyclists');
    expect(parseCategoryKey('vehicle.NOPE', bd)).toBeNull();
    expect(parseCategoryKey(null, bd)).toBeNull();
    expect(categoryColor('road_user', 'PED')).toBe(categoryColor('vehicle', 'PED')); // same entity, same colour
    expect(categoryColor('vehicle', 'OTHER')).toBe('var(--cat-neutral)');
  });

  it('exports published values with EU coverage for transparency', () => {
    const csv = breakdownCsv(bd, 'EU27_2020', 'EU total', roadUser).trim().split('\r\n');
    expect(csv[0]).toBe('geo,geo_name,dimension,category,category_label,period,value,status,eu_members_reporting,source_id');
    expect(csv).toContain('EU27_2020,EU total,road_user,UNK,Unknown,2018,100,unknown,26,eurostat:tran_sf_roadus');
    expect(csv).toContain('EU27_2020,EU total,road_user,UNK,Unknown,2021,,missing,27,eurostat:tran_sf_roadus');
  });
});
