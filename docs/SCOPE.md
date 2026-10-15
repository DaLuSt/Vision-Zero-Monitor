# Scope and roadmap

Vision Zero Monitor is an open-source platform monitoring Europe's road safety progress,
legislation, policy commitments, and progress towards Vision Zero.

This document defines what the platform covers, the rules every part of it follows, and
what is live versus planned. It is the reference for deciding whether a new feature or data
source belongs in the project.

## Pillars

| Pillar | Question it answers | Status |
| --- | --- | --- |
| 1. Road safety progress | What is happening on Europe's roads? | ✅ Live |
| 2. Progress towards Vision Zero | Are outcomes moving fast enough towards the agreed targets? | ✅ Live (fatalities) |
| 3. Legislation | Which rules apply, and where are they in the legislative cycle? | 🔜 Planned |
| 4. Policy commitments | What have governments committed to, and how do outcomes compare? | 🔜 Planned |

### 1. Road safety progress (live)

Official, harmonised statistics on road deaths: totals, rates per million inhabitants,
trends since 1999, and breakdowns by road user and mode of transport. Source: Eurostat
(CARE data from DG MOVE) and Eurostat population data. Coverage: EU-27.

Next candidates, each requiring its own source assessment: age and sex breakdowns, road
type (urban/rural/motorway), regional (NUTS 2) figures, serious injuries (MAIS3+, where
comparable), and coverage of EFTA and candidate countries.

### 2. Progress towards Vision Zero (live, fatalities only)

The EU objective of halving road deaths **and** serious injuries by 2030 compared with
2019, on the way to close to zero road deaths by 2050. Live today: the 2019 baseline, the
2030 fatality benchmark, progress made and a clearly labelled analytical straight-line path.
Not yet covered: the serious-injury half of the objective and national targets.

### 3. Legislation (planned)

A register of EU road safety legislation and its lifecycle, for example: proposal,
adoption, entry into force, application dates and transposition deadlines for directives.
Each entry links to the official text and records the legal act's identifier.

Out of scope: legal advice, and any assessment of whether a Member State complies with a
law unless an official body has published that assessment (which is then cited).

### 4. Policy commitments (planned)

Strategies, targets and declarations adopted by the EU and by Member States, such as the
EU Road Safety Policy Framework 2021–2030, ministerial declarations, and national road
safety strategies with their targets. Where a commitment has a measurable target, the
platform shows it next to the official outcome data, using the same methods as pillar 2.

## Principles (apply to every pillar)

1. **Official sources first.** Statistics, legal texts and commitments come from the body
   that publishes them. Unofficial or secondary sources may be shown only as a separate,
   labelled source, never merged with official data.
2. **Provenance on every item.** Each figure, legal act or commitment records its source
   URL, identifier, publication date and retrieval date.
3. **No fabricated precision or interpretation.** Missing data stay missing. The platform
   does not label a country or the EU "on track" or "off track", or "compliant", on its own
   judgement.
4. **Status is explicit.** Statistics carry provisional/estimated/unknown status; legal acts
   carry a lifecycle status; commitments record whether a target is binding, indicative or
   aspirational, as stated by the source.
5. **Reproducible and automated where possible.** Machine-readable sources are fetched,
   validated and versioned by the pipeline. Sources that can only be curated by hand use
   reviewed, version-controlled data files with the same provenance fields.
6. **Accessible and free.** Static site, no tracking, no API keys, open data formats.

## Roadmap

| Step | Deliverable | Depends on |
| --- | --- | --- |
| R1 | Source assessment for legislation (machine-readable access to EU legal acts) | — |
| R2 | Data model and schema for legal acts and their lifecycle events | R1 |
| R3 | Curated register of core EU road safety acts, with pipeline validation | R2 |
| R4 | "Legislation" page: register, timeline, links to official texts | R3 |
| R5 | Source assessment for policy commitments (EU framework, declarations, national strategies) | — |
| R6 | Data model for commitments and targets; link measurable targets to outcome series | R5 |
| R7 | "Commitments" page and target-versus-outcome views | R6 |
| R8 | Serious injuries and EU KPI data, where comparable official data exist | Source assessment |
| R9 | Coverage beyond the EU-27 (EFTA, candidate countries) | Source assessment |

Progress on these steps is tracked in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
Candidate sources for R1, R5, R8 and R9 are listed, unassessed, in
[DATA_SOURCES.md](DATA_SOURCES.md#candidate-sources-for-planned-pillars-not-yet-assessed).
