"""Static configuration: sources, geography, indicators, targets.

Everything the pipeline needs to know about the outside world is declared here,
so that source changes are reviewed in one place.
"""

from __future__ import annotations

SCHEMA_VERSION = "1.0.0"

EUROSTAT_API_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"
EUROSTAT_BROWSER = "https://ec.europa.eu/eurostat/databrowser/view/{code}/default/table"

EU_AGGREGATE = "EU27_2020"

# Eurostat geo code -> (ISO 3166-1 alpha-2, English name). Eurostat uses EL for Greece.
MEMBER_STATES: dict[str, tuple[str, str]] = {
    "BE": ("BE", "Belgium"),
    "BG": ("BG", "Bulgaria"),
    "CZ": ("CZ", "Czechia"),
    "DK": ("DK", "Denmark"),
    "DE": ("DE", "Germany"),
    "EE": ("EE", "Estonia"),
    "IE": ("IE", "Ireland"),
    "EL": ("GR", "Greece"),
    "ES": ("ES", "Spain"),
    "FR": ("FR", "France"),
    "HR": ("HR", "Croatia"),
    "IT": ("IT", "Italy"),
    "CY": ("CY", "Cyprus"),
    "LV": ("LV", "Latvia"),
    "LT": ("LT", "Lithuania"),
    "LU": ("LU", "Luxembourg"),
    "HU": ("HU", "Hungary"),
    "MT": ("MT", "Malta"),
    "NL": ("NL", "Netherlands"),
    "AT": ("AT", "Austria"),
    "PL": ("PL", "Poland"),
    "PT": ("PT", "Portugal"),
    "RO": ("RO", "Romania"),
    "SI": ("SI", "Slovenia"),
    "SK": ("SK", "Slovakia"),
    "FI": ("FI", "Finland"),
    "SE": ("SE", "Sweden"),
}

GEO_NAMES: dict[str, str] = {
    EU_AGGREGATE: "European Union (27 countries, from 2020)",
    **{code: name for code, (_, name) in MEMBER_STATES.items()},
}

ALL_GEOS: list[str] = [EU_AGGREGATE, *MEMBER_STATES]

# Datasets fetched from the Eurostat API. `params` are fixed dimension filters.
SOURCES: dict[str, dict] = {
    "eurostat:tran_sf_roadus": {
        "dataset": "tran_sf_roadus",
        "role": "primary",
        "title": "Persons killed in road accidents by age, sex and category of persons involved",
        "publisher": "Eurostat (data compiled by European Commission DG MOVE, CARE database)",
        "params": {"sex": "T", "age": "TOTAL", "pers_cat": "TOTAL", "unit": ["NR", "P_MHAB"]},
        "license": "Eurostat reuse policy (Commission Decision 2011/833/EU); reuse with acknowledgement of the source",
        "metadata_url": "https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm",
    },
    "eurostat:demo_gind": {
        "dataset": "demo_gind",
        "role": "denominator",
        "title": "Population change - demographic balance and crude rates at national level (average population)",
        "publisher": "Eurostat",
        "params": {"indic_de": "AVG", "sinceTimePeriod": "1999"},
        "license": "Eurostat reuse policy (Commission Decision 2011/833/EU); reuse with acknowledgement of the source",
        "metadata_url": "https://ec.europa.eu/eurostat/cache/metadata/en/demo_gind_esms.htm",
    },
    "eurostat:sdg_11_40": {
        "dataset": "sdg_11_40",
        "role": "cross_check",
        "title": "Road traffic deaths, by type of roads",
        "publisher": "Eurostat",
        "params": {"tra_infr": "TOTAL", "unit": ["NR", "RT"]},
        "license": "Eurostat reuse policy (Commission Decision 2011/833/EU); reuse with acknowledgement of the source",
        "metadata_url": "https://ec.europa.eu/eurostat/cache/metadata/en/sdg_11_40_esmsip2.htm",
    },
}

INDICATORS: list[dict] = [
    {
        "id": "road_fatalities",
        "name": "Road fatalities",
        "description": "Persons killed in road traffic accidents, including those who die within 30 days of the accident.",
        "unit": "persons",
        "value_type": "count",
        "source_id": "eurostat:tran_sf_roadus",
        "derivation": "Source value (sex=T, age=TOTAL, pers_cat=TOTAL, unit=NR).",
    },
    {
        "id": "population_average",
        "name": "Average population",
        "description": "Average population of the reference year (mean of 1 January populations of two consecutive years).",
        "unit": "persons",
        "value_type": "count",
        "source_id": "eurostat:demo_gind",
        "derivation": "Source value (indic_de=AVG).",
    },
    {
        "id": "road_fatalities_per_million",
        "name": "Road fatalities per million inhabitants",
        "description": "Road fatalities divided by average population, multiplied by 1,000,000.",
        "unit": "per million inhabitants",
        "value_type": "rate",
        "source_id": "derived:road_fatalities_per_million",
        "derivation": "road_fatalities / population_average * 1e6, rounded to 1 decimal. Status is the most cautious of the two inputs.",
    },
]

TARGETS: list[dict] = [
    {
        "id": "eu_2030_fatalities_halving",
        "name": "EU 2030 road-death benchmark (fatality component)",
        "geo": EU_AGGREGATE,
        "indicator": "road_fatalities",
        "baseline_period": "2019",
        "target_period": "2030",
        "reduction_fraction": 0.5,
        "policy_reference": "EU Road Safety Policy Framework 2021-2030 – Next steps towards 'Vision Zero' (SWD(2019) 283)",
        "policy_url": "https://transport.ec.europa.eu/transport-themes/road-safety_en",
        "note": (
            "The EU objective is to halve both road deaths and serious injuries by 2030 compared with 2019. "
            "This benchmark covers road deaths only and does not by itself measure the serious-injury objective. "
            "Vision Zero is the long-term ambition of moving close to zero road deaths by 2050."
        ),
    }
]

# Validation thresholds.
REVISION_WARN_FRACTION = 0.05      # flag value revisions larger than 5 %
COVERAGE_DROP_FAIL_FRACTION = 0.10  # fail if non-null observations drop by >10 %
CROSS_CHECK_RATE_TOLERANCE = 0.06  # per 100k: sdg_11_40 rounds to 1 decimal
SOURCE_RATE_WARN_FRACTION = 0.10   # tran_sf_roadus P_MHAB is an integer with its own denominator

HTTP_TIMEOUT_SECONDS = 60
HTTP_MAX_BYTES = 20 * 1024 * 1024
HTTP_RETRIES = 3
USER_AGENT = "eu-road-safety-observatory/1.0 (+https://github.com/DaLuSt/eu-road-safety-observatory)"
