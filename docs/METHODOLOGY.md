# Methodology and data dictionary

Methods used by Vision Zero Monitor for its pillars: road safety statistics, the 2030
benchmark, the [legislation register](#legislation-register) and
[policy commitments](#policy-commitments) (see [SCOPE.md](SCOPE.md)).

## Road fatality

A person killed immediately or dying within **30 days** as a result of a road
traffic accident, excluding suicides (Eurostat/CARE definition). Countries that do
not apply the 30-day rule use correction coefficients in the official data; this
project applies no further corrections.

## Frequency

> Official fatality statistics are published periodically. This dashboard checks
> for updated data weekly; the underlying figures are not necessarily weekly.

All current observations are **annual** (`frequency: "annual"`). No weekly, monthly
or interpolated values are produced. No live counter is shown. A future official
sub-annual series would be added as a separate `frequency` with its own provenance.

## Three dates

| Field | Meaning |
| --- | --- |
| `period` | Reference period: the calendar year in which the deaths occurred. |
| `source_published_at` | Eurostat `UPDATE_DATA` timestamp of the dataset (UTC). For derived rates: the later of the two inputs. |
| `retrieved_at` | When the pipeline downloaded the dataset (UTC). |

The dashboard never presents `retrieved_at` as the date of the deaths.

## Observation status vocabulary

| Status | Rule |
| --- | --- |
| `final` | Source explicitly marks the value final. *Eurostat has no such flag, so this is currently never assigned.* |
| `provisional` | Eurostat flag contains `p` (and not `e`). |
| `estimated` | Eurostat flag contains `e` (e.g. `e`, `ep`, `bep`). |
| `missing` | No value published (`value: null`). |
| `unknown` | A value is published without a flag, or only with flags that do not concern finality (e.g. `b` break in series). |

The original flag is preserved in `source_flag`. Labels are in
`metadata.json → sources[].status_flag_labels`. The UI shows `unknown` as
“No status flag” with the explanation that the value is not marked provisional or
estimated, but finality cannot be established and revisions remain possible.

## Indicators

| Id | Unit | Definition |
| --- | --- | --- |
| `road_fatalities` | persons | `tran_sf_roadus`, `sex=T, age=TOTAL, pers_cat=TOTAL, unit=NR`. Integer. |
| `population_average` | persons | `demo_gind`, `indic_de=AVG`. |
| `road_fatalities_per_million` | per million inhabitants | Derived, see below. |

### Rates per million inhabitants

```
rate = road_fatalities / population_average * 1,000,000   (rounded to 1 decimal)
status(rate) = most cautious of status(deaths), status(population)
               order: missing < estimated < provisional < unknown < final
```

Eurostat's own `P_MHAB` values in `tran_sf_roadus` are not used because the EU27
aggregate is inconsistent with the counts (see DATA_SOURCES.md). The derived rate is
checked against `sdg_11_40` (`RT` per 100,000 × 10) every run.

## Summary indicators

```
yoy_change_abs      = deaths[t] - deaths[t-1]                  (null if either is missing)
yoy_change_percent  = (deaths[t] - deaths[t-1]) / deaths[t-1] * 100
change_percent      = ((current_value - baseline_value) / baseline_value) * 100
target_2030         = baseline_2019_fatalities * 0.5           (kept fractional, e.g. 11378.5)
progress_fraction   = (baseline - current) / (baseline - target_2030)
benchmark_path[y]   = baseline + (y - 2019)/(2030 - 2019) * (target_2030 - baseline)
```

* The latest period is the latest year with a non-null EU27 value.
* Country comparisons use each country's own latest year; the table warns when
  these differ.
* The EU figure is always Eurostat's official `EU27_2020` aggregate, never a sum
  computed here. Validation compares it with the sum of Member States (warning if
  different, error if it looks double-counted).
* Status of a comparison = most cautious status of the two observations compared.

## Breakdowns

`public/data/breakdowns.json` splits road deaths two ways. Each split adds up to the total.

**By road user** (`tran_sf_roadus`, `pers_cat`): Drivers and riders (`DRIV`, includes cyclists
and motorcyclists), Passengers (`PAS`), Pedestrians (`PED`), Unknown (`UNK`).

**By mode of transport** (`tran_sf_roadve`, `vehicle`), 27 source codes grouped into 8:

| Category | Eurostat codes |
| --- | --- |
| Car occupants | `CAR` |
| Motorcyclists | `MOTO_LE125`, `MOTO_GT125`, `MOTO_NSP`, `MOTO_2WH` |
| Moped riders | `MOP` |
| Cyclists | `BIKE`, `EPAC` (e-bikes) |
| Goods vehicles and tractors | `VEH_GD`, `VG_LE3P5`, `VG_GT3P5`, `TRC`, `TRC_AGR` |
| Buses and coaches | `BUS_TOT`, `BUS_MIN`, `BUS`, `BUS_TRO`, `MCO` |
| Pedestrians | `OTH` |
| Other and unknown | `QUA_LE50`, `QUA_GT50`, `MCMOB` (e-scooters), `MTZ_OTH`, `NMTZ_OTH`, `ANI_RD`, `TRM_LR`, `UNK` |

Rules:

* A category is missing for a year if any of its source codes is missing.
* Shares are computed only for years in which every category has a value, so they add to 100 %.
* **EU coverage:** `eu_members_reporting` records, per year, how many Member States report the
  breakdown. EU breakdown values are shown only for years with all 27 (from 2016); earlier
  EU aggregates count non-reporting countries' deaths as unknown and are not comparable.
  Published values remain in the file and in CSV exports, with the coverage column.
* A warning is shown when more than 10 % of a country's deaths are "unknown"/"other and unknown".
* Rates per million for a category use the same average population and rounding as the
  headline rate; they are computed in the browser from the published counts.
* Validation: categories vs total (warning above max(2, 1 %)), road-user pedestrians vs vehicle
  pedestrians (warning above max(2, 2 %)), structural checks and coverage collapse (errors).

## Charts

The chart builder (`#/charts`) plots the EU total and any Member States, for all road deaths
or one breakdown category (e.g. cyclists), with three measures:

* **Deaths**: `road_fatalities` as published.
* **Per million inhabitants**: `road_fatalities_per_million` (see above).
* **Index (2019 = 100)**: `deaths[y] / deaths[2019] * 100` per geography, so trends of very
  different sizes share one axis. If a geography has no 2019 value its index is not
  shown. The status of an index value is the most cautious of the year and the 2019 base.

Rules: one y-axis per chart, starting at zero; gaps are not bridged; provisional or
estimated values use hollow diamond markers; a combined chart shows at most 8 lines
(the validated categorical palette, colours fixed per geography while the selection
changes), larger selections switch to one chart per geography; every chart has a
legend (2+ lines), a text summary and a data table. PNG exports include title,
measure, years, legend and source; CSV exports contain exactly the plotted values with
their status. The selection is stored in the URL so a chart can be shared.

## 2030 target and Vision Zero

The EU Road Safety Policy Framework 2021–2030 (SWD(2019) 283, section 3.2) sets the
objective of reducing road deaths **and serious injuries** by 50 % “between 2020 and
2030”, as a step towards Vision Zero — close to zero road deaths by 2050. The European
Commission's own progress charts measure the road-death target from **2019** (its 2025
road safety statistics show the 2030 target as 11 400 deaths, half of the 22 800 recorded
in 2019), and the overview page does the same. The commitments page shows the target
against both baselines (see “Policy commitments” below). This dashboard tracks only the
fatality component. The straight-line path from 2019 to 2030 is an **analytical
benchmark**, not an official trajectory or forecast; no claim of being “on track”
or “off track” is made from a single year. Comparisons involving provisional
values may change when final data are published.

## Missing data

* Missing = `null`, never `0`. No interpolation, no carry-forward.
* Charts break the line at gaps (`connectNulls=false`); tables say “Not available”.
* Coverage of the latest year (Member States with data) is reported in
  `metadata.json → coverage` and on the dashboard.

## Revisions

Official data are revised. Each run compares new values with the previously
published dataset (`metadata.json → revisions`):

* revisions of road deaths > 5 % → warning;
* fewer non-null observations by > 10 % → **error** (not published);
* latest EU reference year moves backwards → **error**;
* removed values → warning.

Previous versions are retrievable from the Git history of `public/data/`.
Historical observations are not immutable.

## Validation (hard errors block publication)

Schema (JSON Schema 2020-12, `schemas/`), duplicate key
`(geo, indicator, period, frequency)`, valid geo codes, status vocabulary, unit per
indicator, known source ids, null ⇔ `missing`, non-negative values, integer counts,
rate = deaths ÷ population × 10⁶, EU aggregate not double-counted, EU 2019 baseline
present and from the primary source, at least one EU observation.
Warnings: coverage gaps, EU aggregate ≠ sum of members, cross-source discrepancies,
large revisions.

## Pipeline status shown on the site

`pipeline_status.json` is written when data change and whenever a run fails (and
on the first successful run after a failure). Runs that succeed with unchanged data
are not committed, to avoid weekly no-op commits and deployments; the site
therefore labels the field “most recent *recorded* pipeline run” and links to the
full run history on GitHub Actions.

## Legislation register

Built by `scripts/legislation/` from EUR-Lex metadata (Publications Office SPARQL endpoint;
see DATA_SOURCES.md §6) and published as `public/data/legislation.json`.

**What is listed.** Legal acts and Commission proposals indexed with EuroVoc "road safety",
plus a short list of curated additions, each with its reason. Every entry links to the
official text on EUR-Lex by CELEX number.

**Fields are as recorded by the source.** Adoption date (date of the document), entry into
force, transposition deadlines (directives; several dates when provisions apply in stages),
the EUR-Lex "in force" flag and the end-of-validity date. Open-ended dates (`9999-12-31`)
are stored as `null`. If the source has no in-force flag, the site says "Status not
recorded" rather than guessing.

* **In force** means the act has entered into force according to EUR-Lex. Some
  provisions may apply later; this is not split out.
* **No longer in force** means EUR-Lex records it as no longer in force (for example after
  repeal). A repealed act can still show "in force" until the repeal takes effect, as
  recorded by EUR-Lex.
* **Transposition deadline passed / upcoming** compares the recorded deadline with the
  viewer's current date. It says nothing about whether any Member State has transposed
  the directive.

**Relations.** For each act: the Commission proposal it adopted (with its COM number and
the date it was sent), acts that amend, repeal or replace it and acts it amends, repeals or
replaces, and pending proposals to amend it.

**Proposal status.** Derived from the metadata only:

| Status | Rule |
| --- | --- |
| adopted | An act in EUR-Lex adopts the proposal |
| pending (`open`) | No adopting act and no end-of-validity date recorded |
| closed without act | An end-of-validity date is recorded (for example withdrawal) and no act adopts it |

A pending proposal sent more than five years before the register was built gets a
`status_note` and is shown separately as "unclear status": EUR-Lex does not always record
the end of a procedure. Only Commission proposals (`PROP_DIR`, `PROP_REG`, `PROP_DEC`)
are listed; other preparatory documents are ignored. The COM number comes from the
document's internal number or, failing that, from its CELEX number (`5YYYYPCNNNN` →
`COM(YYYY) NNNN`).

