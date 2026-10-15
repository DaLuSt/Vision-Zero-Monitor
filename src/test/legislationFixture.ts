/**
 * SYNTHETIC legislation register for frontend unit tests only.
 * Shaped like public/data/legislation.json; dates and links are simplified and must never be used as production data.
 */
import type { LegalAct, Legislation, Proposal } from '../types/data';

const url = (celex: string) => `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;

function act(celex: string, title: string, overrides: Partial<LegalAct> = {}): LegalAct {
  return {
    celex, title, type: 'DIR', type_label: 'Directive', date_adopted: null, entry_into_force: [],
    transposition_deadlines: [], in_force: true, end_of_validity: null, eli: null, url: url(celex), responsible: null,
    inclusion: { basis: 'eurovoc', reason: "Indexed by the EU Publications Office under EuroVoc 'road safety' (4047)." },
    proposal: null, amended_by: [], amends: [], repealed_by: [], repeals: [], replaced_by: [], replaces: [],
    amendment_proposals: [], ...overrides,
  };
}

function proposal(celex: string, reference: string, overrides: Partial<Proposal> = {}): Proposal {
  return {
    celex, reference, title: `Proposal ${reference}`, type: 'PROP_DIR', type_label: 'Proposal for a directive',
    date_sent: null, status: 'open', status_note: null, end_of_validity: null, adopted_by: [], proposes_to_amend: [],
    indexed_road_safety: true, url: url(celex), ...overrides,
  };
}

export function makeLegislation(): Legislation {
  const acts = [
    act('32025L2205', 'Directive (EU) 2025/2205 of the European Parliament and of the Council of 22 October 2025 on driving licences', {
      date_adopted: '2025-10-22', entry_into_force: ['2025-11-25'],
      transposition_deadlines: ['2027-11-26', '2028-11-26', '2029-11-26'],
      proposal: { celex: '52023PC0127', reference: 'COM(2023) 127', date_sent: '2023-03-01', url: url('52023PC0127') },
      repeals: [{ celex: '32006L0126', title: 'Directive 2006/126/EC on driving licences', date: '2006-12-20', url: url('32006L0126') }],
    }),
    act('32015L0413', 'Directive (EU) 2015/413 of the European Parliament and of the Council of 11 March 2015 facilitating cross-border exchange of information on road-safety-related traffic offences', {
      date_adopted: '2015-03-11', transposition_deadlines: ['2015-05-06'],
      proposal: { celex: '52014PC0476', reference: 'COM(2014) 476', date_sent: '2014-07-18', url: url('52014PC0476') },
      amended_by: [{ celex: '32024L3237', title: 'Directive (EU) 2024/3237', date: '2024-12-19', url: url('32024L3237') }],
      amendment_proposals: ['52023PC0126'],
    }),
    act('32006L0126', 'Directive 2006/126/EC of the European Parliament and of the Council of 20 December 2006 on driving licences', {
      date_adopted: '2006-12-20', transposition_deadlines: ['2011-01-19'], in_force: false,
      inclusion: { basis: 'curated', reason: "Core EU rules on driving licences; indexed under 'European driving licence'." },
      repealed_by: [{ celex: '32025L2205', title: 'Directive (EU) 2025/2205', date: '2025-10-22', url: url('32025L2205') }],
    }),
    act('32004H0345', 'Commission Recommendation of 6 April 2004 on enforcement in the field of road safety', {
      type: 'RECO', type_label: 'Recommendation (non-binding)', date_adopted: '2004-04-06', in_force: null,
    }),
  ];
  const proposals = [
    proposal('52023PC0126', 'COM(2023) 126', { date_sent: '2023-03-01', proposes_to_amend: ['32015L0413'] }),
    proposal('52023PC0127', 'COM(2023) 127', { date_sent: '2023-03-01', status: 'adopted', adopted_by: ['32025L2205'] }),
    proposal('52011PC0451', 'COM(2011) 451', {
      date_sent: '2011-07-21',
      status_note: 'No adoption, withdrawal or end date recorded in EUR-Lex metadata after 15 years; the procedure may have ended. Check the EUR-Lex page.',
    }),
  ];
  return {
    schema_version: '1.0.0',
    generated_at: '2026-10-15T06:00:00Z',
    source: {
      publisher: 'Publications Office of the European Union (Cellar / EUR-Lex metadata)',
      endpoint: 'https://publications.europa.eu/webapi/rdf/sparql',
      selection: "Legal acts and proposals indexed with EuroVoc concept 'road safety', plus curated additions",
      eurovoc: { id: 'http://eurovoc.europa.eu/4047', label: 'road safety' },
      curated_additions: [{ celex: '32006L0126', reason: "Core EU rules on driving licences; indexed under 'European driving licence'." }],
      retrieved_at: '2026-10-15T05:47:34Z',
      licence: 'EUR-Lex data reuse: Commission Decision 2011/833/EU; © European Union',
    },
    summary: {
      acts_total: 4, acts_in_force: 2, acts_in_force_by_type: { Directive: 2 },
      proposals_open: 1, proposals_open_unclear: 1,
    },
    acts,
    proposals,
  };
}
