# Data review checklist: spot-check against the official sources

An independent, manual check that the figures shown on Vision Zero Monitor match the
official sources. It complements the automated validation in the pipeline: the pipeline
checks the data against itself and against other Eurostat tables; this checklist checks
what a visitor actually sees against what Eurostat and EUR-Lex publish.

**Who:** ideally someone who did not build the pipeline. **Time:** about 45 minutes.
**When:** before presenting the site as a reference source, and after any change to the
pipeline, the data mapping or the display of figures.

## How to use it

1. Note the review details below. Checks must be done against the dataset version shown on
   the site's **Sources & freshness** page; if Eurostat has published a newer release since,
   the site and the source can legitimately differ until the next weekly refresh.
2. For each row, look the value up on the **site** (column *Where on the site*) and at the
   **source** (column *Source*), and compare both with *Expected*.
3. Tick ✅ when site and source agree, ❌ when they do not, and note the difference.
4. Any ❌: open an issue on GitHub with the row number, both values and links.

**Pass rules**

* Death counts: exact match.
* Rates per million: within ±0.1 (rounding). The site *calculates* rates as
  deaths ÷ average population × 1,000,000, so check the calculation, not Eurostat's own
  per-million column (see note R).
* Dates (legislation): exact match.
* Status labels: the label on the site matches the Eurostat flag (`p` provisional,
  `e` estimated, `b` break in series; no flag → “No status flag”).

**Source links.** *Data browser* links open Eurostat's table viewer (set the filters named in
the row). *API* links return the number directly as JSON: look for `"value":{"0": …}`.

## Review details

| | |
| --- | --- |
| Reviewer | |
| Date of review | |
| Site version (date on *Sources & freshness*, “Data retrieved”) | |
| Eurostat release of `tran_sf_roadus` (shown on *Sources & freshness*) | |
| Result | ☐ All passed ☐ Issues found (links): |

Expected values below were taken from the published data on **15 Oct 2026** (Eurostat
release of `tran_sf_roadus` and `tran_sf_roadve`: 25 Aug 2026; `demo_gind` and `sdg_11_40`:
30 Sep 2026). If the site shows a newer release, update the *Expected* column from the
site first, then compare with the source.

## A. Road deaths (counts) — `tran_sf_roadus`

Filters in the data browser: *sex* Total, *age* Total, *category of person* Total,
*unit* Number.

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| A1 | EU-27 deaths, latest year (2024) | Overview, first KPI card | [Data browser](https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table?lang=en) · [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=EU27_2020&time=2024&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 19,933 | ☐ |
| A2 | EU-27 deaths, baseline year 2019 | Overview, EU trend chart (data table) | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=EU27_2020&time=2019&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 22,757 | ☐ |
| A3 | Netherlands, 2024 | Countries table, row Netherlands | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=NL&time=2024&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 566 | ☐ |
| A4 | Germany, 2024 | Countries table, row Germany | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=DE&time=2024&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 2,770 | ☐ |
| A5 | Romania, 2024 | Countries → Romania | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=RO&time=2024&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 1,478 | ☐ |
| A6 | Malta, 2024 (small country) | Countries → Malta | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=MT&time=2024&sex=T&age=TOTAL&pers_cat=TOTAL&unit=NR) | 12 | ☐ |
| A7 | One country and year of your own choice | Data explorer | Data browser | (from the site) | ☐ |

## B. Rates per million inhabitants

The site derives rates from deaths (A) and Eurostat's average population
(`demo_gind`, indicator *Average population – whole year*). Cross-check with
`sdg_11_40`, which publishes the same rate **per 100,000** inhabitants (divide the site's
value by 10).

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| B1 | Netherlands 2024: recompute 566 ÷ average population × 1,000,000 | Countries table, rate column | [Population API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_gind?geo=NL&indic_de=AVG&time=2024) (17,993,485) | 31.5 | ☐ |
| B2 | Netherlands 2024 vs `sdg_11_40` | same | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sdg_11_40?geo=NL&time=2024&tra_infr=TOTAL&unit=RT) | 3.1 per 100,000 (≈ 31) | ☐ |
| B3 | EU-27 2024 vs `sdg_11_40` | Overview, rate KPI | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sdg_11_40?geo=EU27_2020&time=2024&tra_infr=TOTAL&unit=RT) | 44.3 (sdg: 4.4) | ☐ |
| B4 | Romania 2024 | Countries table | [Population API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_gind?geo=RO&indic_de=AVG&time=2024) | 77.6 | ☐ |

**Note R.** Eurostat's own per-million column in `tran_sf_roadus` (unit `P_MHAB`) does not
match its counts for the EU total (for example 127.8 published for 1999 against 43 implied).
The site therefore does not use it; see DATA_SOURCES.md. Do not count a difference with that
column as a failure.

