# Data sources

Source inventory as verified on **2026-10-14** (statistics) and **2026-10-15**
(legislation) against the live endpoints. Values quoted below come from those days'
responses, which are saved in `tests/fixtures/eurostat_2026-10-14/` and
`tests/fixtures/legislation_2026-10-15/`.

## Summary

| Source | Machine-readable | Official | Prelim./final | Cadence | National comparison | Used |
| --- | --- | --- | --- | --- | --- | --- |
| Eurostat `tran_sf_roadus` | ✅ API (JSON-stat) | ✅ | Unflagged (see below) | Annual, ~once a year | ✅ 27 MS + EU27, 1999→ | **Primary** |
| Eurostat `tran_sf_roadve` | ✅ API (JSON-stat) | ✅ | Unflagged | Annual | ✅ from 2016 for all 27 | Breakdown by mode of transport |
| Eurostat `demo_gind` (AVG) | ✅ API | ✅ | Flags `p`, `e`, `b` | Annual (+ revisions) | ✅ | Denominator |
| Eurostat `sdg_11_40` | ✅ API | ✅ | Counts unflagged; rates flagged | Annual | ✅ 2000→ | Cross-check only |
| DG MOVE "Road safety statistics 2025" page | ❌ (figures are images/HTML) | ✅ | **Preliminary** | Annual (spring) | Partly | Not used |
| ERSO "Data and analysis" `.xlsx` (`fatalities_per_pop_2010-24_public`) | ⚠️ manual download | ✅ | Final (CARE) | Annual | ✅ | Not used (duplicates CARE data in Eurostat) |
| CARE database (raw) | ❌ restricted access | ✅ | — | — | — | Not used |
| Eurostat `tran_sf_roadro` | ✅ API (JSON-stat) | ✅ | Unflagged | Annual | ✅ all 27 from 2016 (Malta missing 2019) | Breakdown by type of road (§9) |
| Publications Office Cellar SPARQL (EUR-Lex metadata) | ✅ SPARQL (JSON results) | ✅ | Lifecycle status as recorded | Updated continuously | n/a (EU law) | **Legislation register** |
| ERSO annual statistical report 2026, Table 4 (MAIS3+) | ❌ PDF only | ✅ | Final (CARE) | Annual | ❌ 18 of 27 MS, gaps, no EU total | Not used (see §8) |
| ERSO annual report `.xlsx`, column “Seriously Injured” | ⚠️ manual download | ✅ | Final (CARE) | Annual | ❌ national police definitions | Not used (not MAIS3+) |

## 1. Eurostat — `tran_sf_roadus` (primary)

* **Publisher:** Eurostat; data compiled by European Commission DG MOVE from the
  CARE (Community database on road accidents) database
  (`SOURCE_INSTITUTIONS` annotation of the API response).
* **Title:** Persons killed in road accidents by age, sex and category of persons involved.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus/default/table
* **API endpoint:**
  `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?format=JSON&lang=EN&unit=NR&unit=P_MHAB&geo=EU27_2020&geo=BE&…&geo=SE`
  (all sexes, ages and person categories; about 1.6 MB)
* **Metadata:** https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm
* **Dimensions:** `freq` (A), `sex` (T/M/F/UNK), `age` (TOTAL + 7 bands), `unit`
  (`NR` number, `P_MHAB` per million inhabitants), `pers_cat` (TOTAL, PAS, DRIV, PED, UNK),
  `geo` (EU27_2020, 27 MS, EFTA, candidates, UK), `time` (1999–2024).
* **Variables used:** `NR` with `sex=T, age=TOTAL`; `pers_cat=TOTAL` for road deaths and
  `DRIV`, `PAS`, `PED`, `UNK` for the road-user breakdown (these four add up to `TOTAL`
  in 643 of 656 country-years; the rest differ by ±1). With `pers_cat=TOTAL`: the seven
  age bands (`sex=T`) for the age breakdown and `M`, `F`, `UNK` (`age=TOTAL`) for the sex
  breakdown. Checked on 2026-10-17 for 2010–2024: both add up to the total in every
  country-year reported; all 27 Member States report both from 2016; the EU share of
  unknown age is 0.4–0.9 % and of unknown sex 0.1–0.5 %.
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

## 2. Eurostat — `tran_sf_roadve` (breakdown by mode of transport)

