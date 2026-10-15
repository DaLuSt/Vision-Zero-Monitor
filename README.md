# Vision Zero Monitor

**Open-source platform monitoring Europe's road safety progress, legislation, policy commitments, and progress towards Vision Zero.**

**🌐 Live site: [dalust.github.io/Vision-Zero-Monitor](https://dalust.github.io/Vision-Zero-Monitor/)**

[![Deploy to GitHub Pages](https://github.com/DaLuSt/Vision-Zero-Monitor/actions/workflows/deploy.yml/badge.svg)](https://github.com/DaLuSt/Vision-Zero-Monitor/actions/workflows/deploy.yml)
[![Update data](https://github.com/DaLuSt/Vision-Zero-Monitor/actions/workflows/update-data.yml/badge.svg)](https://github.com/DaLuSt/Vision-Zero-Monitor/actions/workflows/update-data.yml)

Vision Zero is the EU's long-term ambition of moving close to zero road deaths by 2050, with an
interim objective of halving road deaths and serious injuries between 2020 and 2030.
Vision Zero Monitor brings together the evidence needed to follow that journey: what is
happening on the roads, which rules apply, and what governments have committed to. Every
figure and every claim links back to an official source.

* **Static site** (React + TypeScript + Vite + Recharts) on GitHub Pages: no backend, no API keys, no analytics.
* **Reproducible data pipeline** (Python) pulls official data every Monday, validates it, and commits versioned JSON.
* **Every figure is traceable**: each observation carries its source, status flag, publication date and retrieval date.

> Official fatality statistics are published periodically. This dashboard checks for
> updated data weekly; the underlying figures are not necessarily weekly.

## Scope and status

| Pillar | What it covers | Status |
| --- | --- | --- |
| **Road safety progress** | Official road deaths for the 27 EU Member States, rates per million, trends since 1999, deaths by road user and mode of transport | ✅ Live |
| **Progress towards Vision Zero** | 2030 fatality benchmark (−50 %) measured from 2019 as in the Commission's own monitoring, progress share and an analytical straight-line path | ✅ Live (fatalities only; serious injuries not yet covered) |
| **Legislation** | EU road safety acts and pending Commission proposals: adoption, entry into force, in-force status, transposition deadlines, amendments and repeals, linked to EUR-Lex | ✅ Live (EU acts) |
| **Policy commitments** | EU and global targets and declarations, quoted from the official texts and compared with the official figures | ✅ Live (EU and global; national strategies planned) |

Geographic coverage today is the **EU-27**. Extending it to other European countries
(EFTA, candidate countries) is planned where comparable official data exist. Planned
pillars follow the same rules as the statistics: official sources only, provenance on
every item, and no interpretation presented as fact. See [docs/SCOPE.md](docs/SCOPE.md).

### Live pages

[Overview](https://dalust.github.io/Vision-Zero-Monitor/) ·
[Countries](https://dalust.github.io/Vision-Zero-Monitor/#/countries) ·
[Road users](https://dalust.github.io/Vision-Zero-Monitor/#/road-users) ·
[Chart builder](https://dalust.github.io/Vision-Zero-Monitor/#/charts) ·
[Data explorer](https://dalust.github.io/Vision-Zero-Monitor/#/explorer) ·
[Legislation](https://dalust.github.io/Vision-Zero-Monitor/#/legislation) ·
[Commitments](https://dalust.github.io/Vision-Zero-Monitor/#/commitments) ·
[Methodology](https://dalust.github.io/Vision-Zero-Monitor/#/methodology) ·
[Sources & freshness](https://dalust.github.io/Vision-Zero-Monitor/#/sources)

| Question | Where |
| --- | --- |
| How many people die on EU roads? | Overview KPI cards (latest reference year, EU27) |
| How has this changed? | EU trend chart (1999→), deaths or per million inhabitants |
| Which Member States have the highest rates? | Countries: sortable table + per-country detail |
| Who dies: pedestrians, cyclists, motorcyclists…? | [Road users](https://dalust.github.io/Vision-Zero-Monitor/#/road-users): deaths by road user and by mode of transport, latest year and trends, per country |
| How does my country compare? | [Chart builder](https://dalust.github.io/Vision-Zero-Monitor/#/charts): graphs for the EU total and any Member States, for all deaths or one group (e.g. cyclists), as deaths, per million or index 2019 = 100; PNG/CSV download; shareable link |
| Is the EU on course for 2030? | 2030 benchmark (−50 %) from 2019, progress share, linear analytical path; both baselines (2019 and the stated 2020) on the commitments page |
| Which EU road safety rules apply, and what is in the pipeline? | [Legislation](https://dalust.github.io/Vision-Zero-Monitor/#/legislation): acts in force, pending Commission proposals, upcoming transposition deadlines, searchable register with links to EUR-Lex |
| What has the EU committed to, and how do the figures compare? | [Commitments](https://dalust.github.io/Vision-Zero-Monitor/#/commitments): EU and global targets quoted word for word, target values next to official figures, chart of EU road deaths against every measurable target |
| Where are data incomplete or uncertain? | Status badges, data freshness panel, validation warnings, data explorer + CSV |

## Data sources

| Dataset | Use |
| --- | --- |
| Eurostat [`tran_sf_roadus`](https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table) (CARE / DG MOVE) | Road deaths, EU27 + Member States; deaths by road user |
| Eurostat [`tran_sf_roadve`](https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadve/default/table) | Deaths by mode of transport |
| Eurostat [`demo_gind`](https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table) (`AVG`) | Average population → rates per million |
| Eurostat [`sdg_11_40`](https://ec.europa.eu/eurostat/databrowser/view/sdg_11_40/default/table) | Independent cross-check |
| Official policy documents (Commission, Council, UN; listed in [DATA_SOURCES.md §7](docs/DATA_SOURCES.md)) | Policy commitments: verbatim quotes and targets, curated in `data/curated/commitments.json` |
| Publications Office of the EU, [Cellar SPARQL endpoint](https://publications.europa.eu/webapi/rdf/sparql) (EUR-Lex metadata) | Legislation register: acts indexed EuroVoc “road safety” + curated additions |

Details: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) (including candidate sources for the
planned pillars). Definitions and calculations: [docs/METHODOLOGY.md](docs/METHODOLOGY.md).
Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Manual spot-check against the sources:
[docs/DATA_REVIEW_CHECKLIST.md](docs/DATA_REVIEW_CHECKLIST.md). Scope and roadmap:
[docs/SCOPE.md](docs/SCOPE.md). Plan and status: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Requirements

* Node.js ≥ 20 (CI uses 22) and npm
* Python ≥ 3.11 (CI uses 3.12)

## Local development

```bash
# Frontend
npm ci
npm run dev            # http://localhost:5173
npm test               # Vitest unit/component tests
npm run typecheck
npm run build          # production build in dist/
npm run preview

# Optional end-to-end smoke tests (after npm run build)
npx playwright install chromium   # or set PLAYWRIGHT_CHROMIUM_PATH to an existing Chromium
npm run test:e2e

# Data pipeline
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.lock
python -m pytest                                   # offline, uses saved real API responses
python -m scripts.data_pipeline.run                # fetch live data → public/data/
python -m scripts.data_pipeline.run --save-raw data/raw     # also keep raw responses
python -m scripts.data_pipeline.run --from-raw tests/fixtures/eurostat_2026-10-14  # offline replay

# Legislation register (EUR-Lex metadata via SPARQL)
python -m scripts.legislation.run                  # query live → public/data/legislation.json
python -m scripts.legislation.run --from-raw tests/fixtures/legislation_2026-10-15  # offline replay

# Policy commitments (curated) → targets measured against the official figures
python -m scripts.commitments.build
python -m scripts.commitments.verify_sources       # re-check every quote (network, needs pdftotext)
```

Both pipelines exit `0` when data were updated or unchanged and `1` on failure. On
failure existing data files are never replaced by partial or invalid output (the
statistics pipeline records the failure in `public/data/pipeline_status.json`).

## Repository layout

```
.github/workflows/   ci.yml · update-data.yml (weekly) · deploy.yml (Pages)
docs/                SCOPE · ARCHITECTURE · DATA_SOURCES · METHODOLOGY · IMPLEMENTATION_PLAN
schemas/             JSON Schemas for every public data file
scripts/data_pipeline/
  config.py          sources, geography, indicators, target, breakdown mapping, thresholds
  fetch.py           HTTP retrieval (retries, size limit)
  jsonstat.py        defensive JSON-stat parser
  transform.py       normalisation, derived rates, status mapping, summaries
  breakdowns.py      deaths by road user and mode of transport (grouped, coverage-aware)
  validate.py        schema, statistical, cross-source and revision checks
  export.py          atomic file writes
  run.py             orchestration / CLI
scripts/legislation/ EUR-Lex metadata → legislation.json (SPARQL queries, register, validation, CLI)
scripts/commitments/ curated commitments + observations → commitments.json; quote verification
data/curated/        hand-curated, reviewed inputs (commitments.json)
scripts/ci/          failure-alert script used by the weekly workflow
public/data/         published, validated JSON (versioned in Git)
src/                 React app (components/, features/, lib/, types/)
tests/               pytest suite + saved Eurostat and SPARQL responses
e2e/                 Playwright smoke tests
```

## Deployment (GitHub Pages)

One-time repository settings:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions:** the workflows declare
   their own minimal `permissions:`; the data job needs `contents: write` to push to
   `main`. If `main` is protected, allow `github-actions[bot]` to push or change the
   update job to open a pull request instead. The alert job needs `issues: write`
   (declared in the workflow) to open the failure issue.
3. Merge to `main`. `deploy.yml` runs on every push to `main`: it runs the Python and
   frontend tests, builds the site and deploys it.
4. Optional: **Actions → Update data → Run workflow** to trigger a refresh manually.

The build uses relative asset URLs, so the same build works at
`https://dalust.github.io/Vision-Zero-Monitor/`, on a custom domain, or under any
other repository name, without reconfiguration. A validated dataset is committed in
`public/data/`, so a first deployment works before any scheduled run. To force an
absolute base path, build with `VITE_BASE_PATH=/your/path/ npm run build`.

## How the weekly refresh works

`update-data.yml` runs every **Monday 06:00 UTC** and on demand:

1. Fetch the four Eurostat datasets and query EUR-Lex metadata for the legislation
   register (raw responses uploaded as a 30-day artifact).
2. Parse JSON-stat, normalise to observations and breakdowns, derive rates, map status flags.
3. Validate (schemas, invariants, cross-checks, revisions vs. the last published data).
4. If the content hash is unchanged → no commit, no deploy.
5. If changed and valid → run the test suite, commit `public/data/`, push to `main`,
   then call `deploy.yml`.
6. If anything fails → previous data kept, failure recorded in
   `pipeline_status.json` (committed and deployed so the site shows it), job fails red.
   The statistics and the legislation register are independent: a failure in one does
   not stop the other from updating.
7. A failed refresh or deploy opens a GitHub issue labelled `data-refresh-failure`
   (or comments on the one already open); the next successful run closes it.
   Watch the repository's issues to get these alerts by email.

## Known limitations

* Statistics are annual with a lag; the latest reference year (2024 as of Oct 2026)
  is ~20 months old. The Commission's preliminary figures for the most recent year
  are not machine-readable and are not shown.
* Coverage is the EU-27 only; other European countries are not yet included.
* Eurostat publishes no status flags for death counts, so they display as
  “No status flag” rather than “final”.
* The fatality benchmark does not cover the serious-injury half of the 2030 objective.
* Eurostat's published EU per-million rate in `tran_sf_roadus` is inconsistent with its
  counts; rates are derived instead (see DATA_SOURCES.md).
* EU breakdowns by road user and mode of transport are comparable only from 2016.
* The dashboard shows the most recent *recorded* pipeline run; unchanged runs are not
  committed (full history is in GitHub Actions).
* The legislation register covers EU-level acts only. It shows dates and statuses as
  recorded in EUR-Lex metadata, not the stage of a proposal in Parliament or Council, and
  it does not assess Member State compliance. Its selection follows the Publications
  Office's “road safety” indexing plus a short curated list.
* Policy commitments cover EU and global documents; national road safety strategies are not
  yet included, and serious-injury targets cannot be measured until MAIS3+ data are covered.

## Contributing

Issues and pull requests are welcome. New data sources need a source assessment in
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) and, for the planned pillars, must follow the
principles in [docs/SCOPE.md](docs/SCOPE.md).

## License

Code: [MIT](LICENSE). Data: © European Union, Eurostat — reuse subject to the
[Eurostat copyright notice](https://ec.europa.eu/eurostat/about-us/policies/copyright).
Legislation metadata: © European Union, EUR-Lex — reuse under Commission Decision 2011/833/EU.
Vision Zero Monitor is an independent project, not affiliated with or endorsed by the
European Commission.

*Formerly “EU Road Safety Vision Zero Observatory”; the old repository URL redirects here.*
