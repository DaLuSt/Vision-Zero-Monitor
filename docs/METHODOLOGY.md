# Methodology and data dictionary

Methods used by Vision Zero Monitor for the live pillars (road safety statistics and the
2030 benchmark). Methods for the planned legislation and policy-commitment pillars will be
added here when those pillars are built (see [SCOPE.md](SCOPE.md)).

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

The EU Road Safety Policy Framework 2021–2030 sets the objective of halving road
deaths **and serious injuries** by 2030 compared with 2019, as a step towards
Vision Zero — close to zero road deaths by 2050. This dashboard tracks only the
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