* **Title:** Persons killed in road accidents by type of vehicle.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadve/default/table
* **API endpoint:** `…/data/tran_sf_roadve?format=JSON&lang=EN&unit=NR&geo=…`
* **Dimensions:** `vehicle` (28 codes incl. `TOTAL`), `unit` (`NR`), `geo`, `time` (1999–2024).
* **Publication date:** `UPDATE_DATA` = 2026-08-25T23:00:00+02:00. No status flags.
* **Findings verified on 2026-10-14 (important for correct use):**
  * The 27 non-`TOTAL` codes are **one non-overlapping partition**: they add up to `TOTAL`
    in 625 of 656 country-years (the rest only in the EU aggregate, ±1–2).
  * Parent-sounding codes are **residual "not elsewhere classified" categories, not totals**:
    `MOTO_2WH` = 951 EU deaths in 2024 while `MOTO_LE125 + MOTO_GT125 + MOTO_NSP` = 2,788.
    Reading `MOTO_2WH` as "all motorcyclists" would undercount them by about 75 %. The same
    holds for `VEH_GD` and `BUS_TOT`.
  * `OTH` ("Other") holds people not using a vehicle, i.e. **pedestrians**: it equals
    `tran_sf_roadus` `PED` in 648 of 656 country-years; the 8 exceptions differ by at most 4
    (largest: Malta 2009, 4 vs 0, reported as a validation warning).
  * **Coverage:** 12 Member States did not report breakdowns for some early years, and a few
    have gaps in 2011–2015; all 27 report from **2016**. Eurostat's EU aggregate for incomplete
    years counts the non-reporting countries' deaths as unknown (37 % "unknown" in 1999), so
    EU breakdowns are only comparable from 2016. Both road-user and vehicle breakdowns share
    this pattern.
  * Some countries record many deaths without a vehicle type (Estonia: "other and unknown"
    above 10 % in most years, 51 % in 2020).
* **Transformation:** 27 codes grouped into 8 categories (see METHODOLOGY.md § Breakdowns);
  a group is missing for a year if any of its codes is missing (never undercounted). A new,
  unmapped code makes the pipeline fail instead of silently dropping deaths.

## 3. Eurostat — `demo_gind` (rate denominator)

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

## 4. Eurostat — `sdg_11_40` (cross-check)

* **Title:** Road traffic deaths, by type of roads.
* **Canonical URL:** https://ec.europa.eu/eurostat/databrowser/view/sdg_11_40/default/table
* **API endpoint:** `…/data/sdg_11_40?format=JSON&lang=EN&tra_infr=TOTAL&unit=NR&unit=RT&geo=…`
* **Variables:** `NR` (number), `RT` (rate per 100,000, one decimal, flagged).
* **Coverage:** 2000–2024. Rates carry flags `b`, `e`, `p` derived from population.
* **Use:** not published. Every run checks that (a) `NR` equals `tran_sf_roadus`
  counts and (b) our derived rate ÷ 10 is within 0.06 of `RT`. On 2026-10-14 both
  checks passed for **every** geo × year — independent confirmation of the counts
  and of the derived rates.

## 5. European Commission DG MOVE / European Road Safety Observatory

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

## 6. Publications Office of the EU — Cellar SPARQL endpoint (legislation)

* **Endpoint:** `https://publications.europa.eu/webapi/rdf/sparql` (HTTP POST, no key,
  `Accept: application/sparql-results+json`). It exposes the metadata behind EUR-Lex in
  the Common Data Model (CDM) ontology, `http://publications.europa.eu/ontology/cdm#`.
* **Assessment (R1), 2026-10-15:** suitable. Every query used by the pipeline answers in
  under 3 seconds. Identifiers (CELEX, ELI), adoption dates, entry-into-force dates,
  transposition deadlines, the EUR-Lex "in force" flag, end of validity, and the links
  between acts (proposal adopted, amends, repeals, replaces, proposes to amend) are all
  machine-readable. English titles are available as expressions of each work.
* **Selection:** legal acts (directives, regulations, decisions and their delegated and
  implementing forms, and recommendations) and Commission proposals indexed with EuroVoc
  concept **4047 "road safety"** (`http://eurovoc.europa.eu/4047`). On 2026-10-15 this
  gave 163 acts and the related proposals. Corrigenda are excluded.
