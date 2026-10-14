# Implementation plan

Status legend: ✅ done in this repository · ⏳ requires a repository owner action · 🔜 planned

## Milestone 1 — Repository and source assessment ✅

* ✅ Repository assessment (see ARCHITECTURE.md §1).
* ✅ Architecture document, source inventory (DATA_SOURCES.md), methodology (METHODOLOGY.md).
* Acceptance: documents exist and describe actual, verified endpoints.

## Milestone 2 — Real data ingestion ✅

* ✅ Eurostat JSON-stat fetcher with retries and response size limit.
* ✅ JSON-stat parser, normalization into the observation model, explicit nulls.
* ✅ Derived rate per million from counts + Eurostat average population.
* ✅ JSON Schemas (`schemas/`) + statistical validation + cross-source checks.
* ✅ Revision and coverage diff against the previous committed dataset.
* ✅ Pytest suite using saved real API responses (no network).
* Acceptance: `python -m scripts.data_pipeline.run` produces validated files from the live API; `pytest` passes offline.

## Milestone 3 — First dashboard ✅

* ✅ Header with refresh date, reference period, status, links.
* ✅ KPI cards (latest deaths, YoY, rate, change vs 2019, progress to 2030 benchmark).
* ✅ EU trend chart (count/rate toggle, 2019 baseline, 2030 benchmark, linear benchmark path, provisional markers, data table alternative).
* ✅ Sortable country table with reference-year/completeness warnings.
* ✅ Country detail page.
* ✅ Data freshness panel.
* ✅ Data explorer with filters and CSV export.
* ✅ Methodology and sources pages; loading, empty, error states.

## Milestone 4 — Automation and deployment ✅ / ⏳

* ✅ `update-data.yml` weekly (Mon 06:00 UTC) + `workflow_dispatch`.
* ✅ `deploy.yml` GitHub Pages deployment (push to `main`, manual, reusable).
* ✅ `ci.yml` tests + build on pull requests.
* ⏳ Enable GitHub Pages → Source: *GitHub Actions* (Settings → Pages).
* ⏳ Settings → Actions → General → Workflow permissions: *Read and write* (needed for the data commit), or keep read-only and rely on the explicit `permissions:` block (already set per job).
* ⏳ Merge this branch into `main` to trigger the first deployment.

## Milestone 5 — Quality and release 🔜

* ✅ Unit tests (pytest, vitest) and production build pass locally.
* ✅ Playwright smoke test (optional, local).
* 🔜 Manual accessibility audit with a screen reader (NVDA/VoiceOver) and axe.
* 🔜 Manual mobile review on real devices.
* 🔜 Independent data-integrity review of displayed figures against Eurostat data browser.
* ⏳ Confirm the public URL `https://dalust.github.io/eu-road-safety-observatory/` serves the site.

## Outstanding decisions

| Decision | Current assumption | Who decides |
| --- | --- | --- |
| Status of unflagged Eurostat counts | `unknown` (not silently `final`) | Maintainer / methodologist |
| Inclusion of Commission preliminary figures | Not shown (not machine-readable) | Maintainer |
| Linear benchmark path 2019→2030 | Shown, labelled "analytical benchmark, not official forecast" | Maintainer |
| Custom domain | None; relative base path works for both | Owner |
| Data license notice | Eurostat reuse policy cited; code MIT | Owner |