## C. Status labels

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| C1 | EU-27 rate 2024 is marked as estimated (population flagged `e` / `ep`) | Overview, rate KPI badge | [Population API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_gind?geo=EU27_2020&indic_de=AVG&time=2024) — look at `"status"` | “Estimated” | ☐ |
| C2 | France rate 2024 is marked as provisional (`p`) | Data explorer: France, rate, 2024 | [Population API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_gind?geo=FR&indic_de=AVG&time=2024) | “Provisional” | ☐ |
| C3 | Death counts carry no flag at the source and show “No status flag”, not “Final” | Data explorer: any count | API from A3 (no `"status"` entry) | “No status flag” | ☐ |

## D. Breakdowns — `tran_sf_roadus` (road user) and `tran_sf_roadve` (mode of transport)

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| D1 | EU-27 pedestrians 2024 | Road users (EU), by road user | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=EU27_2020&time=2024&sex=T&age=TOTAL&pers_cat=PED&unit=NR) | 3,537 | ☐ |
| D2 | Netherlands drivers and riders 2024 | Road users → Netherlands | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?geo=NL&time=2024&sex=T&age=TOTAL&pers_cat=DRIV&unit=NR) | 450 | ☐ |
| D3 | Netherlands cyclists 2024 = Bicycles (`BIKE`) + E-bikes (`EPAC`) | Road users → Netherlands, by mode of transport | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadve?geo=NL&time=2024&unit=NR&vehicle=BIKE&vehicle=EPAC) — add both values | 169 | ☐ |
| D4 | Germany motorcyclists 2024 = sum of `MOTO_LE125`, `MOTO_GT125`, `MOTO_NSP`, `MOTO_2WH` | Road users → Germany, by mode of transport | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadve?geo=DE&time=2024&unit=NR&vehicle=MOTO_LE125&vehicle=MOTO_GT125&vehicle=MOTO_NSP&vehicle=MOTO_2WH) — add the values | 513 | ☐ |
| D5 | EU-27 cyclists 2024 | Road users (EU), by mode of transport | [API](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadve?geo=EU27_2020&time=2024&unit=NR&vehicle=BIKE&vehicle=EPAC) — add both values | 1,812 | ☐ |

D3–D5 check the grouping of Eurostat's vehicle codes (METHODOLOGY.md, “Breakdowns”).
`MOTO_2WH` is a “not elsewhere classified” remainder, not a total, so adding it is correct.

## E. 2030 target and progress

| # | Check | Where on the site | Expected | Result |
| --- | --- | --- | --- | --- |
| E1 | 2030 benchmark = half of the 2019 EU total (A2 ÷ 2) | Overview, progress KPI / chart | 11,378.5 (shown rounded) | ☐ |
| E2 | Change vs 2019 = (A1 − A2) ÷ A2 | Overview, KPI | −12.4 % | ☐ |
| E3 | The straight-line path to 2030 is labelled as an analytical benchmark, not an official forecast | Overview, chart legend/notes | Label present | ☐ |

## F. Legislation — EUR-Lex

Open each act on EUR-Lex (link on the site) and compare with the **Document information**
tab.

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| F1 | Directive (EU) 2015/413: adoption date, proposal and amending act | Legislation → search “2015/413” → Lifecycle | [EUR-Lex 32015L0413](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32015L0413) | Adopted 11 Mar 2015; proposal COM(2014) 476; amended by Directive (EU) 2024/3237 | ☐ |
| F2 | Directive (EU) 2025/2205 (driving licences): transposition deadlines | Legislation → search “2025/2205” | [EUR-Lex 32025L2205](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32025L2205) | 26 Nov 2027, 26 Nov 2028, 26 Nov 2029 | ☐ |
| F3 | Directive 2006/126/EC: repealed by Directive (EU) 2025/2205; in-force status as EUR-Lex shows it | Legislation → status “All” → search “2006/126” | [EUR-Lex 32006L0126](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32006L0126) | Repealed by 2025/2205; status matches EUR-Lex | ☐ |
| F4 | A pending proposal is still pending: COM(2025) 180 (roadworthiness) | Legislation → Proposals | [EUR-Lex 52025PC0180](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:52025PC0180) (procedure tab) | No adopted act recorded | ☐ |
| F5 | One act of your own choice from the register | Legislation | EUR-Lex | (from the site) | ☐ |

## G. Freshness and provenance

| # | Check | Where on the site | Source | Expected | Result |
| --- | --- | --- | --- | --- | --- |
| G1 | Release date of `tran_sf_roadus` | Sources & freshness | Data browser, “Last data update” | 25 Aug 2026 (Eurostat may show 25/08/2026 23:00 CEST) | ☐ |
| G2 | Latest reference year | Header | Data browser | 2024 | ☐ |
| G3 | Every chart and table names its source | Overview, Countries, Road users, Chart builder | — | Source line present | ☐ |
| G4 | The PNG and CSV downloads from the chart builder contain the same values as the chart | Chart builder → CSV | — | Same values | ☐ |

## Reporting

* All ✅: note the review in IMPLEMENTATION_PLAN.md (Milestone 5, “Independent
  data-integrity review”) with the date and the reviewer.
* Any ❌: open a GitHub issue per finding. A confirmed error in the published figures is
  corrected through the pipeline (never by editing `public/data/` by hand), and the fix is
  noted in the issue.
