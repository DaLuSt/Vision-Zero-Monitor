import copy
import math

import pytest

from scripts.data_pipeline import config
from scripts.data_pipeline.breakdowns import build_breakdowns, series_index
from scripts.data_pipeline.jsonstat import SchemaChangeError
from scripts.data_pipeline.transform import content_hash, transform
from scripts.data_pipeline.validate import check_breakdowns, validate_schema


def build(raw):
    r = transform(raw)
    return build_breakdowns(r.parsed, raw, r.periods, "2026-10-14T06:00:00Z"), r.observations


def at(doc, geo, dim, cat, period):
    s = series_index(doc)[(geo, dim, cat)]
    i = doc["periods"].index(period)
    return s["values"][i], s["statuses"][i]


def drop_cell(payload, **coords):
    """Delete one value from a real JSON-stat response."""
    ids = payload["id"]
    strides = [math.prod(payload["size"][i + 1:]) for i in range(len(ids))]
    flat = sum(payload["dimension"][d]["category"]["index"][coords[d]] * strides[i] for i, d in enumerate(ids))
    del payload["value"][str(flat)]


def test_road_user_breakdown_matches_source(raw_sources):
    doc, _ = build(raw_sources)
    assert at(doc, "EU27_2020", "road_user", "PED", "2024") == (3537, "unknown")
    assert at(doc, "EU27_2020", "road_user", "DRIV", "2024") == (13512, "unknown")


def test_vehicle_groups_sum_their_source_categories(raw_sources):
    doc, _ = build(raw_sources)
    # MOTO_2WH is a residual "n.e.c." code, not a total: the group must add all four.
    assert at(doc, "EU27_2020", "vehicle", "MOTO", "2024")[0] == 306 + 1875 + 607 + 951
    assert at(doc, "EU27_2020", "vehicle", "CYCLE", "2024")[0] == 1498 + 314
    assert at(doc, "EU27_2020", "vehicle", "CAR", "2024")[0] == 8693


@pytest.mark.parametrize("dim", ["road_user", "vehicle", "age", "sex", "road_type"])
def test_categories_partition_the_total(raw_sources, dim):
    doc, obs = build(raw_sources)
    total = next(o["value"] for o in obs if o["geo"] == "EU27_2020" and o["indicator"] == "road_fatalities" and o["period"] == "2024")
    cats = [c["id"] for d in doc["dimensions"] if d["id"] == dim for c in d["categories"]]
    assert sum(at(doc, "EU27_2020", dim, c, "2024")[0] for c in cats) == total


def test_age_sex_and_road_type_match_source(raw_sources):
    doc, _ = build(raw_sources)
    assert at(doc, "EU27_2020", "age", "Y_GE65", "2024") == (6106, "unknown")
    assert at(doc, "EU27_2020", "age", "Y15_17", "2024")[0] == 453  # source code Y15-17
    assert at(doc, "EU27_2020", "sex", "F", "2024")[0] == 4527
    assert at(doc, "NL", "sex", "M", "2024")[0] == 391
    assert at(doc, "EU27_2020", "road_type", "MWAY", "2024")[0] == 1693
    assert at(doc, "EU27_2020", "road_type", "RD_RUR", "2024")[0] == 10629


def test_only_age_is_ordinal(raw_sources):
    doc, _ = build(raw_sources)
    assert {d["id"]: d.get("ordinal", False) for d in doc["dimensions"]} == {
        "road_user": False, "vehicle": False, "age": True, "sex": False, "road_type": False}


def test_sex_uses_its_own_total_code(raw_sources):
    # In tran_sf_roadus the sex total is "T", not "TOTAL"; it must not be treated as a category.
    doc, _ = build(raw_sources)
    sex = next(d for d in doc["dimensions"] if d["id"] == "sex")
    assert [c["id"] for c in sex["categories"]] == ["M", "F", "UNK"]
    idx = raw_sources["eurostat:tran_sf_roadus"].payload["dimension"]["sex"]["category"]["index"]
    idx["X"] = idx.pop("T")
    with pytest.raises(SchemaChangeError, match=r"sex lacks .*\bT\b"):
        build(raw_sources)


def test_new_age_band_fails_loudly(raw_sources):
    idx = raw_sources["eurostat:tran_sf_roadus"].payload["dimension"]["age"]["category"]["index"]
    idx["Y_GE75"] = idx.pop("UNK")
    with pytest.raises(SchemaChangeError, match="Y_GE75"):
        build(raw_sources)


def test_pedestrians_agree_across_datasets(raw_sources):
    doc, _ = build(raw_sources)
    assert at(doc, "NL", "road_user", "PED", "2024") == at(doc, "NL", "vehicle", "PED", "2024")


