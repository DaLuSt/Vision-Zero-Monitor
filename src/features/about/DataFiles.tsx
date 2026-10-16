import { DATA_BASE } from '../../lib/data';
import { REPO_URL } from '../../lib/site';

const SITE_DATA_URL = 'https://dalust.github.io/Vision-Zero-Monitor/data/';
const SCHEMA_URL = `${REPO_URL}/blob/main/schemas`;

interface DataFile {
  name: string;
  title: string;
  contents: string;
  updated: string;
  source: string;
}

export const DATA_FILES: DataFile[] = [
  {
    name: 'observations', title: 'Observations',
    contents: 'One record per country (EU-27 and the EU total), indicator and year: road deaths, road deaths per million inhabitants and average population, each with its value (null when missing), status, Eurostat flag, source and dates.',
    updated: 'Weekly check; changes when Eurostat publishes new or revised figures', source: 'Eurostat tran_sf_roadus, demo_gind',
  },
  {
    name: 'breakdowns', title: 'Breakdowns',
    contents: 'Road deaths by road user and by mode of transport, per country and year, with the grouping of Eurostat categories and, for the EU, how many Member States reported each year.',
    updated: 'Weekly check', source: 'Eurostat tran_sf_roadus, tran_sf_roadve',
  },
  {
    name: 'latest', title: 'Latest figures',
    contents: 'The latest reference year with the EU and per-country figures used on the overview, and coverage information.',
    updated: 'Weekly check', source: 'Derived from observations.json',
  },
  {
    name: 'legislation', title: 'Legislation register',
    contents: 'EU road safety legal acts (CELEX, title, type, adoption, entry into force, transposition deadlines, in-force status, related acts) and Commission proposals with their status.',
    updated: 'Weekly check', source: 'EUR-Lex metadata (Publications Office SPARQL endpoint)',
  },
  {
    name: 'commitments', title: 'Policy commitments',
    contents: 'EU and global road safety commitments with verbatim quotes and links, their targets, and target values and outcomes calculated from the official figures.',
    updated: 'Recalculated after every statistics update; quotes re-checked monthly', source: 'Official documents (curated); Eurostat',
  },
  {
    name: 'metadata', title: 'Metadata',
    contents: 'Sources with publication and retrieval dates, status vocabulary, the 2030 benchmark, coverage, validation results and revisions since the previous dataset.',
    updated: 'With every data update', source: 'Pipeline',
  },
  {
    name: 'countries', title: 'Countries', contents: 'The 27 Member States with Eurostat and ISO codes.',
    updated: 'Rarely', source: 'Pipeline configuration',
  },
  {
    name: 'indicators', title: 'Indicators', contents: 'Definitions, units and derivation of each indicator.',
    updated: 'Rarely', source: 'Pipeline configuration',
  },
  {
    name: 'pipeline_status', title: 'Pipeline status',
    contents: 'Outcome and time of the most recent recorded update run.', updated: 'With recorded runs', source: 'Pipeline',
  },
];

const PYTHON = `import json, urllib.request

url = "${SITE_DATA_URL}observations.json"
with urllib.request.urlopen(url) as r:
    observations = json.load(r)["observations"]

nl = [o for o in observations
      if o["geo"] == "NL" and o["indicator"] == "road_fatalities"]
print(nl[-1]["period"], nl[-1]["value"], nl[-1]["status"])`;

const R = `library(jsonlite)

obs <- fromJSON("${SITE_DATA_URL}observations.json")$observations
eu <- subset(obs, geo == "EU27_2020" & indicator == "road_fatalities")
tail(eu[, c("period", "value", "status")])`;

export function DataFiles() {
  return (
    <article className="panel prose" aria-labelledby="data-heading">
      <h2 id="data-heading">Open data files</h2>
      <p>
        Everything shown on this site comes from the JSON files below. They are free to download and reuse, and every
        version is kept in the <a href={`${REPO_URL}/commits/main/public/data`}>Git history</a>. Each file has a{' '}
        <a href={SCHEMA_URL}>JSON Schema</a> that the pipeline validates before publishing.
      </p>
      <div className="table-scroll">
        <table className="data-files">
          <caption className="visually-hidden">Published data files</caption>
          <thead>
            <tr><th scope="col">File</th><th scope="col">Contents</th><th scope="col">Updated</th><th scope="col">Source</th></tr>
          </thead>
          <tbody>
            {DATA_FILES.map((f) => (
              <tr key={f.name}>
                <th scope="row">
                  <a href={`${DATA_BASE}${f.name}.json`} download>{f.name}.json</a>
                  <span className="row-note">{f.title} · <a href={`${SCHEMA_URL}/${f.name}.schema.json`}>schema</a></span>
                </th>
                <td>{f.contents}</td>
                <td>{f.updated}</td>
                <td>{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Stable addresses</h3>
      <p>
        Files are always at <code>{SITE_DATA_URL}&lt;name&gt;.json</code>. Field names only change with a new{' '}
        <code>schema_version</code>. Values that are missing at the source are <code>null</code>, never zero.
      </p>

      <h3>Examples</h3>
      <p>Python (standard library only):</p>
      <pre className="code-block"><code>{PYTHON}</code></pre>
      <p>R:</p>
      <pre className="code-block"><code>{R}</code></pre>

      <h3>Reuse and citation</h3>
      <p>
        Statistics: © European Union, Eurostat, reuse subject to the{' '}
        <a href="https://ec.europa.eu/eurostat/about-us/policies/copyright">Eurostat copyright notice</a>. Legislation
        metadata and quoted documents: © European Union, reuse under Commission Decision 2011/833/EU. Cite the official
        source of a figure first; see the <a href="#/about">About page</a> for how to cite this site. Methods are in the{' '}
        <a href="#/methodology">methodology</a>.
      </p>
    </article>
  );
}
