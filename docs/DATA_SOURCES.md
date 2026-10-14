# Data sources

Source inventory as verified on **2026-10-14** against the live endpoints. Values
quoted below come from that day's API responses, which are saved in
`tests/fixtures/eurostat_2026-10-14/`.

## Summary

| Source | Machine-readable | Official | Prelim./final | Cadence | National comparison | Used |
| --- | --- | --- | --- | --- | --- | --- |
| Eurostat `tran_sf_roadus` | ✅ API (JSON-stat) | ✅ | Unflagged (see below) | Annual, ~once a year | ✅ 27 MS + EU27, 1999→ | **Primary** |
| Eurostat `demo_gind` (AVG) | ✅ API | ✅ | Flags `p`, `e`, `b` | Annual (+ revisions) | ✅ | Denominator |
| Eurostat `sdg_11_40` | ✅ API | ✅ | Counts unflagged; rates flagged | Annual | ✅ 2000→ | Cross-check only |
| DG MOVE "Road safety statistics 2025" page | ❌ (figures are images/HTML) | ✅ | **Preliminary** | Annual (spring) | Partly | Not used |
| ERSO "Data and analysis" `.xlsx` (`fatalities_per_pop_2010-24_public`) | ⚠️ manual download | ✅ | Final (CARE) | Annual | ✅ | Not used (duplicates CARE data in Eurostat) |
| CARE database (raw) | ❌ restricted access | ✅ | — | — | — | Not used |

## 1. Eurostat — `tran_sf_roadus` (primary)

* **Publisher:** Eurostat; data compiled by European Commission DG MOVE from the
  CARE (Community database on road accidents) database
  (`SOURCE_INSTITUTIONS` annotation of the API response).
* **Title:** Persons killed in road accidents by age, sex and category of persons involved.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table
* **API endpoint:**
  `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?format=JSON&lang=EN&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR&unit=P_MHAB&geo=EU27_2020&geo=BE&…&geo=SE`
* **Metadata:** https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm
* **Dimensions:** `freq` (A), `sex` (T/M/F/UNK), `age` (TOTAL + 7 bands), `unit`
  (`NR` number, `P_MHAB` per million inhabitants), `pers_cat` (TOTAL, PAS, DRIV, PED, UNK),
  `geo` (EU27_2020, 27 MS, EFTA, candidates, UK), `time` (1999–2024).
* **Variables used:** `NR` with `sex=T, age=TOTAL, pers_cat=TOTAL`.
* **Geography:** `EU27_2020` and the 27 Member States (Eurostat codes; Greece = `EL`).
* **Reference period:** calendar years 1999–2024 (`OBS_PERIOD_OVERALL_LATEST` = 2024).
* **Publication date:** `UPDATE_DATA` annotation = 2026-08-25T23:00:00+02:00.
* **Status:** the response contains **no observation status flags** at all.
  Values are therefore mapped to `unknown` (see METHODOLOGY.md).
* **Cadence:** annual, following DG MOVE's release (ESMS §8.1 “Following DG MOVE”).
  Reference year *t* typically appears in the second half of year *t+1* or later.
* **Definition:** killed immediately or dying within 30 days, excluding suicides;
  correction coefficients for countries not using the 30-day definition (ESMS).
* **Known limitations:**
  * The EU27_2020 value for `unit=P_MHAB` is **inconsistent** with the dataset's own
    counts: e.g. 2024 shows 15 per million while 19,933 deaths ÷ ~450 million
    inhabitants ≈ 44 per million (all 26 years affected). Member State `P_MHAB`
    values are integers and occasionally differ by 1–6 % from counts ÷ average
    population (different denominator/rounding). **This project therefore derives
    rates itself** and reports the inconsistency as a validation warning.
  * The EU27 aggregate for 2003 differs from the sum of Member States by 1 death
    (warning, not corrected).
* **License:** Eurostat reuse policy (Commission Decision 2011/833/EU): free reuse
  with acknowledgement of the source. https://ec.europa.eu/eurostat/about-us/policies/copyright
* **Transformations:** JSON-stat → flat cells; one observation per geo × year
  (explicit `null` + `status: "missing"` where no value); integer check;
  `UPDATE_DATA` converted to UTC → `source_published_at`.

## 2. Eurostat — `demo_gind` (rate denominator)

* **Title:** Population change – demographic balance and crude rates at national level.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table
* **API endpoint:** `…/data/demo_gind?format=JSON&lang=EN&indic_de=AVG&sinceTimePeriod=1999&geo=…`
* **Variable:** `indic_de=AVG` — average population of the year (mean of 1 January
  of the year and the next year). This is the same denominator Eurostat uses for
  `sdg_11_40`.
* **Status:** flagged; e.g. EU27_2020 2024 = 450,068,417 with flag `ep`
  (estimated, provisional); France 2023–2025 `p`.
* **Publication date:** `UPDATE_DATA` = 2026-09-30T23:00:00+02:00.
* **Transformation:** used as `population_average` observations and as the
  denominator of `road_fatalities_per_million` (see METHODOLOGY.md).

## 3. Eurostat — `sdg_11_40` (cross-check)

* **Title:** Road traffic deaths, by type of roads.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/sdg_11_40/default/table
* **API endpoint:** `…/data/sdg_11_40?format=JSON&lang=EN&tra_infr=TOTAL&unit=NR&unit=RT&geo=…`
* **Variables:** `NR` (number), `RT` (rate per 100,000, one decimal, flagged).
* **Coverage:** 2000–2024. Rates carry flags `b`, `e`, `p` derived from population.
* **Use:** not published. Every run checks that (a) `NR` equals `tran_sf_roadus`
  counts and (b) our derived rate ÷ 10 is within 0.06 of `RT`. On 2026-10-14 both
  checks passed for **every** geo × year — independent confirmation of the counts
  and of the derived rates.

## 4. European Commission DG MOVE / European Road Safety Observatory

* **Road safety statistics 2025 in more detail:**
  https://transport.ec.europa.eu/background/road-safety-statistics-2025_en —
  contains **preliminary 2025** figures (EU and per country), but as figures/images
  and narrative HTML; one HTML table (Serbia only). Not machine-readable in a stable
  form, so not ingested.
* **ERSO data and analysis:**
  https://road-safety.transport.ec.europa.eu/european-road-safety-observatory/data-and-analysis_en —
  links an `.xlsx` (`fatalities_per_pop_2010-24_public`) with final CARE figures;
  these duplicate what Eurostat disseminates via the API.
* **Collision matrix:**
  https://road-safety.transport.ec.europa.eu/european-road-safety-observatory/data-and-analysis/collision-matrix_en —
  PDF only.

**Possible future use:** a clearly separated, manually imported
`preliminary_fatalities` series (source id `ec:dgmove_preliminary_<year>`), with its
own provenance and `status: "provisional"`, never merged into the Eurostat series.

## Provenance in the published files

* Every observation carries `source_id`, `source_url`, `source_published_at` and
  `retrieved_at`.
* `metadata.json → sources[]` records publisher, dataset id, browser URL, the exact
  API request URL, metadata URL, publication and retrieval timestamps, latest
  period in source, Eurostat flag labels and reuse terms.
* Raw API responses of each scheduled run are uploaded as a workflow artifact
  (30-day retention).
