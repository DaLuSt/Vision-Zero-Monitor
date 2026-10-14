export type Status = 'final' | 'provisional' | 'estimated' | 'missing' | 'unknown';
export type IndicatorId = 'road_fatalities' | 'population_average' | 'road_fatalities_per_million';

export interface Observation {
  geo: string;
  geo_name: string;
  indicator: IndicatorId;
  period: string;
  frequency: 'annual';
  value: number | null;
  unit: string;
  status: Status;
  source_flag: string | null;
  status_note?: string;
  source_id: string;
  source_url: string;
  source_published_at: string | null;
  retrieved_at: string;
}

export interface Country {
  geo: string;
  iso2: string;
  name: string;
  eu_member: boolean;
}

export interface Indicator {
  id: IndicatorId;
  name: string;
  description: string;
  unit: string;
  value_type: 'count' | 'rate';
  source_id: string;
  derivation: string;
}

export interface Source {
  id: string;
  publisher: string;
  title: string;
  dataset: string | null;
  role: 'primary' | 'denominator' | 'cross_check' | 'derived';
  url: string;
  api_url: string | null;
  metadata_url: string | null;
  source_published_at: string | null;
  retrieved_at: string;
  latest_period_in_source: string | null;
  status_flag_labels: Record<string, string>;
  license: string;
}

export interface Target {
  id: string;
  name: string;
  geo: string;
  indicator: IndicatorId;
  baseline_period: string;
  target_period: string;
  reduction_fraction: number;
  baseline_value: number | null;
  baseline_status: Status;
  target_value: number | null;
  policy_reference: string;
  policy_url: string;
  note: string;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface Metadata {
  schema_version: string;
  generated_at: string;
  content_hash: string;
  frequency_notice: string;
  status_vocabulary?: Record<string, string>;
  sources: Source[];
  targets: Target[];
  coverage: { period: string | null; member_states_reporting: number; member_states_total: number; missing: string[] };
  validation: { passed: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
  revisions: { compared_with: string | null; changed: number; added: number; removed: number };
}

export interface PipelineStatus {
  schema_version: string;
  last_attempt_at: string;
  last_outcome: 'success' | 'unchanged' | 'failure';
  last_success_at: string | null;
  message: string;
  run_url?: string | null;
}

export interface Dataset {
  observations: Observation[];
  countries: Country[];
  indicators: Indicator[];
  metadata: Metadata;
  pipelineStatus: PipelineStatus | null;
}
