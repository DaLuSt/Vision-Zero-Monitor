# Methodology and data dictionary

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
