import { useEffect, useMemo, useState } from 'react';
import type { Commitments, Dataset, LegalAct, Legislation } from '../../types/data';
import { fmtDate, fmtInt, fmtRate } from '../../lib/format';
import { categoryRows, getDimension, latestCompletePeriod } from '../../lib/breakdowns';
import { euComparison, inSentence, rankPhrase } from '../../lib/country';
import { actCitation, actSubject, todayIso, upcomingDeadlines } from '../../lib/legislation';
import { FORM_LABEL } from '../../lib/commitments';
import { scrollArea } from '../../lib/scrollArea';

type Loaded<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; doc: T };

/** Load an optional data file; a failure only hides the section that needs it. */
function useOptional<T>(load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((doc) => !cancelled && setState({ kind: 'ready', doc }))
      .catch(() => !cancelled && setState({ kind: 'error' }));
    return () => { cancelled = true; };
  }, [load]);
  return state;
}

export function EuComparisonText({ data, geo, name }: { data: Dataset; geo: string; name: string }) {
  const c = useMemo(() => euComparison(data.observations, data.countries, geo), [data, geo]);
  if (!c) return null;
  return (
    <p>
      In {c.period}, {inSentence(name)} recorded <strong>{fmtRate(c.rate)}</strong> road deaths per million inhabitants
      {c.euRate != null && <>, against {fmtRate(c.euRate)} for the EU as a whole</>}. That is{' '}
      <strong>{rankPhrase(c.rank, c.ranked)}</strong> rate of the {c.ranked} Member States with a figure for {c.period}.
    </p>
  );
}

export function WhoDies({ data, geo, name }: { data: Dataset; geo: string; name: string }) {
  const bd = data.breakdowns;
  if (!bd) return null;
  const dims = (['road_user', 'vehicle'] as const)
    .map((id) => getDimension(bd, id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((dim) => {
      const period = latestCompletePeriod(bd, geo, dim);
      const rows = period
        ? categoryRows(bd, geo, dim, period).filter((r) => r.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        : [];
      return { dim, period, rows };
    });
  return (
    <section className="panel" aria-labelledby="who-heading">
      <h2 id="who-heading">Who dies on the roads in {inSentence(name)}</h2>
      <div className="breakdown-grid">
        {dims.map(({ dim, period, rows }) => (
          <div key={dim.id} {...scrollArea(`By ${dim.label.toLowerCase()}`)}>
            {period ? (
              <table>
                <caption className="small">By {dim.label.toLowerCase()}, {period}</caption>
                <thead><tr><th scope="col">{dim.label}</th><th scope="col" className="num">Deaths</th><th scope="col" className="num">Share</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}><th scope="row">{r.label}</th><td className="num">{fmtInt(r.value)}</td><td className="num">{fmtRate(r.share)}%</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small muted">No complete breakdown by {dim.label.toLowerCase()} is available for {inSentence(name)}.</p>
            )}
          </div>
        ))}
      </div>
      <p><a href={`#/road-users?geo=${geo}`}>Trends and details by road user and mode of transport</a></p>
    </section>
  );
}

export function CountryCommitments({ load, name }: { load: () => Promise<Commitments>; name: string }) {
  const state = useOptional(load);
  return (
    <section className="panel" aria-labelledby="country-commitments">
      <h2 id="country-commitments">Commitments covering {inSentence(name)}</h2>
      <p className="small">
        <strong>National road safety strategy:</strong> not yet covered by this site. National strategies and their
        targets are planned.
      </p>
      {state.kind === 'loading' && <p className="small muted" role="status">Loading commitments…</p>}
      {state.kind === 'error' && <p className="small muted">The list of commitments could not be loaded.</p>}
      {state.kind === 'ready' && (
        <>
          <p className="small">
            EU commitments cover all Member States, including {inSentence(name)}. Their targets apply to the EU as a whole, not to
            each country separately.
          </p>
          <ul className="related-list">
            {state.doc.commitments.filter((c) => c.level === 'eu').map((c) => (
              <li key={c.id}>
                <a href={`#/commitments`}>{c.title}</a>
                <span className="muted small"> · {FORM_LABEL[c.form]}, {c.date.length === 4 ? c.date : fmtDate(c.date)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function CountryDeadlines({ load, today = todayIso(), limit = 5 }: {
  load: () => Promise<Legislation>; today?: string; limit?: number;
}) {
  const state = useOptional(load);
  // One line per directive, with all its upcoming dates (some apply in stages).
  const byAct = new Map<string, { act: LegalAct; dates: string[] }>();
  for (const d of state.kind === 'ready' ? upcomingDeadlines(state.doc.acts, today) : []) {
    const entry = byAct.get(d.act.celex) ?? { act: d.act, dates: [] };
    entry.dates.push(d.date);
    byAct.set(d.act.celex, entry);
  }
  const deadlines = [...byAct.values()];
  return (
    <section className="panel" aria-labelledby="country-deadlines">
      <h2 id="country-deadlines">Upcoming EU transposition deadlines</h2>
      <p className="small muted">
        Dates by which every Member State must bring national law into line with an EU directive, as recorded in
        EUR-Lex. This site does not track whether a country has done so.
      </p>
      {state.kind === 'loading' && <p className="small muted" role="status">Loading legislation…</p>}
      {state.kind === 'error' && <p className="small muted">The legislation register could not be loaded.</p>}
      {state.kind === 'ready' && (deadlines.length ? (
        <ul className="related-list deadline-list">
          {deadlines.slice(0, limit).map(({ dates, act }) => (
            <li key={act.celex}>
              <strong>{dates.map(fmtDate).join(', ')}</strong> · <a href={act.url} rel="noopener noreferrer">{actCitation(act)}</a>
              {actSubject(act) && <span className="row-note">{actSubject(act)}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="small">No upcoming deadlines recorded.</p>)}
      <p><a href="#/legislation">All EU road safety legislation</a></p>
    </section>
  );
}
