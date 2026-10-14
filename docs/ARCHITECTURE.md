# Architecture

EU Road Safety Vision Zero Observatory is a static-first, open-source dashboard.
It has no backend server, database, API keys or paid services.

## 1. Repository assessment (2026-10-14)

| Item | Finding |
| --- | --- |
| Existing code | None. The repository contained only a one-line `README.md`. |
| Default branch | `main` |
| Package manager | None present; **npm** chosen (ships with Node, lockfile `package-lock.json`). |
| Framework | None present; recommended stack adopted (React + TypeScript + Vite + Recharts). |
| Python | None present; pipeline written for Python ≥ 3.11 (CI uses 3.12). |
| CI / workflows | None present; three workflows added (`ci.yml`, `update-data.yml`, `deploy.yml`). |
| License | None present; MIT added for code. Data remain under Eurostat reuse terms. |
| Data files | None present; real Eurostat data generated and committed. |

## 2. System diagram

```
 Eurostat dissemination API (JSON-stat 2.0, no key)
   ├─ tran_sf_roadus   road deaths (counts), CARE via DG MOVE
   ├─ demo_gind        average population (rate denominator)
   └─ sdg_11_40        cross-check only (counts + flagged rates)
          │
          ▼
 GitHub Actions: update-data.yml  (Mon 06:00 UTC + manual)
          │
          ▼
 scripts/data_pipeline/fetch.py      HTTP GET, retries, size limit, raw JSON-stat
          │
          ▼
 scripts/data_pipeline/jsonstat.py   JSON-stat → flat cells (value + flag)
 scripts/data_pipeline/transform.py  normalize, explicit nulls, derived rates, status mapping
          │
          ▼
 scripts/data_pipeline/validate.py   JSON Schema + statistical invariants
                                     + cross-source checks + revision/coverage diff
          │ (hard failure → stop, keep previous files)
          ▼
 scripts/data_pipeline/export.py     write to temp dir → atomic replace of public/data/*
          │
          ▼
 git commit (only if content changed) → push to main
          │
          ▼
 deploy.yml (workflow_call)          npm ci → test → vite build → GitHub Pages
          │
          ▼
 Public static dashboard  (React; reads ./data/*.json at runtime)
```

Ingestion, transformation, validation, export and rendering are separate
modules. The frontend never talks to Eurostat; it only reads the committed,
validated JSON files that are deployed alongside it.

## 3. Data model

The pipeline normalizes everything into a single **observation** shape (long format):

```json
{
  "geo": "NL", "geo_name": "Netherlands",
  "indicator": "road_fatalities", "period": "2024", "frequency": "annual",
  "value": 566, "unit": "persons",
  "status": "unknown", "source_flag": null,
  "source_id": "eurostat:tran_sf_roadus",
  "source_url": "https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table",
  "source_published_at": "2026-08-25T21:00:00Z",
  "retrieved_at": "2026-10-14T18:30:00Z"
}
```

Uniqueness key: `(geo, indicator, period, frequency)`.

Entities (generated JSON files in `public/data/`):

| File | Content |
| --- | --- |
| `observations.json` | All observations (EU27_2020 + 27 Member States, all available years, 3 indicators). Missing values are explicit `null` with `status: "missing"`. |
| `countries.json` | Member State codes (Eurostat geo codes, e.g. `EL` for Greece), ISO 3166-1 alpha-2 (`GR`), names. |
| `indicators.json` | Indicator definitions, units, derivation. |
| `metadata.json` | Schema version, `generated_at`, sources (URLs, dataset ids, publication + retrieval timestamps), targets, coverage, validation results, revision summary. |
| `latest.json` | Concise summary: latest EU figures, baseline, target, per-country latest values. |
| `pipeline_status.json` | Outcome of the last recorded pipeline run (written on success *and* failure). |

JSON Schemas for each file live in `schemas/` and are enforced by the pipeline
(`validate.py`) and by CI (`pytest`).

### Three dates

* `period` (reference period): the year the deaths occurred.
* `source_published_at`: Eurostat's `UPDATE_DATA` timestamp for the dataset.
* `retrieved_at`: when the pipeline downloaded the dataset.

## 4. Source assessment (summary)

See [`DATA_SOURCES.md`](DATA_SOURCES.md) for full detail.

| Source | Machine-readable | Used for |
| --- | --- | --- |
| Eurostat `tran_sf_roadus` | Yes (API) | Primary: annual road deaths, EU27 + Member States, 1999→ |
| Eurostat `demo_gind` (AVG) | Yes (API) | Denominator for rates per million |
| Eurostat `sdg_11_40` | Yes (API) | Cross-check of counts and rates (warnings only) |
| DG MOVE / ERSO statistics pages | Partly (one `.xlsx`; preliminary data as images/HTML) | Not ingested; documented for future manual import |

## 5. Deployment design

* **Hosting:** GitHub Pages via the official Actions flow
  (`configure-pages` → `upload-pages-artifact` → `deploy-pages`).
* **Base path:** `VITE_BASE_PATH` (defaults to `./`, i.e. relative URLs, which work
  for both project sites and custom domains). The deploy workflow passes the
  base path reported by `configure-pages`.
* **Routing:** hash-based (`#/countries/NL`) so deep links never 404 on Pages.
* **Ordering:** data are committed to `main` first; the site is then built from
  that commit. The `update-data` workflow calls `deploy.yml` as a reusable
  workflow only when data changed (pushes made with `GITHUB_TOKEN` do not
  trigger other workflows, so there is no double deploy). Human pushes to `main`
  trigger `deploy.yml` directly.
* **First deployment:** a real, validated dataset is committed in the repository,
  so the very first deploy works before any scheduled run.
* **Failure isolation:** the build only ever reads committed data; a failed
  pipeline run never touches `observations.json` etc.

## 6. Failure behaviour

1. Fetch errors, schema errors or hard validation failures abort the run before
   any data file is replaced.
2. Files are written to a temporary directory and moved into place with
   `os.replace` only after validation passes.
3. `pipeline_status.json` records `last_outcome: "failure"` and the error message;
   the workflow commits it so the dashboard can display the failed run, then
   exits non-zero so the run is red in GitHub Actions.
4. If the regenerated data are byte-identical (ignoring retrieval timestamps),
   nothing is committed and nothing is deployed.

## 7. Limitations

* Official EU road-death statistics are **annual**, published with a lag of
  roughly 18–20 months by Eurostat. Weekly runs detect updates; they do not
  produce weekly figures.
* Eurostat publishes no observation status flag for death counts. These
  values are mapped to `status: "unknown"` (see METHODOLOGY.md).
* The EU aggregate per-million rate in `tran_sf_roadus` is inconsistent with its
  own counts (see DATA_SOURCES.md). Rates are therefore derived from counts and
  official average population, and cross-checked against `sdg_11_40`.
* The Commission's preliminary figures for the most recent year are not
  available in a machine-readable form and are not shown.
* Serious injuries (part of the 2030 target) are not covered.
* Pipeline status shown on the site is the last *recorded* outcome; runs whose
  outcome and data did not change are not committed (see METHODOLOGY.md).