**Validation.** Errors block publication (the previous file is kept): schema violations,
duplicate entries, fewer than 50 acts, a curated act missing from the source, a proposal
marked adopted without an adopting act, a proposal closed before it was sent, or more than
20 % of acts disappearing compared with the last published register. Warnings are logged
for review: curated acts that are now indexed (and can be removed from the list), acts
without an in-force flag, acts removed since the last run, and inconsistent dates at the
source (end of validity before adoption).

**Change detection.** The register is rewritten only when its content changes; build and
retrieval timestamps are ignored in that comparison.

**What the register does not do.** It does not assess compliance, give legal advice, or
show the stage of a proposal in Parliament or Council. National legislation is not
covered.

## Policy commitments

Built by `scripts/commitments/build.py` from the curated file
`data/curated/commitments.json` and the published `observations.json`, and published as
`public/data/commitments.json`. Sources and their assessment: DATA_SOURCES.md §7.

**Curation.** Commitments are published as documents, so each entry is written by hand:
issuer, date, form (Commission policy, Council conclusions, ministerial declaration, UN
resolution), scope, a short description of its nature, and one or more sources. Every
source has a **verbatim quote**, its location in the document (section, point, page) and a
link to the official text. `python -m scripts.commitments.verify_sources` downloads each
document and checks that every quote occurs in it word for word (ignoring line breaks,
hyphenation, quote-mark style and the spacing in “50 %”). The date of the last human
review is stored as `reviewed_at` and shown on the page. The same check runs automatically
every month (`verify-commitments.yml`) and opens an issue when a quote no longer matches.

