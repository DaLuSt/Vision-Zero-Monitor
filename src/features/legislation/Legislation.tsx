import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LegalAct, Legislation as Register, Proposal, RelatedDocument } from '../../types/data';
import { loadLegislation } from '../../lib/data';
import { fmtDate, fmtInt } from '../../lib/format';
import {
  actCitation, actStatusLabel, actSubject, actTimeline, DEFAULT_FILTERS, filterActs, isPast, openProposals, proposalTargets,
  todayIso, typeOptions, upcomingDeadlines, type ActFilters, type ActStatusFilter, type BasisFilter,
} from '../../lib/legislation';
import { EmptyState, Notice } from '../../components/States';
import { scrollArea } from '../../lib/scrollArea';

const PAGE = 20;
const EURLEX_SEARCH = 'https://eur-lex.europa.eu/';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; doc: Register };

function ExternalLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <a href={href} rel="noopener noreferrer">
      {children}{' '}<span className="visually-hidden">{label ? `${label} ` : ''}on EUR-Lex (external)</span>
    </a>
  );
}

function ActStatusBadge({ act }: { act: LegalAct }) {
  const tone = act.in_force === true ? 'in-force' : act.in_force === false ? 'ended' : 'unknown';
  return <span className={`badge badge--act-${tone}`}>{actStatusLabel(act)}</span>;
}

function Deadlines({ dates, today }: { dates: string[]; today: string }) {
  if (!dates.length) return <>Not applicable or not recorded</>;
  return (
    <ul className="inline-list">
      {dates.map((d) => (
        <li key={d}>
          {fmtDate(d)}{' '}
          <span className={`badge${isPast(d, today) ? '' : ' badge--upcoming'}`}>{isPast(d, today) ? 'passed' : 'upcoming'}</span>
        </li>
      ))}
    </ul>
  );
}

