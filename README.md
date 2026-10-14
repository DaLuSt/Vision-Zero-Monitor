# EU Road Safety Vision Zero Observatory

**🌐 Live dashboard: [dalust.github.io/eu-road-safety-observatory](https://dalust.github.io/eu-road-safety-observatory/)**

[![Deploy to GitHub Pages](https://github.com/DaLuSt/eu-road-safety-observatory/actions/workflows/deploy.yml/badge.svg)](https://github.com/DaLuSt/eu-road-safety-observatory/actions/workflows/deploy.yml)
[![Update data](https://github.com/DaLuSt/eu-road-safety-observatory/actions/workflows/update-data.yml/badge.svg)](https://github.com/DaLuSt/eu-road-safety-observatory/actions/workflows/update-data.yml)

An independent, open-source dashboard that tracks **official road fatality statistics**
for the 27 EU Member States and progress towards the EU's 2030 road-death benchmark,
on the way to Vision Zero (close to zero road deaths by 2050).

* **Static site** (React + TypeScript + Vite + Recharts) on GitHub Pages: no backend, no API keys, no analytics.
* **Reproducible data pipeline** (Python) pulls Eurostat's dissemination API every Monday, validates, and commits versioned JSON.
* **Every figure is traceable**: each observation carries its source, Eurostat status flag, publication date and retrieval date.

> Official fatality statistics are published periodically. This dashboard checks for
> updated data weekly; the underlying figures are not necessarily weekly.

Direct links: [Overview](https://dalust.github.io/eu-road-safety-observatory/) ·
[Countries](https://dalust.github.io/eu-road-safety-observatory/#/countries) ·
[Chart builder](https://dalust.github.io/eu-road-safety-observatory/#/charts) ·
[Data explorer](https://dalust.github.io/eu-road-safety-observatory/#/explorer) ·
[Methodology](https://dalust.github.io/eu-road-safety-observatory/#/methodology) ·
[Sources & freshness](https://dalust.github.io/eu-road-safety-observatory/#/sources)

## What it shows

| Question | Where |
| --- | --- |
| How many people die on EU roads? | Overview KPI cards (latest reference year, EU27) |
| How has this changed? | EU trend chart (1999→), deaths or per million inhabitants |
| Which Member States have the highest rates? | Countries: sortable table + per-country detail |
| How does my country compare? | [Chart builder](https://dalust.github.io/eu-road-safety-observatory/#/charts): graphs for the EU total and any Member States (deaths, per million, or index 2019 = 100), combined or one per selection, downloadable as PNG/CSV, shareable by link |
| Is the EU on course for 2030? | 2019 baseline, 2030 benchmark (−50 %), progress share, linear analytical path |
| Where are data incomplete or uncertain? | Status badges, data freshness panel, validation warnings, data explorer + CSV |

## Data sources

| Dataset | Use |
| --- | --- |
| Eurostat [`tran_sf_roadus`](https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table) (CARE / DG MOVE) | Road deaths, EU27 + Member States |
| Eurostat [`demo_gind`](https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table) (`AVG`) | Average population → rates per million |
| Eurostat [`sdg_11_40`](https://ec.europa.eu/eurostat/databrowser/view/sdg_11_40/default/table) | Independent cross-check |

Details: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Definitions and calculations:
[docs/METHODOLOGY.md](docs/METHODOLOGY.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Plan and status: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

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
```

The pipeline exits `0` when data were updated or unchanged and `1` on failure. On
failure it only writes `public/data/pipeline_status.json`; existing data files are
never replaced by partial or invalid output.

## Repository layout

```
.github/workflows/   ci.yml · update-data.yml (weekly) · deploy.yml (Pages)
docs/                ARCHITECTURE · DATA_SOURCES · METHODOLOGY · IMPLEMENTATION_PLAN
schemas/             JSON Schemas for every public data file
scripts/data_pipeline/
  config.py          sources, geography, indicators, target, thresholds
  fetch.py           HTTP retrieval (retries, size limit)
  jsonstat.py        defensive JSON-stat parser
  transform.py       normalisation, derived rates, status mapping, summaries
  validate.py        schema, statistical, cross-source and revision checks
  export.py          atomic file writes
  run.py             orchestration / CLI
public/data/         published, validated JSON (versioned in Git)
src/                 React app (components/, features/, lib/, types/)
tests/               pytest suite + saved Eurostat responses
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
   frontend tests, builds with the base path reported by `actions/configure-pages`
   (`/eu-road-safety-observatory/`), and deploys.
4. Optional: **Actions → Update data → Run workflow** to trigger a refresh manually.

A validated dataset is committed in `public/data/`, so the first deployment works
before any scheduled run. For a custom domain, configure it in Settings → Pages; the
base path then becomes `/` automatically. For other hosts, build with
`VITE_BASE_PATH=/your/path/ npm run build` (default `./`, relative URLs).

## How the weekly refresh works

`update-data.yml` runs every **Monday 06:00 UTC** and on demand:

1. Fetch the three Eurostat datasets (raw responses uploaded as a 30-day artifact).
2. Parse JSON-stat, normalise to observations, derive rates, map status flags.
3. Validate (schemas, invariants, cross-checks, revisions vs. the last published data).
4. If the content hash is unchanged → no commit, no deploy.
5. If changed and valid → run the test suite, commit `public/data/`, push to `main`,
   then call `deploy.yml`.
6. If anything fails → previous data kept, failure recorded in
   `pipeline_status.json` (committed and deployed so the site shows it), job fails red.
7. A failed refresh or deploy opens a GitHub issue labelled `data-refresh-failure`
   (or comments on the one already open); the next successful run closes it.
   Watch the repository's issues to get these alerts by email.

## Known limitations

* Statistics are annual with a lag; the latest reference year (2024 as of Oct 2026)
  is ~20 months old. The Commission's preliminary figures for the most recent year
  are not machine-readable and are not shown.
* Eurostat publishes no status flags for death counts, so they display as
  “No status flag” rather than “final”.
* The fatality benchmark does not cover the serious-injury half of the 2030 objective.
* Eurostat's published EU per-million rate in `tran_sf_roadus` is inconsistent with its
  counts; rates are derived instead (see DATA_SOURCES.md).
* The dashboard shows the most recent *recorded* pipeline run; unchanged runs are not
  committed (full history is in GitHub Actions).

## License

Code: [MIT](LICENSE). Data: © European Union, Eurostat — reuse subject to the
[Eurostat copyright notice](https://ec.europa.eu/eurostat/about-us/policies/copyright).
This project is not affiliated with or endorsed by the European Commission.