**Nature.** All commitments currently listed are political or policy commitments; none is
legally binding. The text says so for each entry, in the source's own terms (for example
“Council conclusions”, “UN General Assembly resolution”).

**Targets.** Each commitment lists its targets as stated: indicator (road deaths or serious
injuries), reduction, baseline year and target year. A target is **measured** only when it
can be compared with the official statistics on this site: road deaths, EU-27, with an
official figure for the baseline year. Otherwise the reason is shown (for example: no official
EU-wide serious-injury (MAIS3+) series exists, see DATA_SOURCES §8; a global goal; no baseline year stated).

| Quantity | Definition |
| --- | --- |
| Target value | official baseline figure × (1 − stated reduction), kept unrounded in the data (e.g. 9 415.0) |
| Comparison year | the target year if its figure is published, otherwise the latest year with a figure |
| Change | (figure in comparison year − baseline figure) ÷ baseline figure × 100 |
| Share of the required reduction | (baseline − figure) ÷ (baseline − target value); negative when deaths rose |

When a deadline has passed, the page states whether the recorded figure is above or below
the target value. That is arithmetic on official figures, not an assessment. No judgement
such as “on track” is made for targets whose deadline has not passed.

**Baselines.** A target is computed from the baseline year stated in the document. Where
the European Commission monitors a target against a different year, that baseline is added
as a second, labelled row with its source (currently: the 2030 road-death target, stated as
2020–2030 and monitored by the Commission from 2019).

**Scope.** Targets set for the EU of an earlier date (for example the 2010–2020 target, set
when the EU had 27 Member States including the United Kingdom and without Croatia) are
compared with today's EU-27 figures; this is noted on each such target. The 2003 target
(“by 2010”, EU of 15 Member States, no baseline year stated) is listed but not measured.

**Validation.** Errors block publication and keep the previous file: schema violations,
duplicate identifiers, a commitment without a primary source, a baseline year not before
the target year, a measured target without an official baseline figure, an unmeasured
target without a stated reason, or a review date in the future. The build runs after every
statistics refresh, so outcomes always use the latest published figures.