function RelatedList({ title, items }: { title: string; items: RelatedDocument[] }) {
  if (!items.length) return null;
  return (
    <div>
      <dt>{title}</dt>
      <dd>
        <ul className="related-list">
          {items.map((r) => (
            <li key={r.celex}>
              <ExternalLink href={r.url} label={r.celex}>{r.title ? actCitation({ title: r.title, type_label: 'Act', celex: r.celex }) : r.celex}</ExternalLink>
              {r.date && <span className="muted"> · {fmtDate(r.date)}</span>}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function Timeline({ act, today }: { act: LegalAct; today: string }) {
  const { events, notRecorded } = actTimeline(act, today);
  if (!events.length) return null;
  return (
    <div className="timeline-wrap">
      <ol className="timeline" aria-label={`Timeline of ${actCitation(act)}`}>
        {events.map((e, i) => (
          <li key={i} className={`timeline__item${e.upcoming ? ' timeline__item--upcoming' : ''}`}>
            <time dateTime={e.date} className="timeline__date">{fmtDate(e.date)}</time>
            <span className="timeline__label">
              {e.url ? <ExternalLink href={e.url}>{e.label}</ExternalLink> : e.label}
              {e.upcoming && <span className="badge badge--upcoming">upcoming</span>}
            </span>
          </li>
        ))}
      </ol>
      {notRecorded.length > 0 && <p className="small muted">Not recorded in EUR-Lex: {notRecorded.join(', ')}.</p>}
    </div>
  );
}

function ActCard({ act, today, proposals }: { act: LegalAct; today: string; proposals: Map<string, Proposal> }) {
  const citation = actCitation(act);
  const subject = actSubject(act);
  const pending = act.amendment_proposals.map((c) => proposals.get(c)).filter((p): p is Proposal => !!p && p.status === 'open');
  return (
    <li className="act-card">
      <article aria-labelledby={`act-${act.celex}`}>
        <div className="act-card__head">
          <h3 id={`act-${act.celex}`} className="act-card__title">
            <ExternalLink href={act.url} label="official text">{citation}</ExternalLink>
          </h3>
          <div className="act-card__badges">
            <ActStatusBadge act={act} />
            <span className="badge">{act.type_label}</span>
            {act.inclusion.basis === 'curated' && <span className="badge badge--curated" title={act.inclusion.reason}>Curated addition</span>}
          </div>
        </div>
        {subject && <p className="act-card__subject">{subject}</p>}
        {pending.length > 0 && (
          <p className="act-card__pending">
            <span aria-hidden="true">✎ </span>Amendment proposed:{' '}
            {pending.map((p, i) => (
              <span key={p.celex}>{i > 0 && ', '}<ExternalLink href={p.url}>{p.reference ?? p.celex}</ExternalLink>{p.status_note && ' (status unclear)'}</span>
            ))}
          </p>
        )}
        <details className="act-card__details">
          <summary>Lifecycle and related acts</summary>
          <Timeline act={act} today={today} />
          <dl className="lifecycle">
            <div>
              <dt>Commission proposal</dt>
              <dd>
                {act.proposal
                  ? <><ExternalLink href={act.proposal.url}>{act.proposal.reference ?? act.proposal.celex}</ExternalLink>
                    {act.proposal.date_sent && <span className="muted"> · sent {fmtDate(act.proposal.date_sent)}</span>}</>
                  : 'None recorded'}
              </dd>
            </div>
            <div><dt>Adopted</dt><dd>{act.date_adopted ? fmtDate(act.date_adopted) : 'Not recorded'}</dd></div>
            <div><dt>Entry into force</dt><dd>{act.entry_into_force.length ? act.entry_into_force.map(fmtDate).join(', ') : 'Not recorded'}</dd></div>
            {act.type.startsWith('DIR') && (
              <div><dt>Transposition deadline{act.transposition_deadlines.length > 1 ? 's' : ''}</dt><dd><Deadlines dates={act.transposition_deadlines} today={today} /></dd></div>
            )}
            {act.end_of_validity && <div><dt>End of validity</dt><dd>{fmtDate(act.end_of_validity)}</dd></div>}
            <RelatedList title="Amended by" items={act.amended_by} />
            <RelatedList title="Repealed by" items={act.repealed_by} />
            <RelatedList title="Replaced by" items={act.replaced_by} />
            <RelatedList title="Amends" items={act.amends} />
            <RelatedList title="Repeals" items={act.repeals} />
            <RelatedList title="Replaces" items={act.replaces} />
            <div>
              <dt>Identifier</dt>
              <dd><span className="mono">CELEX {act.celex}</span>{act.eli && <> · <a href={act.eli} rel="noopener noreferrer">ELI</a></>}</dd>
            </div>
            <div><dt>Why it is listed</dt><dd>{act.inclusion.reason}</dd></div>
          </dl>
        </details>
      </article>
    </li>
  );
}

function ProposalRow({ p, targets }: { p: Proposal; targets: LegalAct[] }) {
  return (
    <tr>
      <th scope="row" className="nowrap"><ExternalLink href={p.url}>{p.reference ?? p.celex}</ExternalLink></th>
      <td className="nowrap">{p.date_sent ? fmtDate(p.date_sent) : 'Not recorded'}</td>
      <td>
        {p.title ?? p.type_label}
        {targets.length > 0 && (
          <span className="row-note">Would amend: {targets.map((a) => actCitation(a)).join(', ')}</span>
        )}
        {p.status_note && <span className="row-note row-note--warn">{p.status_note}</span>}
      </td>
    </tr>
  );
}

function ProposalTable({ caption, rows, targets }: { caption: string; rows: Proposal[]; targets: Map<string, LegalAct[]> }) {
  return (
    <div {...scrollArea(caption)}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr><th scope="col">Proposal</th><th scope="col">Sent</th><th scope="col">Subject</th></tr></thead>
        <tbody>{rows.map((p) => <ProposalRow key={p.celex} p={p} targets={targets.get(p.celex) ?? []} />)}</tbody>
      </table>
    </div>
  );
}

function ActRegister({ doc, today }: { doc: Register; today: string }) {
  const [filters, setFilters] = useState<ActFilters>(DEFAULT_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const set = <K extends keyof ActFilters>(k: K) => (v: ActFilters[K]) => { setFilters((f) => ({ ...f, [k]: v })); setLimit(PAGE); };
  const results = useMemo(() => filterActs(doc.acts, filters), [doc, filters]);
  const types = useMemo(() => typeOptions(doc.acts), [doc]);
  const proposals = useMemo(() => new Map(doc.proposals.map((p) => [p.celex, p])), [doc]);
  return (
    <section className="panel" aria-labelledby="register-heading">
      <h2 id="register-heading">Register of legal acts</h2>
      <form className="filters" role="search" aria-label="Filter legal acts" onSubmit={(e) => e.preventDefault()}>
        <label className="field"><span>Search</span>
          <input type="search" value={filters.q} placeholder="e.g. driving licences, 2015/413" onChange={(e) => set('q')(e.target.value)} />
        </label>
        <label className="field"><span>Status</span>
          <select value={filters.status} onChange={(e) => set('status')(e.target.value as ActStatusFilter)}>
            <option value="in_force">In force</option>
            <option value="not_in_force">No longer in force</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="field"><span>Type</span>
          <select value={filters.type} onChange={(e) => set('type')(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field"><span>Listed because</span>
          <select value={filters.basis} onChange={(e) => set('basis')(e.target.value as BasisFilter)}>
            <option value="all">Any reason</option>
            <option value="eurovoc">Indexed “road safety”</option>
            <option value="curated">Curated addition</option>
          </select>
        </label>
      </form>
      <p className="small muted" role="status" aria-live="polite">
        {fmtInt(results.length)} of {fmtInt(doc.acts.length)} acts, newest first.
      </p>
      {results.length === 0 ? (
        <EmptyState>No acts match these filters.</EmptyState>
      ) : (
        <>
          <ul className="act-list">
            {results.slice(0, limit).map((a) => <ActCard key={a.celex} act={a} today={today} proposals={proposals} />)}
          </ul>
          {results.length > limit && (
            <button type="button" className="button button--ghost" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, results.length - limit)} more ({fmtInt(results.length - limit)} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function LegislationView({ doc, today }: { doc: Register; today: string }) {
  const s = doc.summary;
  const { pending, unclear } = openProposals(doc);
  const targets = useMemo(() => proposalTargets(doc), [doc]);
  const deadlines = useMemo(() => upcomingDeadlines(doc.acts, today), [doc, today]);
  const directives = s.acts_in_force_by_type['Directive'] ?? 0;
  const regulations = s.acts_in_force_by_type['Regulation'] ?? 0;
  return (
    <>
      <section className="panel" aria-labelledby="legislation-heading">
        <h2 id="legislation-heading">EU road safety legislation</h2>
        <p>
          Legal acts and Commission proposals that the EU Publications Office indexes under the subject “road safety”,
          plus a few core acts it indexes elsewhere (marked <em>curated addition</em>). Every entry links to the
          official text on EUR-Lex.
        </p>
        <Notice>
          Status and dates are taken as recorded in EUR-Lex metadata. This register does not assess whether a
          Member State has transposed or applies a law, and it is not legal advice. Retrieved{' '}
          {fmtDate(doc.source.retrieved_at)}.
        </Notice>
        <div className="kpi-grid">
          <div className="kpi">
            <p className="kpi__label">Acts in force</p>
            <p className="kpi__value">{fmtInt(s.acts_in_force)}</p>
            <p className="kpi__note">including {fmtInt(directives)} directives and {fmtInt(regulations)} regulations; {fmtInt(s.acts_total)} acts listed in total</p>
          </div>
          <div className="kpi">
            <p className="kpi__label">Commission proposals pending</p>
            <p className="kpi__value">{fmtInt(s.proposals_open)}</p>
            <p className="kpi__note">
              no adoption or withdrawal recorded{s.proposals_open_unclear ? `; ${fmtInt(s.proposals_open_unclear)} more with unclear status` : ''}
            </p>
          </div>
          <div className="kpi">
            <p className="kpi__label">Upcoming transposition deadlines</p>
            <p className="kpi__value">{fmtInt(deadlines.length)}</p>
            <p className="kpi__note">{deadlines.length ? `next: ${fmtDate(deadlines[0].date)}` : 'none recorded'}</p>
          </div>
        </div>
      </section>

      {deadlines.length > 0 && (
        <section className="panel" aria-labelledby="deadlines-heading">
          <h2 id="deadlines-heading">Upcoming transposition deadlines</h2>
          <p className="small muted">Dates by which Member States must bring national law into line with a directive, as recorded in EUR-Lex.</p>
          <div {...scrollArea('Upcoming transposition deadlines')}>
            <table>
              <thead><tr><th scope="col">Deadline</th><th scope="col">Directive</th></tr></thead>
              <tbody>
                {deadlines.map(({ date, act }) => (
                  <tr key={`${act.celex}-${date}`}>
                    <td className="nowrap">{fmtDate(date)}</td>
                    <th scope="row">
                      <ExternalLink href={act.url}>{actCitation(act)}</ExternalLink>
                      {actSubject(act) && <span className="row-note">{actSubject(act)}</span>}
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="proposals-heading">
        <h2 id="proposals-heading">Proposals in the legislative process</h2>
        <p className="small muted">
          Commission proposals for which EUR-Lex records no adopted act, withdrawal or end date. Progress in Parliament
          and Council is shown on each proposal's EUR-Lex page.
        </p>
        {pending.length ? <ProposalTable caption="Pending proposals" rows={pending} targets={targets} /> : <EmptyState>No pending proposals recorded.</EmptyState>}
        {unclear.length > 0 && (
          <details className="unclear">
            <summary>{unclear.length} older proposal{unclear.length === 1 ? '' : 's'} with unclear status</summary>
            <ProposalTable caption="Proposals with unclear status" rows={unclear} targets={targets} />
          </details>
        )}
      </section>

      <ActRegister doc={doc} today={today} />

      <section className="panel small" aria-labelledby="legislation-source">
        <h2 id="legislation-source">Source</h2>
        <p>
          {doc.source.publisher}, SPARQL endpoint <code>{doc.source.endpoint}</code>. Selection: {doc.source.selection}.
          Register built {fmtDate(doc.generated_at)}; source queried {fmtDate(doc.source.retrieved_at)}.{' '}
          {doc.source.licence}. Search all EU law on <a href={EURLEX_SEARCH} rel="noopener noreferrer">EUR-Lex</a>.
          See the <a href="#/methodology">methodology</a> for how statuses are derived.
        </p>
      </section>
    </>
  );
}

export function Legislation({ load = loadLegislation, today = todayIso() }: { load?: () => Promise<Register>; today?: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((doc) => !cancelled && setState({ kind: 'ready', doc }))
      .catch((e: unknown) => !cancelled && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => { cancelled = true; };
  }, [load]);
  if (state.kind === 'loading') {
    return <div className="state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Loading the legislation register…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div className="state state--error" role="alert">
        <h2>The legislation register could not be loaded</h2>
        <p>{state.message}</p>
        <p>Search EU legislation directly on <a href={EURLEX_SEARCH} rel="noopener noreferrer">EUR-Lex</a>.</p>
      </div>
    );
  }
  return <LegislationView doc={state.doc} today={today} />;
}