* **Known gap and curation:** the EuroVoc indexing misses some core road safety acts that
  are indexed under narrower subjects. These are added from a short, reviewed list in
  `scripts/legislation/config.py` (`CURATED_ADDITIONS`), each with a stated reason, and
  are labelled *curated addition* on the site: Directive 2006/126/EC (driving licences),
  Directive 91/671/EEC (safety belts) and Directive 92/6/EEC (speed limiters). The
  pipeline warns when a curated act becomes indexed as "road safety" (the entry can then
  be removed) and fails if a curated act disappears from the source.
* **Indexing breadth:** EuroVoc indexing is done by the Publications Office, not by this
  project. It includes some acts whose link to road safety is indirect (for example
  type-approval rules for non-road mobile machinery). They are listed as indexed; the
  project does not second-guess the indexing.
* **Proposal status:** the metadata records when a proposal was adopted (an act
  "adopts" it) and an end-of-validity date when a procedure ended (for example a
  withdrawal). It does **not** record the stage reached in Parliament and Council. A
  proposal with neither is shown as pending; when that has been the case for more than
  five years the site flags the status as unclear (see METHODOLOGY.md).
* **Source inconsistencies seen:** one act (32016R0130) has an end-of-validity date
  before its adoption date. Such cases are published as recorded and reported as
  validation warnings.
* **Reuse:** EUR-Lex content and metadata may be reused under Commission Decision
  2011/833/EU, with acknowledgement of the source (© European Union).
* **Not used:** the EUR-Lex web pages themselves (HTML, not for scraping) and the
  EUR-Lex SOAP web service (requires registration). National transposition measures
  (also in EUR-Lex) are not yet assessed.

## 7. Policy commitments: official documents (curated)

* **Assessment (R5), 2026-10-15:** there is no machine-readable register of road safety
  commitments. Targets are stated in policy documents, Council conclusions, declarations
  and resolutions. The commitments pillar therefore uses a **curated file**
  (`data/curated/commitments.json`) with a verbatim quote and link for every entry.
* **Access used to verify the texts:** EU documents through the Publications Office
  (Cellar content negotiation on `http://publications.europa.eu/resource/celex/{CELEX}`;
  EUR-Lex web pages themselves block automated access); Council documents from
  `data.consilium.europa.eu`; UN resolutions from `documents.un.org`; the Stockholm
  Declaration from the conference website. `scripts/commitments/verify_sources.py`
  re-checks every quote against these documents; the workflow `verify-commitments.yml` runs
  it on the 3rd of every month and opens a `commitment-source-check` issue if a quote or
  link no longer matches (it never edits the curated file).
* **Documents in the first release:**

  | Document | Date | Used for |
  | --- | --- | --- |
  | COM(2003) 311 — European Road Safety Action Programme | 2 Jun 2003 | −50 % road deaths by 2010 (listed, not measured) |
  | COM(2010) 389 — Policy orientations on road safety 2011–2020 | 20 Jul 2010 | −50 % road deaths 2010–2020 |
  | COM(2011) 144 — White Paper on transport | 28 Mar 2011 | Close to zero road deaths by 2050 |
  | Council conclusions 9994/17 (Valletta Declaration) | 8 Jun 2017 | Member States: −50 % deaths 2010–2020; set a −50 % serious-injury target 2020–2030 |
  | COM(2018) 293 — Europe on the Move | 17 May 2018 | −50 % deaths and serious injuries 2020–2030; Vision Zero reaffirmed |
  | SWD(2019) 283 — EU Road Safety Policy Framework 2021–2030 | 2019 | −50 % deaths and serious injuries 2020–2030 |
  | Stockholm Declaration (3rd Global Ministerial Conference) | 20 Feb 2020 | At least −50 % road deaths 2020–2030 (global) |
  | UN General Assembly resolution A/RES/74/299 | 31 Aug 2020 | At least −50 % deaths and injuries 2021–2030 (global) |
  | Commission “Road safety statistics 2025 in more detail”, Figure 1 | 2026 | Monitoring baseline 2019 for the 2030 target |

