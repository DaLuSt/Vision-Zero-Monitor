/**
 * SYNTHETIC test fixtures for frontend unit tests only.
 * Values are invented and must never be used as, or copied into, production data.
 */
import type { Dataset, Observation, Status, IndicatorId } from '../types/data';

const SRC = 'https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table';

export function obs(geo: string, indicator: IndicatorId, period: string, value: number | null, status: Status = value == null ? 'missing' : 'unknown', flag: string | null = null): Observation {
  return {
    geo, geo_name: { EU27_2020: 'European Union', NL: 'Netherlands', BE: 'Belgium', MT: 'Malta' }[geo] ?? geo,
    indicator, period, frequency: 'annual', value,
    unit: indicator === 'road_fatalities_per_million' ? 'per million inhabitants' : 'persons',
    status, source_flag: flag, source_id: indicator === 'road_fatalities_per_million' ? 'derived:road_fatalities_per_million' : 'eurostat:tran_sf_roadus',
    source_url: SRC, source_published_at: '2026-08-25T21:00:00Z', retrieved_at: '2026-10-14T06:00:00Z',
  };
}

export function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  const observations: Observation[] = [
    obs('EU27_2020', 'road_fatalities', '2018', 1100),
    obs('EU27_2020', 'road_fatalities', '2019', 1000),
    obs('EU27_2020', 'road_fatalities', '2020', 900),
    obs('EU27_2020', 'road_fatalities', '2021', null),
    obs('EU27_2020', 'road_fatalities', '2022', 850),
    obs('EU27_2020', 'road_fatalities', '2023', 800),
    obs('EU27_2020', 'road_fatalities_per_million', '2022', 42.5),
    obs('EU27_2020', 'road_fatalities_per_million', '2023', 40, 'provisional', 'p'),
    obs('NL', 'road_fatalities', '2019', 100),
    obs('NL', 'road_fatalities', '2020', null),
    obs('NL', 'road_fatalities', '2021', null),
    obs('NL', 'road_fatalities', '2022', 90),
    obs('NL', 'road_fatalities', '2023', 80),
    obs('NL', 'road_fatalities_per_million', '2023', 30),
    obs('BE', 'road_fatalities', '2019', 200),
    obs('BE', 'road_fatalities', '2022', 220),
    obs('BE', 'road_fatalities', '2023', 210),
    obs('BE', 'road_fatalities_per_million', '2023', 50),
    obs('MT', 'road_fatalities', '2019', 10),
    obs('MT', 'road_fatalities', '2022', 12),
    obs('MT', 'road_fatalities', '2023', null),
  ];
  return {
    observations,
    countries: [
      { geo: 'BE', iso2: 'BE', name: 'Belgium', eu_member: true },
      { geo: 'MT', iso2: 'MT', name: 'Malta', eu_member: true },
      { geo: 'NL', iso2: 'NL', name: 'Netherlands', eu_member: true },
    ],
    indicators: [
      { id: 'road_fatalities', name: 'Road fatalities', description: '', unit: 'persons', value_type: 'count', source_id: 'eurostat:tran_sf_roadus', derivation: '' },
      { id: 'road_fatalities_per_million', name: 'Road fatalities per million inhabitants', description: '', unit: 'per million inhabitants', value_type: 'rate', source_id: 'derived', derivation: '' },
    ],
    metadata: {
      schema_version: '1.0.0', generated_at: '2026-10-14T06:00:00Z', content_hash: 'sha256:test',
      frequency_notice: 'Official fatality statistics are published periodically. This dashboard checks for updated data weekly; the underlying figures are not necessarily weekly.',
      sources: [{
        id: 'eurostat:tran_sf_roadus', publisher: 'Eurostat', title: 'Persons killed in road accidents', dataset: 'tran_sf_roadus',
        role: 'primary', url: SRC, api_url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus',
        metadata_url: 'https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm',
        source_published_at: '2026-08-25T21:00:00Z', retrieved_at: '2026-10-14T06:00:00Z', latest_period_in_source: '2023',
        status_flag_labels: {}, license: 'Eurostat reuse policy',
      }],
      targets: [{
        id: 'eu_2030', name: 'EU 2030', geo: 'EU27_2020', indicator: 'road_fatalities', baseline_period: '2019',
        target_period: '2030', reduction_fraction: 0.5, baseline_value: 1000, baseline_status: 'unknown', target_value: 500,
        policy_reference: '', policy_url: '', note: 'Deaths only.',
      }],
      coverage: { period: '2023', member_states_reporting: 2, member_states_total: 27, missing: ['MT'] },
      validation: { passed: true, errors: [], warnings: [{ level: 'warning', code: 'coverage', message: '2023: no data for MT' }] },
      revisions: { compared_with: null, changed: 0, added: 0, removed: 0 },
    },
    pipelineStatus: {
      schema_version: '1.0.0', last_attempt_at: '2026-10-14T06:00:00Z', last_outcome: 'success',
      last_success_at: '2026-10-14T06:00:00Z', message: 'ok', run_url: null,
    },
    ...overrides,
  };
}
