import type { LegalAct, Legislation, Proposal } from '../types/data';

export type ActStatusFilter = 'all' | 'in_force' | 'not_in_force';
export type BasisFilter = 'all' | 'eurovoc' | 'curated';

export interface ActFilters {
  q: string;
  type: string; // type_label or 'all'
  status: ActStatusFilter;
  basis: BasisFilter;
}

export const DEFAULT_FILTERS: ActFilters = { q: '', type: 'all', status: 'in_force', basis: 'all' };

export function actStatusLabel(act: LegalAct): string {
  if (act.in_force === true) return 'In force';
  if (act.in_force === false) return 'No longer in force';
  return 'Status not recorded';
}

const NUMBERED = /^((?:Commission |Council )?(?:Delegated |Implementing )?(?:Directive|Regulation|Decision|Recommendation)\s*(?:\((?:EU|EC|EEC|EU, Euratom)\))?\s*(?:No\s*)?\d+\/\d+(?:\/(?:EU|EC|EEC))?)/;
const PREFIXED = /^(\d+\/\d+\/(?:EU|EC|EEC)):\s*(.+?)\s+of\s+\d/;
const DATED = /^(.+?\bof\s+\d{1,2}\s+\p{L}+\s+\d{4})/u;
const ADOPTION_DATE = /\bof\s+\d{1,2}\s+\p{L}+\s+\d{4}\s*/u;

/** Short citation such as "Directive (EU) 2015/413", derived from the official title. */
export function actCitation(act: Pick<LegalAct, 'title' | 'type_label' | 'celex'>): string {
  const title = act.title?.replace(/\s+/g, ' ').trim();
  if (!title) return `${act.type_label} ${act.celex}`;
  let m = title.match(NUMBERED);
  if (m) return m[1];
  m = title.match(PREFIXED);
  if (m) return `${m[2]} ${m[1]}`;
  m = title.match(DATED);
  return m ? m[1] : `${act.type_label} ${act.celex}`;
}

/** The subject of the act: the official title after the citation and adoption date. */
export function actSubject(act: Pick<LegalAct, 'title'>): string | null {
  const title = act.title?.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const m = title.match(ADOPTION_DATE);
  const rest = m && m.index != null ? title.slice(m.index + m[0].length).replace(/^[,\s–-]+/, '') : '';
  return rest || title;
}

export function typeOptions(acts: LegalAct[]): string[] {
  return [...new Set(acts.map((a) => a.type_label))].sort((a, b) => a.localeCompare(b));
}

export function filterActs(acts: LegalAct[], f: ActFilters): LegalAct[] {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return acts.filter((a) => {
    if (f.type !== 'all' && a.type_label !== f.type) return false;
    if (f.status === 'in_force' && a.in_force !== true) return false;
    if (f.status === 'not_in_force' && a.in_force !== false) return false;
    if (f.basis !== 'all' && a.inclusion.basis !== f.basis) return false;
    if (!terms.length) return true;
    const hay = `${a.title ?? ''} ${a.celex} ${a.proposal?.reference ?? ''} ${a.type_label}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export interface Deadline {
  date: string;
  act: LegalAct;
}

/** Transposition deadlines on or after `today` (YYYY-MM-DD), for acts recorded as in force. */
export function upcomingDeadlines(acts: LegalAct[], today: string): Deadline[] {
  return acts
    .filter((a) => a.in_force !== false)
    .flatMap((a) => a.transposition_deadlines.filter((d) => d >= today).map((date) => ({ date, act: a })))
    .sort((x, y) => x.date.localeCompare(y.date) || x.act.celex.localeCompare(y.act.celex));
}

export function isPast(date: string, today: string): boolean {
  return date < today;
}

export function openProposals(doc: Legislation): { pending: Proposal[]; unclear: Proposal[] } {
  const open = doc.proposals.filter((p) => p.status === 'open');
  return { pending: open.filter((p) => !p.status_note), unclear: open.filter((p) => p.status_note) };
}

/** Which acts in the register a proposal would amend, keyed by proposal CELEX. */
export function proposalTargets(doc: Legislation): Map<string, LegalAct[]> {
  const out = new Map<string, LegalAct[]>();
  for (const a of doc.acts) {
    for (const p of a.amendment_proposals) out.set(p, [...(out.get(p) ?? []), a]);
  }
  return out;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