* **National strategies (first selection, reviewed 17 Oct 2026).** Quoted in the original
  language with an English translation; official translations are verified like the quotes.

  | Country | Document | Target used | Translation |
  | --- | --- | --- | --- |
  | Spain | Estrategia de Seguridad Vial 2030 (DGT), Resumen ejecutivo | −50 % road deaths 2019–2030 (baseline 1,755, equal to Eurostat) | Official (English summary, p. 52) |
  | Poland | Narodowy Program Bezpieczeństwa Ruchu Drogowego 2021–2030 (KRBRD), summary | −50 %, no more than 1,455 deaths in 2030 (half of 2,909 in 2019, equal to Eurostat) | Official (English version, p. 24) |
  | Germany | Verkehrssicherheitsprogramm der Bundesregierung 2021 bis 2030 (BMVI) | −40 % road deaths by 2030; **no baseline year stated**, so not measured | Own |
  | Netherlands | Strategisch Plan Verkeersveiligheid 2030 (officielebekendmakingen.nl, blg-866302) | Zero road casualties as the ambition for 2050; no national number for 2030 | Own |
  | Sweden | Government interim target of 13 Feb 2020, as set out in Trafikverket's PM “Nya mål för trafiksäkerhet väg 2020–2030” (16 Sep 2020) | −50 % road deaths by 2030 from the **2017–2019 average** (266, equal to the Eurostat average; at most 133) | Own |

  *Searched but not listed (October 2026):*
  * *France:* no official national road-death target for 2030 found in the Sécurité routière /
    ONISR documents.
  * *Ireland* (Road Safety Strategy 2021–2030, −50 %) and *Belgium* (federal plan): the
    official sites (gov.ie, rsa.ie, belgium.be) block automated access, so the monthly quote
    check could not run; only third-party copies are reachable.
  * *Italy* (PNSS 2030): the only official text found, a Chamber of Deputies summary, gives the
    target as “da 3000 a 1500” with the baseline as “2019 oppure alla media del triennio
    2017-2019”; neither matches 3,000 in Eurostat, so it cannot be measured reliably.
  *Spain's site* (seguridadvial2030.dgt.es) does not send its intermediate certificate;
  `verify_sources.py` adds the public FNMT-RCM intermediate from
  `scripts/commitments/certs/` (downloaded from the certificate's own CA Issuers URL), so TLS
  verification stays on.

* **Finding: two baselines for the 2030 target.** The Policy Framework states the
  target as −50 % “between 2020 and 2030”, while the Commission's progress charts measure
  it from 2019 (22 800 → 11 400). Both are shown, each with its source.
* **Reuse:** EU documents under Commission Decision 2011/833/EU (© European Union); UN
  documents are public. Only short quotes are reproduced, with links to the full texts.
* **Not yet included:** the other national road safety strategies (to be added country by
  country) and the European Parliament resolution of 6 October 2021 on the policy framework. Serious-injury targets are listed but not measured; see §8
  for why no MAIS3+ series is used.

## 8. Serious injuries (MAIS3+): assessment, not used

Assessed in October 2026 (issue #19) to measure the serious-injury half of the 2030 target
(−50 % serious injuries 2020–2030). **Outcome: no source is suitable, so no serious-injury
series is published and the serious-injury targets stay “not measured”.**

* **Definition.** The EU uses MAIS3+: a casualty whose most severe injury scores 3 or more
  on the Abbreviated Injury Scale, normally derived from hospital records. Police-reported
  “seriously injured” figures use national definitions (in principle hospitalised for at
  least 24 hours) and are a different, non-comparable measure; this site must not mix them in.
* **EU-wide figure.** There is no official measured EU MAIS3+ series. The Commission's
  news release of 24 March 2026 (“EU road deaths drop by 3% in 2025”,
  https://transport.ec.europa.eu/news-events/news/eu-road-deaths-drop-3-2025-2026-03-24_en)
  states: “For every fatality, an estimated five people are seriously injured. This means
  that around 100,000 people across the EU suffer serious injuries in road crashes each
  year.” That is a ratio applied to road deaths, not a count, so it cannot show whether
  serious injuries have fallen.
* **National MAIS3+ figures.** The *Annual statistical report on road safety in the EU 2026*
  (ERSO; PDF dated 10 June 2026,
  https://road-safety.transport.ec.europa.eu/statistics-and-analysis/data-and-analysis/annual-statistical-report_en)
  has Table 4 “Absolute number of MAIS3+ causalities per country”, 2019–2024, source CARE.
  Why it is not used:
  * **PDF only.** The accompanying `Excel_Data_AnnualReport-2026.xlsx` does not contain it.
  * **Coverage.** 18 Member States appear, most only to 2022 or 2023, with no EU total. The
    missing countries are Bulgaria, Czechia, Denmark, Greece, Croatia, Hungary, Malta,
    Poland and Slovakia.
  * **Internal inconsistencies.** The table includes Latvia, Luxembourg and Slovenia, which
    the note under it lists as having no MAIS3+ data. Romania's and Latvia's figures are
    identical to their police-reported figures in Table 3 (Romania 2021–2023: 3 796,
    3 690, 3 247).
  * **Breaks in series.** Sweden has a break in 2022 (hospital reporting became mandatory
    in June 2021), and Romania reports only from 2021, after the 2020 baseline.
  * **Methods differ.** Member States estimate MAIS3+ by different methods (hospital
    linkage, conversion factors), and the report itself warns that definitions vary.
* **Police-reported “seriously injured”.** The same workbook's `Overview` sheet (column
  “Seriously Injured”) and the report's Table 3 hold police-reported figures under national
  definitions. For example, Germany reports about 50 000–68 000 a year against a MAIS3+
  estimate of 12 000–15 000. The report omits an EU total “due to missing data”. These
  figures are not used.
* **Eurostat.** No Eurostat dataset holds MAIS3+ figures. `tran_r_acci` (victims by NUTS 2
  region) counts police-reported injured persons and is not a MAIS3+ series.
* **Revisit when:** the Commission publishes a measured EU MAIS3+ series, or a
  machine-readable national table with a stated method and coverage of the 2019/2020
  baseline. Re-check each spring with the new annual statistical report.

## 9. Eurostat — `tran_sf_roadro` (breakdown by type of road)

* **Title:** Persons killed in road accidents by type of road. Same publisher, metadata
  (https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm), licence and
  release as `tran_sf_roadus`.
* **API endpoint:**
  `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadro?format=JSON&lang=EN&unit=NR&geo=EU27_2020&geo=BE&…&geo=SE`
* **Dimensions:** `freq` (A), `unit` (`NR`), `tra_infr` (`TOTAL`, `MWAY` motorways, `RD_URB`
  urban roads, `RD_RUR` rural roads, `UNK`), `geo`, `time` (1999–2024). No status flags.
* **Definitions (ESMS):** rural = outside urban area and not a motorway (or unknown);
  urban = inside urban area and not a motorway (or unknown); motorway = a motorway outside an
  urban area or in an unknown area; unknown = urban area unknown and motorway unknown. In practice
  motorways are counted as motorways wherever they are.
* **Checks (2026-10-17, 2010–2024):** the four categories add up to `TOTAL` in every country-year
  reported, and `TOTAL` equals `tran_sf_roadus` road deaths in every country-year. All 27 Member
  States report from 2016 except Malta for 2019, so EU figures by type of road are comparable from
  2020. The EU unknown share is at most 0.3 % from 2016 (up to 3.0 % in 2011–2015, when non-reporting
  countries' deaths are counted as unknown).
* **Not to be confused with** `sdg_11_40` (“by type of roads”), used only as a cross-check of the total.

## Candidate sources for planned pillars (not yet assessed)

Listed for the roadmap in [SCOPE.md](SCOPE.md). **None of these is used yet.** Each needs a
full assessment (access method, licence, update cadence, coverage, reliability) before use,
and claims about them below are to be verified in that assessment.

| Pillar | Candidate source | What to assess |
| --- | --- | --- |
| Legislation | National transposition measures (EUR-Lex "national implementing measures") | Coverage and meaning; must not be presented as a compliance assessment |
| Legislation | Legislative Observatory of the European Parliament (OEIL) | Procedure stages of pending proposals; machine-readable access and reuse terms |
| Legislation | European Commission road safety pages (DG MOVE) | Which acts are listed as road-safety relevant; suitability as a curation reference |
| Vision Zero progress | EU road safety KPIs (speed, seat belts, alcohol, etc.; serious injuries assessed in §8) | Which countries report, definitions, machine-readable availability |
| Coverage | Eurostat data for EFTA and candidate countries (same datasets) | Completeness and comparability per country |

## Provenance in the published files

* Every observation carries `source_id`, `source_url`, `source_published_at` and
  `retrieved_at`.
* `metadata.json → sources[]` records publisher, dataset id, browser URL, the exact
  API request URL, metadata URL, publication and retrieval timestamps, latest
  period in source, Eurostat flag labels and reuse terms.
* `legislation.json → source` records the publisher, SPARQL endpoint, selection rule,
  EuroVoc concept, curated additions with reasons, retrieval time and reuse terms; every
  act and proposal carries its CELEX number and EUR-Lex link (and ELI where available).
* Raw API and SPARQL responses (and the SPARQL queries) of each scheduled run are
  uploaded as a workflow artifact (30-day retention).
