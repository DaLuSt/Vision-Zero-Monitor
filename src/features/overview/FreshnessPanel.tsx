import type { Dataset } from '../../types/data';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { latestRetrieval } from '../../components/Header';
import { WORKFLOW_RUNS_URL } from '../../lib/site';

export function FreshnessPanel({ data, detailed = false }: { data: Dataset; detailed?: boolean }) {
  const m = data.metadata;
  const ps = data.pipelineStatus;
  const primary = m.sources.find((s) => s.role === 'primary');
  const names = new Map(data.countries.map((c) => [c.geo, c.name]));
  const outcomeLabel = ps
    ? ps.last_outcome === 'failure' ? 'Failed – previous valid data kept'
      : ps.last_outcome === 'unchanged' ? 'Succeeded – source unchanged' : 'Succeeded – data updated'
    : 'Not recorded';

  return (
    <section className="panel" aria-labelledby="freshness-heading">
      <h2 id="freshness-heading">Data freshness</h2>
      <dl className="facts">
        <div><dt>Last successful retrieval</dt><dd>{fmtDateTime(latestRetrieval(data))}</dd></div>
        <div><dt>Primary source last updated by Eurostat</dt><dd>{fmtDate(primary?.source_published_at)}</dd></div>
        <div><dt>Latest statistical reference year</dt><dd>{m.coverage.period ?? 'Not available'}</dd></div>
        <div>
          <dt>Member States with data for {m.coverage.period ?? 'latest year'}</dt>
          <dd>{m.coverage.member_states_reporting} of {m.coverage.member_states_total}</dd>
        </div>
        <div>
          <dt>Missing countries</dt>
          <dd>{m.coverage.missing.length ? m.coverage.missing.map((g) => names.get(g) ?? g).join(', ') : 'None'}</dd>
        </div>
        <div>
          <dt>Most recent recorded pipeline run</dt>
          <dd>
            <span className={`outcome outcome--${ps?.last_outcome ?? 'none'}`}>{outcomeLabel}</span>
            {ps && <> · {fmtDateTime(ps.last_attempt_at)}</>}
          </dd>
        </div>
      </dl>
      {ps?.last_outcome === 'failure' && (
        <p className="notice notice--warning" role="note">
          The latest update check failed: {ps.message} All figures shown are from the last validated dataset.
        </p>
      )}
      {detailed && (
        <>
          <h3>Data quality notes ({m.validation.warnings.length})</h3>
          <p className="small">
            Inconsistencies found in the source data by the automatic checks. They do not block publication and the
            figures shown follow the methodology; they are listed here for transparency.
          </p>
          {m.validation.warnings.length ? (
            <ul className="issue-list">
              {m.validation.warnings.map((w, i) => (
                <li key={i}><code>{w.code}</code> {w.message}</li>
              ))}
            </ul>
          ) : <p>None.</p>}
          <h3>Changes since previous dataset</h3>
          <p>
            {m.revisions.compared_with
              ? `Compared with the dataset generated ${fmtDateTime(m.revisions.compared_with)}: ${m.revisions.changed} value(s) revised, ${m.revisions.added} added, ${m.revisions.removed} removed.`
              : 'No earlier dataset to compare with (first publication). Earlier versions are traceable through the Git history of public/data/.'}
          </p>
        </>
      )}
      <p className="small muted">
        Runs are scheduled weekly; a run that finds unchanged data is not recorded here. See all runs on{' '}
        <a href={WORKFLOW_RUNS_URL}>GitHub Actions</a>. This dashboard is not live or real-time.
      </p>
    </section>
  );
}
