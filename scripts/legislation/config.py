"""Configuration for the legislation register.

The register is defined by the EU Publications Office's own indexing: every legal act
tagged with the EuroVoc concept "road safety" (4047). A short, reviewed list of core acts
that are not tagged is added explicitly, each with the reason for inclusion.
"""

from __future__ import annotations

SCHEMA_VERSION = "1.0.0"

SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql"
EUROVOC_ROAD_SAFETY = "http://eurovoc.europa.eu/4047"
EURLEX_URL = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:{celex}"

# Resource types (EU authority table "resource-type") included in the register.
ACT_TYPES: dict[str, str] = {
    "DIR": "Directive",
    "DIR_DEL": "Delegated directive",
    "DIR_IMPL": "Implementing directive",
    "REG": "Regulation",
    "REG_DEL": "Delegated regulation",
    "REG_IMPL": "Implementing regulation",
    "DEC": "Decision",
    "DEC_DEL": "Delegated decision",
    "DEC_IMPL": "Implementing decision",
    "DEC_ENTSCHEID": "Decision",
    "RECO": "Recommendation (non-binding)",
}
PROPOSAL_TYPES: dict[str, str] = {
    "PROP_DIR": "Proposal for a directive",
    "PROP_REG": "Proposal for a regulation",
    "PROP_DEC": "Proposal for a decision",
}

# Core road safety acts that the Publications Office does not index under "road safety".
# Keep this list short and give a reason for every entry; it is shown on the site.
CURATED_ADDITIONS: list[dict[str, str]] = [
    {"celex": "32006L0126",
     "reason": "Core EU rules on driving licences; indexed under 'European driving licence', not 'road safety'."},
    {"celex": "31991L0671",
     "reason": "Compulsory use of safety belts and child-restraint systems; indexed under 'safety device'."},
    {"celex": "31992L0006",
     "reason": "Speed limitation devices for heavy vehicles; not indexed under 'road safety'."},
]

HTTP_TIMEOUT_SECONDS = 120
HTTP_RETRIES = 3
HTTP_MAX_BYTES = 30 * 1024 * 1024
USER_AGENT = "vision-zero-monitor/1.0 (+https://github.com/DaLuSt/Vision-Zero-Monitor)"

# Validation thresholds.
MIN_ACTS = 50                   # a much smaller register means the query or source broke
COUNT_DROP_FAIL_FRACTION = 0.20  # fail if acts drop by more than 20 % vs the previous file
