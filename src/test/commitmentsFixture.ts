/**
 * SYNTHETIC commitments for frontend unit tests only. Shaped like public/data/commitments.json;
 * texts and numbers are simplified and must never be used as production data.
 */
import type { Commitment, Commitments, CommitmentTarget, TargetOutcome } from '../types/data';

function outcome(o: Partial<TargetOutcome>): TargetOutcome {
  return {
    basis: 'as_stated', baseline_year: 2019, baseline_value: 1000, baseline_status: 'unknown', target_year: 2030,
    target_value: 500, required_change_pct: -50, compare_year: 2023, compare_value: 800, compare_status: 'unknown',
    deadline_passed: false, change_pct: -20, share_of_required_reduction: 0.4, above_target_value: true, ...o,
  };
}

function target(t: Partial<CommitmentTarget>): CommitmentTarget {
  return {
    id: 'deaths', indicator: 'road_deaths', description: 'Road deaths −50 %', reduction: 0.5, baseline_year: 2019,
    target_year: 2030, measure: { geo: 'EU27_2020', indicator: 'road_fatalities' }, not_measured_reason: null,
    scope_note: null, monitoring_baselines: [], outcomes: [], reference: null, ...t,
  };
}

function commitment(c: Partial<Commitment>): Commitment {
  return {
    id: 'x', title: 'A commitment', issuer: 'European Commission', level: 'eu', scope: 'European Union',
    form: 'commission_policy', nature: 'Policy objective. Not legally binding.', date: '2019',
    sources: [{
      role: 'primary', title: 'Policy framework', reference: 'SWD(2019) 283 final', publisher: 'European Commission',
      date: '2019', url: 'https://op.europa.eu/en/publication-detail/-/publication/test', location: 'Section 3.2, p. 11',
      quote: 'reducing the number of road deaths by 50% between 2019 and 2030',
    }],
    targets: [], ...c,
  };
}

export function makeCommitments(): Commitments {
  return {
    schema_version: '1.0.0',
    generated_at: '2026-10-15T06:00:00Z',
    reviewed_at: '2026-10-15',
    review_note: 'Every quote was checked word for word against the official document on the review date.',
    statistics_source: 'Eurostat tran_sf_roadus',
    summary: { commitments: 3, targets: 4, targets_measured: 2 },
    commitments: [
      commitment({
        id: 'eu-2030', title: 'Halve road deaths and serious injuries by 2030',
        targets: [
          target({
            outcomes: [
              outcome({}),
              outcome({ basis: 'commission_monitoring', baseline_year: 2018, baseline_value: 1100, target_value: 550,
                change_pct: -27.3, share_of_required_reduction: 0.545 }),
            ],
            monitoring_baselines: [{ year: 2018, note: 'The Commission measures this target against 2018.',
              source: { title: 'Statistics', publisher: 'European Commission', url: 'https://transport.ec.europa.eu/x' } }],
          }),
          target({ id: 'si', indicator: 'serious_injuries', description: 'Serious injuries −50 %', measure: null,
            not_measured_reason: 'Comparable serious-injury figures are not yet included.' }),
        ],
      }),
      commitment({
        id: 'eu-2020', title: 'Halve road deaths between 2010 and 2020', date: '2010-07-20',
        sources: [{
          role: 'primary', title: 'Policy orientations', reference: 'COM(2010) 389 final', publisher: 'European Commission',
          date: '2010-07-20', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52010DC0389',
          location: 'Section 3.2', quote: 'halving the overall number of road deaths in the European Union by 2020 starting from 2010.',
        }],
        targets: [target({
          baseline_year: 2018, target_year: 2020,
          scope_note: 'Set for the EU as it was in 2010.',
          outcomes: [outcome({ baseline_year: 2018, baseline_value: 1100, target_year: 2020, target_value: 550,
            compare_year: 2020, compare_value: 900, deadline_passed: true, change_pct: -18.2, above_target_value: true })],
        })],
      }),
      commitment({
        id: 'un', title: 'Second Decade of Action for Road Safety', level: 'global', scope: 'World',
        issuer: 'United Nations General Assembly', form: 'un_resolution', date: '2020-08-31',
        nature: 'UN General Assembly resolution. Not legally binding.',
        targets: [target({ measure: null, baseline_year: 2021, not_measured_reason: 'A global goal; this dashboard covers the EU only.' })],
      }),
    ],
  };
}