def test_explicit_gaps_for_unreported_years(raw_sources):
    doc, _ = build(raw_sources)
    # Several Member States did not report breakdowns for the earliest years.
    assert at(doc, "DE", "vehicle", "CAR", "1999") == (None, "missing")
    assert len(series_index(doc)) == len(config.ALL_GEOS) * sum(len(b["categories"]) for b in config.BREAKDOWNS)


def test_group_with_a_missing_part_is_missing_not_undercounted(raw_sources):
    drop_cell(raw_sources["eurostat:tran_sf_roadve"].payload, freq="A", unit="NR", vehicle="MOTO_NSP", geo="NL", time="2024")
    doc, _ = build(raw_sources)
    assert at(doc, "NL", "vehicle", "MOTO", "2024") == (None, "missing")
    assert at(doc, "NL", "vehicle", "CAR", "2024")[0] is not None


def test_new_source_category_fails_loudly(raw_sources):
    idx = raw_sources["eurostat:tran_sf_roadve"].payload["dimension"]["vehicle"]["category"]["index"]
    idx["HOVERBOARD"] = idx.pop("UNK")
    with pytest.raises(SchemaChangeError, match="HOVERBOARD"):
        build(raw_sources)


def test_published_document_is_schema_valid_and_clean(raw_sources):
    doc, obs = build(raw_sources)
    assert validate_schema("breakdowns", doc) == []
    issues = check_breakdowns(doc, obs, None)
    assert [i for i in issues if i["level"] == "error"] == []
    # The only known source discrepancy: Malta 2009 pedestrians (4 vs 0 'Other').
    assert [i["code"] for i in issues] == ["pedestrian_mismatch"]
    assert "MT 2009" in issues[0]["message"]


def test_validation_errors(raw_sources):
    doc, obs = build(raw_sources)
    bad = copy.deepcopy(doc)
    bad["series"][0]["values"] = bad["series"][0]["values"][:-1]
    assert "alignment" in {i["code"] for i in check_breakdowns(bad, obs)}
    bad = copy.deepcopy(doc)
    bad["series"].append(copy.deepcopy(bad["series"][0]))
    assert "duplicate" in {i["code"] for i in check_breakdowns(bad, obs)}
    bad = copy.deepcopy(doc)
    bad["series"][0]["statuses"][-1] = "missing"
    assert "missing" in {i["code"] for i in check_breakdowns(bad, obs)}
    bad = copy.deepcopy(doc)
    bad["series"] = [s for s in bad["series"] if not (s["geo"] == "NL" and s["category"] == "CAR")]
    assert "incomplete" in {i["code"] for i in check_breakdowns(bad, obs)}


def test_sum_mismatch_is_a_warning(raw_sources):
    doc, obs = build(raw_sources)
    s = series_index(doc)[("EU27_2020", "vehicle", "CAR")]
    s["values"][doc["periods"].index("2024")] += 1000
    issues = check_breakdowns(doc, obs)
    assert {i["code"]: i["level"] for i in issues}["breakdown_sum"] == "warning"


def test_coverage_collapse_is_an_error(raw_sources):
    doc, obs = build(raw_sources)
    shrunk = copy.deepcopy(doc)
    for s in shrunk["series"][: len(shrunk["series"]) // 2]:
        s["values"] = [None] * len(s["values"])
        s["statuses"] = ["missing"] * len(s["statuses"])
    assert "coverage_drop" in {i["code"] for i in check_breakdowns(shrunk, obs, previous=doc) if i["level"] == "error"}


def test_breakdown_changes_change_the_content_hash(raw_sources):
    doc, obs = build(raw_sources)
    r = transform(raw_sources)
    before = content_hash(obs, r.sources, doc)
    series_index(doc)[("NL", "vehicle", "CAR")]["values"][-1] += 1
    assert content_hash(obs, r.sources, doc) != before


def test_eu_coverage_is_recorded(raw_sources):
    doc, _ = build(raw_sources)
    cov = {d["id"]: dict(zip(doc["periods"], d["eu_members_reporting"])) for d in doc["dimensions"]}
    for dim in cov.values():
        assert dim["1999"] == 15  # 12 Member States did not yet report breakdowns
    for dim in ("road_user", "vehicle", "age"):
        assert cov[dim]["2015"] == 26
        assert all(cov[dim][p] == 27 for p in doc["periods"] if p >= "2016")
    assert cov["sex"]["2015"] == 25  # Bulgaria and Slovakia
    # Malta did not report deaths by type of road for 2019, so the EU 2019 road-type figures are withheld.
    assert cov["road_type"]["2019"] == 26
    assert all(cov["road_type"][p] == 27 for p in doc["periods"] if p >= "2020")
