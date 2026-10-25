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

export type BreakdownDimensionId = 'road_user' | 'vehicle' | 'age' | 'sex' | 'road_type';

export interface BreakdownCategory {
  id: string;
  label: string;
  description: string;
  source_categories: string[];
}

export interface BreakdownDimension {
  id: BreakdownDimensionId;
  label: string;
  description: string;
  unit: 'persons';
  source_id: string;
  source_url: string;
  source_published_at: string | null;
  retrieved_at: string;
  categories: BreakdownCategory[];
  /** Categories have a natural order (age bands): charts keep it instead of sorting by size. */
  ordinal?: true;
  /** Per period: Member States with a complete breakdown. EU values are comparable only at 27. */
  eu_members_reporting: number[];
}

export interface BreakdownSeries {
  geo: string;
  dimension: BreakdownDimensionId;
  category: string;
  values: (number | null)[];
  statuses: Status[];
}

/** breakdowns.json: values[i] / statuses[i] refer to periods[i]. */
export interface Breakdowns {
  schema_version: string;
  generated_at: string;
  periods: string[];
  dimensions: BreakdownDimension[];
  series: BreakdownSeries[];
}

export interface Dataset {
  observations: Observation[];
  breakdowns?: Breakdowns | null;
  countries: Country[];
  indicators: Indicator[];
  metadata: Metadata;
  pipelineStatus: PipelineStatus | null;
}

/** legislation.json: EU road safety legal acts and proposals from EUR-Lex metadata. */
export interface RelatedDocument {
  celex: string;
  title: string | null;
  date: string | null;
  url: string;
}

export interface LegalAct {
  celex: string;
  title: string | null;
  type: string;
  type_label: string;
  date_adopted: string | null;
  entry_into_force: string[];
  transposition_deadlines: string[];
  /** As recorded by EUR-Lex; null when the source has no flag. */
  in_force: boolean | null;
  end_of_validity: string | null;
  eli: string | null;
  url: string;
  responsible: string | null;
  inclusion: { basis: 'eurovoc' | 'curated'; reason: string };
  proposal: { celex: string; reference: string | null; date_sent: string | null; url: string } | null;
  amended_by: RelatedDocument[];
  amends: RelatedDocument[];
  repealed_by: RelatedDocument[];
  repeals: RelatedDocument[];
  replaced_by: RelatedDocument[];
  replaces: RelatedDocument[];
  amendment_proposals: string[];
}

export type ProposalStatus = 'adopted' | 'open' | 'closed_without_act';

export interface Proposal {
  celex: string;
  reference: string | null;
  title: string | null;
  type: string | null;
  type_label: string;
  date_sent: string | null;
  status: ProposalStatus;
  /** Set when an "open" status is doubtful (e.g. no decision recorded for many years). */
  status_note: string | null;
  end_of_validity: string | null;
  adopted_by: string[];
  proposes_to_amend: string[];
  indexed_road_safety: boolean;
  url: string;
}

export interface Legislation {
  schema_version: string;
  generated_at: string;
  source: {
    publisher: string;
    endpoint: string;
    selection: string;
    eurovoc: { id: string; label: string };
    curated_additions: { celex: string; reason: string }[];
    retrieved_at: string;
    licence: string;
  };
  summary: {
    acts_total: number;
    acts_in_force: number;
    acts_in_force_by_type: Record<string, number>;
    proposals_open: number;
    proposals_open_unclear: number;
  };
  acts: LegalAct[];
  proposals: Proposal[];
}

/** commitments.json: curated policy commitments with outcomes calculated from official statistics. */
export type CommitmentLevel = 'eu' | 'global' | 'national';
export type CommitmentForm =
  | 'commission_policy' | 'council_conclusions' | 'ministerial_declaration' | 'un_resolution' | 'national_strategy';

export interface CommitmentSource {
  role: 'primary' | 'first_set_out' | 'reaffirmed';
  title: string;
  reference: string;
  publisher: string;
  /** YYYY or YYYY-MM-DD */
  date: string;
  url: string;
  location: string;
  /** Verbatim from the official document. */
  quote: string;
  /** ISO 639-1 language of the quote; absent means English. */
  language?: string;
  /** English translation of a non-English quote: published by the issuer ('official') or made for this site ('own'). */
  translation?: { text: string; kind: 'official' | 'own'; title?: string; url?: string; location?: string };
}

export interface TargetOutcome {
  basis: 'as_stated' | 'commission_monitoring';
  baseline_year: number;
  /** Years averaged to form the baseline (e.g. [2017, 2018, 2019]); absent for a single-year baseline. */
  baseline_average_of?: number[];
  baseline_value: number | null;
  baseline_status: Status | null;
  target_year: number;
  target_value: number | null;
  required_change_pct: number;
  compare_year: number | null;
  compare_value: number | null;
  compare_status: Status | null;
  deadline_passed: boolean;
  change_pct: number | null;
  share_of_required_reduction: number | null;
  above_target_value: boolean | null;
}

export interface CommitmentTarget {
  id: string;
  indicator: 'road_deaths' | 'serious_injuries';
  description: string;
  reduction: number | null;
  baseline_year: number | null;
  /** Years averaged to form the baseline; absent for a single-year baseline. */
  baseline_average_of?: number[];
  target_year: number;
  measure: { geo: string; indicator: string } | null;
  not_measured_reason: string | null;
  scope_note: string | null;
  monitoring_baselines: { year: number; note: string; source: { title: string; publisher: string; url: string } }[];
  outcomes: TargetOutcome[];
  reference: { period: number | null; value: number | null; status: Status | null } | null;
}

export interface Commitment {
  id: string;
  title: string;
  issuer: string;
  level: CommitmentLevel;
  scope: string;
  form: CommitmentForm;
  nature: string;
  date: string;
  /** Country (Eurostat code) of a national strategy; absent for EU and global commitments. */
  geo?: string;
  sources: CommitmentSource[];
  targets: CommitmentTarget[];
}

export interface Commitments {
  schema_version: string;
  generated_at: string;
  reviewed_at: string;
  review_note: string;
  statistics_source: string;
  summary: { commitments: number; targets: number; targets_measured: number };
  commitments: Commitment[];
}
