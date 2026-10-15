# Implementation plan

Vision Zero Monitor (formerly “EU Road Safety Vision Zero Observatory”, renamed 2026-10-15).
Scope and pillars: [SCOPE.md](SCOPE.md).

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
* ✅ Failure alerts: failed refresh/deploy opens a `data-refresh-failure` issue; closed on recovery.
* ✅ All actions pinned to Node 24 releases (checkout v7, setup-node v7, setup-python v7, upload-artifact v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5).
* ✅ GitHub Pages enabled with GitHub Actions as source; first deploy succeeded 2026-10-14.
* ⏳ Settings → Actions → General → Workflow permissions: *Read and write* (needed for the data commit), or keep read-only and rely on the explicit `permissions:` block (already set per job).
* ✅ First release merged (PR #1); manual **Update data** run succeeded (outcome `unchanged`).

## Milestone 5 — Quality and release 🔜

* ✅ Unit tests (pytest, vitest) and production build pass locally.
* ✅ Playwright smoke test (optional, local).
* 🔜 Manual accessibility audit with a screen reader (NVDA/VoiceOver) and axe.
* 🔜 Manual mobile review on real devices.
* 🔜 Independent data-integrity review of displayed figures against Eurostat data browser ([checklist](DATA_REVIEW_CHECKLIST.md)).
* ✅ Public URL `https://dalust.github.io/Vision-Zero-Monitor/` serves the site (checked in Chromium after the rename).
* ✅ Relative asset URLs, so renames and custom domains do not require reconfiguration.

## Milestone 6 — Breakdowns ✅

* ✅ Deaths by road user (`tran_sf_roadus` `pers_cat`) and by mode of transport (`tran_sf_roadve`, 27 codes → 8 groups).
* ✅ Coverage-aware EU figures (complete from 2016), unknown-share warnings, partition and pedestrian cross-checks.
* ✅ Road users page; chart builder "Who" filter (e.g. cyclists per million across countries).
* 🔜 Breakdown rows in the data explorer; age and sex breakdowns (`tran_sf_roadus` `age`, `sex`); road type (`tran_sf_roadro`).

## Milestone 7 — Legislation pillar ✅ (first release)

* ✅ R1: source assessment — Publications Office Cellar SPARQL endpoint (DATA_SOURCES.md §6).
* ✅ R2: schema for legal acts, proposals and their lifecycle (`schemas/legislation.schema.json`); validation rules.
* ✅ R3: register built automatically from EuroVoc "road safety" plus three curated additions with stated reasons; weekly refresh in `update-data.yml`, independent of the statistics; failures alert via the same issue.
* ✅ R4: "Legislation" page: acts in force, pending proposals (with unclear statuses separated), upcoming transposition deadlines, filterable register with lifecycle dates and related acts, links to EUR-Lex.
* ✅ Pytest (replay of saved SPARQL responses), Vitest and Playwright tests.
* Acceptance met: every act has a CELEX identifier and EUR-Lex link; dates and statuses are as recorded by the source; no compliance judgements.
* 🔜 Next: timeline view per act; stage of pending proposals in Parliament and Council (needs a source assessment of the Legislative Observatory); national transposition measures (only as published by EUR-Lex, never as a compliance verdict).

## Milestone 8 — Policy commitments pillar 🔜

* 🔜 R5: source assessment for EU and national commitments (policy framework, declarations, national strategies).
* 🔜 R6: schema for commitments and targets; measurable targets linked to outcome series.
* 🔜 R7: "Commitments" page and target-versus-outcome charts.
* Acceptance: each commitment cites its document; target type (binding, indicative, aspirational) is taken from the source.

## Milestone 9 — Wider coverage 🔜

* 🔜 R8: serious injuries and EU road safety KPIs, where comparable official data exist.
* 🔜 R9: EFTA and candidate countries in the statistics pillar.

## Outstanding decisions

| Decision | Current assumption | Who decides |
| --- | --- | --- |
| Status of unflagged Eurostat counts | `unknown` (not silently `final`) | Maintainer / methodologist |
| Inclusion of Commission preliminary figures | Not shown (not machine-readable) | Maintainer |
| Linear benchmark path 2019→2030 | Shown, labelled "analytical benchmark, not official forecast" | Maintainer |
| Custom domain | None; relative base path works for both | Owner |
| Legislation scope | EU-level acts indexed "road safety" + curated additions; national legislation later, if sources allow | Maintainer |
| Stale pending proposals | Flagged as "unclear status" after 5 years without a recorded outcome | Maintainer |
| Curated vs automated sources | Automate where machine-readable; otherwise reviewed, version-controlled files | Maintainer |
| Data license notice | Eurostat reuse policy cited; code MIT | Owner |
