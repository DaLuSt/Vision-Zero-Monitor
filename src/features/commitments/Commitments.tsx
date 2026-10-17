import { useEffect, useId, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Commitment, Commitments as CommitmentsDoc, CommitmentSource, CommitmentTarget, Dataset } from '../../types/data';
import { loadCommitments } from '../../lib/data';
import { fmtDate, fmtInt, fmtPct } from '../../lib/format';
import {
  BASIS_LABEL, byLevel, chartRows, FORM_LABEL, isYearOnly, LEVEL_LABEL, targetPaths, type ChartRow,
  type TargetPath,
} from '../../lib/commitments';
import { Notice } from '../../components/States';
import { DOCS_URL } from '../../lib/site';
import { scrollArea } from '../../lib/scrollArea';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; doc: CommitmentsDoc };

const docDate = (d: string) => (isYearOnly(d) ? d : fmtDate(d));

function TargetChart({ data, doc }: { data: Dataset; doc: CommitmentsDoc }) {
  const id = useId();
  const paths = useMemo(() => targetPaths(doc), [doc]);
  const rows = useMemo(() => chartRows(data.observations, paths), [data, paths]);
  if (!rows.length) return null;
  const ticks = rows.map((r) => r.year).filter((y) => y % 5 === 0);
  const title = 'EU road deaths and the targets set for them';
  return (
    <section className="panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      <figure className="chart" aria-labelledby={`${id}-cap`}>
        <figcaption id={`${id}-cap`} className="chart__title">
          Road deaths in the EU-27, official figures, with each measurable target drawn as a straight line from its
          baseline to its target value
        </figcaption>
        <div className="chart__canvas">
          <ResponsiveContainer width="100%" height={340} initialDimension={{ width: 640, height: 340 }}>
            <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 8, left: 8 }} accessibilityLayer title={title}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} ticks={ticks}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
              <YAxis domain={[0, 'auto']} width={64} tickFormatter={(v: number) => fmtInt(v)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip paths={paths} />} cursor={{ stroke: 'var(--axis)' }} />
              {paths.map((p) => (
                <Line key={p.key} dataKey={p.key} name={p.label} stroke={p.color} strokeWidth={2} strokeDasharray="6 4"
                  connectNulls dot={{ r: 4, fill: p.color, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={false}
                  isAnimationActive={false} />
              ))}
              <Line dataKey="deaths" name="Road deaths (official)" stroke="var(--series-1)" strokeWidth={2.5}
                dot={false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ul className="chart-legend" aria-label="Legend">
          <li><span className="legend-swatch legend-swatch--line" aria-hidden="true" /> Road deaths, EU-27 (Eurostat)</li>
          {paths.map((p) => (
            <li key={p.key}>
              <span className="legend-swatch" aria-hidden="true" style={{ borderTop: `2px dashed ${p.color}` }} /> {p.label}
            </li>
          ))}
        </ul>
        <p className="small muted">
          The dashed lines connect each baseline with its target value. They are not official trajectories or
          forecasts. Targets set for the EU of an earlier date are shown against today's EU-27 figures.
        </p>
        <details className="chart__table">
          <summary>Show data table</summary>
          <div {...scrollArea(`Data table: ${title}`)}>
            <table>
              <caption className="visually-hidden">{title}</caption>
              <thead><tr><th scope="col">Year</th><th scope="col" className="num">Road deaths</th>
                {paths.map((p) => <th key={p.key} scope="col" className="num">{p.label}</th>)}</tr></thead>
              <tbody>
                {rows.filter((r) => r.deaths != null || paths.some((p) => r[p.key] != null)).map((r) => (
                  <tr key={r.year}>
                    <th scope="row">{r.year}</th>
                    <td className="num">{r.deaths == null ? '–' : fmtInt(r.deaths)}</td>
                    {paths.map((p) => <td key={p.key} className="num">{r[p.key] == null ? '' : fmtInt(r[p.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figure>
    </section>
  );
}

function ChartTip({ active, payload, paths }: { active?: boolean; payload?: { payload: ChartRow }[]; paths: TargetPath[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const marks = paths.filter((p) => r[p.key] != null);
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__period">{r.year}</p>
      <p>{r.deaths == null ? 'No official figure' : <><strong>{fmtInt(r.deaths)}</strong> road deaths</>}</p>
      {marks.map((p) => (
        <p key={p.key} className="muted">{p.from.year === r.year ? 'Baseline' : 'Target value'}: {fmtInt(r[p.key])} · {p.label}</p>
      ))}
    </div>
  );
}

function TargetBlock({ t }: { t: CommitmentTarget }) {
  return (
    <div className="target">
      <h4 className="target__title">{t.description}</h4>
      {t.outcomes.length > 0 && (
        <div {...scrollArea(`${t.description}: target value and official figures`)}>
          <table className="target__table">
            <caption className="visually-hidden">{t.description}: target value and official figures</caption>
            <thead>
              <tr><th scope="col">Baseline</th><th scope="col" className="num">Target value</th><th scope="col" className="num">Official figure</th>
                <th scope="col" className="num">Change</th></tr>
            </thead>
            <tbody>
              {t.outcomes.map((o) => (
                <tr key={o.basis + o.baseline_year}>
                  <th scope="row">{o.baseline_year}: {fmtInt(o.baseline_value)}<span className="row-note">{BASIS_LABEL[o.basis]}</span></th>
                  <td className="num">{fmtInt(o.target_value)}<span className="row-note">by {o.target_year}</span></td>
                  <td className="num">{fmtInt(o.compare_value)}<span className="row-note">{o.compare_year ?? '–'}</span></td>
                  <td className="num">{fmtPct(o.change_pct)}<span className="row-note">target {fmtPct(o.required_change_pct)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {t.reference && t.reference.value != null && (
        <p className="small">Latest official figure ({t.reference.period}): <strong>{fmtInt(t.reference.value)}</strong> road deaths.</p>
      )}
      {t.not_measured_reason && <p className="small muted">{t.not_measured_reason}</p>}
      {t.scope_note && <p className="small muted">{t.scope_note}</p>}
      {t.monitoring_baselines.map((m) => (
        <p key={m.year} className="small muted">{m.note} Source: <a href={m.source.url} rel="noopener noreferrer">{m.source.title}</a>.</p>
      ))}
    </div>
  );
}

/** A verbatim quote in its original language, followed by a labelled English translation if it has one. */
export function Quote({ s }: { s: CommitmentSource }) {
  const tr = s.translation;
  return (
    <>
      <blockquote cite={s.url} lang={s.language}><p>“{s.quote}”</p></blockquote>
      {tr && (
        <div className="commitment__translation">
          <p className="small">
            <strong>{tr.kind === 'official' ? 'Official English translation' : 'English translation by this site (not official)'}</strong>
            {tr.kind === 'official' && tr.url && <>{' '}(<a href={tr.url} rel="noopener noreferrer">{tr.title}</a>, {tr.location})</>}:
          </p>
          <blockquote cite={tr.url} lang="en"><p>“{tr.text}”</p></blockquote>
        </div>
      )}
    </>
  );
}

function CommitmentCard({ c }: { c: Commitment }) {
  const [primary, ...others] = c.sources;
  return (
    <li className="commitment">
      <article aria-labelledby={`c-${c.id}`}>
        <div className="act-card__head">
          <h3 id={`c-${c.id}`} className="act-card__title">{c.title}</h3>
          <div className="act-card__badges">
            <span className="badge">{FORM_LABEL[c.form]}</span>
            <span className="badge badge--act-unknown">Not legally binding</span>
          </div>
        </div>
        <p className="small muted commitment__meta">{c.issuer} · {docDate(c.date)} · Scope: {c.scope}</p>
        <figure className="commitment__quote">
          <Quote s={primary} />
          <figcaption className="small">
            <a href={primary.url} rel="noopener noreferrer">{primary.reference}</a>, {primary.location}
            {' — '}<cite>{primary.title}</cite>
          </figcaption>
        </figure>
        {others.map((s, i) => (
          <details key={i} className="commitment__more">
            <summary>
              {s.reference === primary.reference
                ? `Also in this document: ${s.location}`
                : `${s.role === 'first_set_out' ? 'First set out in' : s.role === 'reaffirmed' ? 'Reaffirmed in' : 'Also in'} ${s.reference} (${docDate(s.date)})`}
            </summary>
            <Quote s={s} />
            <p className="small"><a href={s.url} rel="noopener noreferrer">{s.reference}</a>, {s.location} — <cite>{s.title}</cite></p>
          </details>
        ))}
        <p className="small">{c.nature}</p>
        {c.targets.map((t) => <TargetBlock key={t.id} t={t} />)}
      </article>
    </li>
  );
}

export function CommitmentsView({ data, doc }: { data: Dataset; doc: CommitmentsDoc }) {
  const groups = byLevel(doc);
  return (
    <>
      <section className="panel" aria-labelledby="commitments-heading">
        <h2 id="commitments-heading">Policy commitments</h2>
        <p>
          What the EU, the international community and a first set of Member States have committed to on road safety,
          quoted word for word from the official documents (with an English translation where the original is in
          another language). Where a target can be measured with the official statistics on this site, the target value
          and the latest official figure are shown next to it.
        </p>
        <Notice>
          None of these commitments is legally binding. Each quote was checked against the official document
          on {fmtDate(doc.reviewed_at)}. Figures are Eurostat's official road deaths, for the current EU-27 or, for a
          national strategy, for that country; the site does not judge whether a target is “on track”. Serious-injury targets cannot be measured: there is no official EU-wide series of serious injuries (MAIS3+) yet.
        </Notice>
        <dl className="facts">
          <div><dt>Commitments listed</dt><dd>{fmtInt(doc.summary.commitments)}</dd></div>
          <div><dt>Targets measured with official data</dt><dd>{fmtInt(doc.summary.targets_measured)} of {fmtInt(doc.summary.targets)}</dd></div>
          <div><dt>Quotes last checked</dt><dd>{fmtDate(doc.reviewed_at)}</dd></div>
        </dl>
      </section>

      <TargetChart data={data} doc={doc} />

      {groups.map((g) => (
        <section key={g.level} className="panel" aria-labelledby={`level-${g.level}`}>
          <h2 id={`level-${g.level}`}>{LEVEL_LABEL[g.level]}</h2>
          {g.level === 'national' && (
            <p className="small">
              A first selection of national road safety strategies, measured against Eurostat's figures for each country.
              More countries will follow; for France no official national road-death target for 2030 was found.
            </p>
          )}
          <ul className="act-list">{g.items.map((c) => <CommitmentCard key={c.id} c={c} />)}</ul>
        </section>
      ))}

      <section className="panel small" aria-labelledby="commitments-method">
        <h2 id="commitments-method">How this is put together</h2>
        <p>
          Commitments are published as documents, not as data, so they are curated by hand: each entry quotes the
          official text and links to it, and a script checks every quote against the source before a review is
          recorded. Target values are the official baseline figure × (1 − the stated reduction); the change is
          (official figure − baseline) ÷ baseline. When a target's deadline has passed, the figure for the target year
          is shown; otherwise the latest available year. See the{' '}
          <a href={`${DOCS_URL}/METHODOLOGY.md#policy-commitments`}>methodology</a>. Quotes in other languages come with
          an English translation: the issuer's official translation where one exists (checked against it like the
          quote), otherwise a translation made for this site and labelled as such.
        </p>
      </section>
    </>
  );
}

export function Commitments({ data, load = loadCommitments }: { data: Dataset; load?: () => Promise<CommitmentsDoc> }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((doc) => !cancelled && setState({ kind: 'ready', doc }))
      .catch((e: unknown) => !cancelled && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => { cancelled = true; };
  }, [load]);
  if (state.kind === 'loading') {
    return <div className="state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" /> Loading commitments…</div>;
  }
  if (state.kind === 'error') {
    return (
      <div className="state state--error" role="alert">
        <h2>The commitments could not be loaded</h2>
        <p>{state.message}</p>
      </div>
    );
  }
  return <CommitmentsView data={data} doc={state.doc} />;
}
