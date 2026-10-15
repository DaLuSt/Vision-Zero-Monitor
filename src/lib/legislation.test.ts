import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LegalAct, Legislation } from '../types/data';
import {
  actCitation, actStatusLabel, actSubject, DEFAULT_FILTERS, filterActs, openProposals, proposalTargets, typeOptions,
  upcomingDeadlines,
} from './legislation';
import { makeLegislation } from '../test/legislationFixture';

describe('actCitation / actSubject', () => {
  it.each([
    ['Directive (EU) 2015/413 of the European Parliament and of the Council of 11 March 2015 facilitating cross-border exchange',
      'Directive (EU) 2015/413', 'facilitating cross-border exchange'],
    ['Commission Implementing Regulation (EU) 2026/2266 of 13 October 2026 laying down detailed provisions',
      'Commission Implementing Regulation (EU) 2026/2266', 'laying down detailed provisions'],
    ['Regulation (EC) No 561/2006 of the European Parliament and of the Council of 15 March 2006 on the harmonisation',
      'Regulation (EC) No 561/2006', 'on the harmonisation'],
    ['2012/143/EU: Council Decision of 14 February 2012 on the position of the European Union',
      'Council Decision 2012/143/EU', 'on the position of the European Union'],
    ['Commission Recommendation of 6 April 2004 on enforcement in the field of road safety',
      'Commission Recommendation of 6 April 2004', 'on enforcement in the field of road safety'],
    ['Council Directive 91/671/EEC of 16 December 1991 on the approximation of the laws',
      'Council Directive 91/671/EEC', 'on the approximation of the laws'],
  ])('%s', (title, citation, subject) => {
    const act = { title, type_label: 'Directive', celex: '32015L0413' };
    expect(actCitation(act)).toBe(citation);
    expect(actSubject(act)).toBe(subject);
  });

  it('falls back to type and CELEX when there is no title', () => {
    expect(actCitation({ title: null, type_label: 'Decision', celex: '31993D0704' })).toBe('Decision 31993D0704');
    expect(actSubject({ title: null })).toBeNull();
  });

  it('produces a citation for every act in the published register', () => {
    const doc = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/legislation.json'), 'utf8')) as Legislation;
    for (const a of doc.acts) {
      expect(actCitation(a)).not.toMatch(/^\s*$/);
      expect(actCitation(a).length).toBeLessThan(80);
    }
  });
});

describe('filters and summaries', () => {
  const doc = makeLegislation();
  const byCelex = (acts: LegalAct[]) => acts.map((a) => a.celex);

  it('labels in-force status without guessing', () => {
    expect(doc.acts.map(actStatusLabel)).toEqual(['In force', 'In force', 'No longer in force', 'Status not recorded']);
  });

  it('filters by status, type, basis and search terms', () => {
    expect(byCelex(filterActs(doc.acts, DEFAULT_FILTERS))).toEqual(['32025L2205', '32015L0413']);
    expect(byCelex(filterActs(doc.acts, { ...DEFAULT_FILTERS, status: 'not_in_force' }))).toEqual(['32006L0126']);
    expect(byCelex(filterActs(doc.acts, { ...DEFAULT_FILTERS, status: 'all', basis: 'curated' }))).toEqual(['32006L0126']);
    expect(byCelex(filterActs(doc.acts, { ...DEFAULT_FILTERS, status: 'all', type: 'Recommendation (non-binding)' })))
      .toEqual(['32004H0345']);
    expect(byCelex(filterActs(doc.acts, { ...DEFAULT_FILTERS, q: 'driving LICENCES' }))).toEqual(['32025L2205']);
    expect(byCelex(filterActs(doc.acts, { ...DEFAULT_FILTERS, q: 'COM(2014) 476' }))).toEqual(['32015L0413']);
    expect(typeOptions(doc.acts)).toEqual(['Directive', 'Recommendation (non-binding)']);
  });

  it('lists upcoming transposition deadlines from a given day, excluding acts no longer in force', () => {
    const d = upcomingDeadlines(doc.acts, '2028-01-01');
    expect(d.map((x) => [x.date, x.act.celex])).toEqual([['2028-11-26', '32025L2205'], ['2029-11-26', '32025L2205']]);
    expect(upcomingDeadlines(doc.acts, '2026-10-15')).toHaveLength(3);
  });

  it('separates open proposals from those whose status is unclear', () => {
    const { pending, unclear } = openProposals(doc);
    expect(pending.map((p) => p.reference)).toEqual(['COM(2023) 126']);
    expect(unclear.map((p) => p.reference)).toEqual(['COM(2011) 451']);
    expect(proposalTargets(doc).get('52023PC0126')?.map((a) => a.celex)).toEqual(['32015L0413']);
  });
});
