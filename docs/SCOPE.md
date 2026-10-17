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
| 3. Legislation | Which rules apply, and where are they in the legislative cycle? | ✅ Live (EU acts) |
| 4. Policy commitments | What have governments committed to, and how do outcomes compare? | ✅ Live (EU and global) |

### 1. Road safety progress (live)

Official, harmonised statistics on road deaths: totals, rates per million inhabitants,
trends since 1999, and breakdowns by road user, mode of transport, age, sex and type of road. Source: Eurostat
(CARE data from DG MOVE) and Eurostat population data. Coverage: EU-27.

Next candidates, each requiring its own source assessment: regional (NUTS 2) figures,
combined breakdowns (e.g. age by mode of transport), and coverage of EFTA and candidate
countries.

### 2. Progress towards Vision Zero (live, fatalities only)

The EU objective of halving road deaths **and** serious injuries between 2020 and 2030,
on the way to close to zero road deaths by 2050. Live today: the fatality benchmark measured
from 2019 as in the European Commission's own monitoring (the commitments page also shows
the 2020 baseline stated in the policy framework), progress made and a clearly labelled analytical straight-line path.
Not yet covered: the serious-injury half of the objective (assessed: no official EU-wide
MAIS3+ series exists yet, see DATA_SOURCES §8). National targets are covered for a first set
of countries on the commitments and country pages.

### 3. Legislation (live, EU acts)

A register of EU road safety legislation and its lifecycle: Commission proposal, adoption,
entry into force, transposition deadlines for directives, in-force status, and the acts
that amend, repeal or replace it, plus Commission proposals that are still pending. Each
entry links to the official text on EUR-Lex and records its CELEX identifier. Source:
EUR-Lex metadata from the Publications Office of the EU, selected by the EuroVoc subject
"road safety", with a short curated list of core acts indexed elsewhere.

Next candidates: a timeline view, the stage of pending proposals in Parliament and
Council, and national transposition measures as published by EUR-Lex.

Out of scope: legal advice, and any assessment of whether a Member State complies with a
law unless an official body has published that assessment (which is then cited).

### 4. Policy commitments (live, EU and global)

Targets and goals adopted by the EU institutions and the international community: the EU
Road Safety Policy Framework 2021–2030 and earlier EU targets for 2010 and 2020, the Council's
Valletta conclusions, the 2050 Vision Zero goal, the Stockholm Declaration and UN resolution
74/299. Each is quoted word for word with a link to the official text. Where a target can be
measured with the official statistics, the target value and the recorded figures are shown
next to it, with a chart of EU road deaths against every measurable target.

National strategies: a first selection (Spain, Poland, Germany, the Netherlands), quoted in
the original language with an English translation and measured against Eurostat's national
figures where the document states a baseline. Next candidates: further national strategies,
and serious-injury targets once an official EU-wide MAIS3+ series is published.

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
| R1 ✅ | Source assessment for legislation (machine-readable access to EU legal acts) | — |
| R2 ✅ | Data model and schema for legal acts and their lifecycle events | R1 |
| R3 ✅ | Register of EU road safety acts (EuroVoc selection + curated additions), with pipeline validation | R2 |
| R4 ✅ | "Legislation" page: register, proposals, deadlines, links to official texts (timeline view to follow) | R3 |
| R5 ✅ | Source assessment for policy commitments (EU framework, declarations; first national strategies) | — |
| R6 ✅ | Data model for commitments and targets; link measurable targets to outcome series | R5 |
| R7 ✅ | "Commitments" page and target-versus-outcome views | R6 |
| R8 | Serious injuries and EU KPI data, where comparable official data exist (serious injuries assessed: not yet available) | Source assessment |
| R9 | Coverage beyond the EU-27 (EFTA, candidate countries) | Source assessment |

Progress on these steps is tracked in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
Candidate sources for R5, R8, R9 and further legislation work are listed, unassessed, in
[DATA_SOURCES.md](DATA_SOURCES.md#candidate-sources-for-planned-pillars-not-yet-assessed).
