"""Static configuration: sources, geography, indicators, targets.

Everything the pipeline needs to know about the outside world is declared here,
so that source changes are reviewed in one place.
"""

from __future__ import annotations

SCHEMA_VERSION = "1.1.0"

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
        # All person categories: TOTAL feeds road_fatalities, the rest the road-user breakdown.
        "params": {"sex": "T", "age": "TOTAL", "unit": ["NR", "P_MHAB"]},
        "license": "Eurostat reuse policy (Commission Decision 2011/833/EU); reuse with acknowledgement of the source",
        "metadata_url": "https://ec.europa.eu/eurostat/cache/metadata/en/tran_sf_road_esms.htm",
    },
    "eurostat:tran_sf_roadve": {
        "dataset": "tran_sf_roadve",
        "role": "breakdown",
        "title": "Persons killed in road accidents by type of vehicle",
        "publisher": "Eurostat (data compiled by European Commission DG MOVE, CARE database)",
        "params": {"unit": "NR"},
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
        "policy_url": "https://op.europa.eu/en/publication-detail/-/publication/d7ee4b58-4bc5-11ea-8aa5-01aa75ed71a1",
        "note": (
            "The EU Road Safety Policy Framework 2021-2030 sets the objective of halving road deaths and serious "
            "injuries between 2020 and 2030. The European Commission's own progress charts measure the road-death "
            "target against 2019, and this benchmark does the same (see the commitments page for both baselines). "
            "It covers road deaths only and does not by itself measure the serious-injury objective. "
            "Vision Zero is the long-term ambition of moving close to zero road deaths by 2050."
        ),
    }
]

# Breakdowns of road deaths. Each dimension's categories must partition the total:
# every source category (except TOTAL) is mapped to exactly one group, and an
# unmapped new source category is a hard failure so deaths are never dropped silently.
# Note: in tran_sf_roadve the parent-sounding codes (MOTO_2WH, VEH_GD, BUS_TOT) are
# residual "not elsewhere classified" categories, not totals of their sub-types, and
# OTH ("Other") holds people not in a vehicle, i.e. pedestrians (verified against
# tran_sf_roadus PED; see docs/DATA_SOURCES.md).
BREAKDOWNS: list[dict] = [
    {
        "id": "road_user",
        "label": "Road user",
        "description": "Persons killed by their role in the crash.",
        "source_id": "eurostat:tran_sf_roadus",
        "dimension": "pers_cat",
        "fixed": {"freq": "A", "sex": "T", "age": "TOTAL", "unit": "NR"},
        "categories": [
            {"id": "DRIV", "label": "Drivers and riders", "source_categories": ["DRIV"],
             "description": "Drivers of motor vehicles and riders of motorcycles, mopeds and bicycles."},
            {"id": "PAS", "label": "Passengers", "source_categories": ["PAS"],
             "description": "Passengers of any vehicle."},
            {"id": "PED", "label": "Pedestrians", "source_categories": ["PED"],
             "description": "People on foot."},
            {"id": "UNK", "label": "Unknown", "source_categories": ["UNK"],
             "description": "Role not recorded."},
        ],
    },
    {
        "id": "vehicle",
        "label": "Mode of transport",
        "description": "Persons killed by the vehicle they were using (pedestrians: none).",
        "source_id": "eurostat:tran_sf_roadve",
        "dimension": "vehicle",
        "fixed": {"freq": "A", "unit": "NR"},
        "categories": [
            {"id": "CAR", "label": "Car occupants", "source_categories": ["CAR"],
             "description": "Drivers and passengers of passenger cars."},
            {"id": "MOTO", "label": "Motorcyclists", "source_categories": ["MOTO_LE125", "MOTO_GT125", "MOTO_NSP", "MOTO_2WH"],
             "description": "Riders and passengers of motorcycles of any engine size."},
            {"id": "MOP", "label": "Moped riders", "source_categories": ["MOP"],
             "description": "Riders and passengers of mopeds."},
            {"id": "CYCLE", "label": "Cyclists", "source_categories": ["BIKE", "EPAC"],
             "description": "Riders of bicycles, including electrically assisted bicycles (e-bikes)."},
            {"id": "GOODS", "label": "Goods vehicles and tractors", "source_categories": ["VEH_GD", "VG_LE3P5", "VG_GT3P5", "TRC", "TRC_AGR"],
             "description": "Occupants of vans, lorries, road tractors and agricultural tractors."},
            {"id": "BUS", "label": "Buses and coaches", "source_categories": ["BUS_TOT", "BUS_MIN", "BUS", "BUS_TRO", "MCO"],
             "description": "Occupants of buses, mini-buses, trolley buses and motor coaches."},
            {"id": "PED", "label": "Pedestrians", "source_categories": ["OTH"],
             "description": "People not using a vehicle (Eurostat category 'Other')."},
            {"id": "OTHER", "label": "Other and unknown", "source_categories": ["QUA_LE50", "QUA_GT50", "MCMOB", "MTZ_OTH", "NMTZ_OTH", "ANI_RD", "TRM_LR", "UNK"],
             "description": "Quads, e-scooters and other micro-mobility, trams, other vehicles, riding animals, and unknown."},
        ],
    },
]

# Validation thresholds.
REVISION_WARN_FRACTION = 0.05      # flag value revisions larger than 5 %
COVERAGE_DROP_FAIL_FRACTION = 0.10  # fail if non-null observations drop by >10 %
CROSS_CHECK_RATE_TOLERANCE = 0.06  # per 100k: sdg_11_40 rounds to 1 decimal
SOURCE_RATE_WARN_FRACTION = 0.10   # tran_sf_roadus P_MHAB is an integer with its own denominator

BREAKDOWN_SUM_TOLERANCE = 0.01   # categories vs total: warn above max(2 deaths, 1 %)
PEDESTRIAN_TOLERANCE = 0.02      # road-user PED vs vehicle OTH: warn above max(2 deaths, 2 %)

HTTP_TIMEOUT_SECONDS = 60
HTTP_MAX_BYTES = 20 * 1024 * 1024
HTTP_RETRIES = 3
USER_AGENT = "vision-zero-monitor/1.0 (+https://github.com/DaLuSt/Vision-Zero-Monitor)"
