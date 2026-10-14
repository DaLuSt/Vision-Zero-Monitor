import type { Dataset } from '../../types/data';
import { fmtDateTime } from '../../lib/format';
import { DOCS_URL } from '../../lib/site';
import { FreshnessPanel } from '../overview/FreshnessPanel';

const ROLE: Record<string, string> = {
  primary: 'Primary source (death counts)',
  denominator: 'Denominator (population)',
  cross_check: 'Independent cross-check only',
  derived: 'Derived by this dashboard',
};

export function Sources({ data }: { data: Dataset }) {
  return (
    <>
      <section className="panel prose" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        <p>Full source assessment: <a href={`${DOCS_URL}/DATA_SOURCES.md`}>DATA_SOURCES.md</a>.</p>
        {data.metadata.sources.map((s) => (
          <div key={s.id} className="source-card">
            <h3>{s.title}</h3>
            <p className="muted small">{ROLE[s.role] ?? s.role}</p>
            <dl className="facts">
              <div><dt>Publisher</dt><dd>{s.publisher}</dd></div>
              {s.dataset && <div><dt>Dataset</dt><dd><code>{s.dataset}</code></dd></div>}
              <div><dt>Source updated</dt><dd>{fmtDateTime(s.source_published_at)}</dd></div>
              <div><dt>Retrieved</dt><dd>{fmtDateTime(s.retrieved_at)}</dd></div>
              {s.latest_period_in_source && <div><dt>Latest period in source</dt><dd>{s.latest_period_in_source}</dd></div>}
              <div><dt>Reuse</dt><dd>{s.license}</dd></div>
            </dl>
            <p className="links">
              <a href={s.url}>View source</a>
              {s.api_url && <> · <a href={s.api_url}>API request</a></>}
              {s.metadata_url && s.metadata_url !== s.url && <> · <a href={s.metadata_url}>Metadata</a></>}
            </p>
          </div>
        ))}
        <h3>Not used</h3>
        <p>
          The European Commission publishes preliminary figures for the most recent year (e.g. 2025) on its road safety
          statistics pages. These are not available in a machine-readable form and are not shown here.
        </p>
      </section>
      <FreshnessPanel data={data} detailed />
    </>
  );
}
