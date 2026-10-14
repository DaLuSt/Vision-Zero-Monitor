import copy

from scripts.data_pipeline.transform import transform
from scripts.data_pipeline.validate import check_observations, compare_with_previous, cross_check, validate_schema


def codes(issues, level=None):
    return {i["code"] for i in issues if level is None or i["level"] == level}


def real(raw_sources):
    r = transform(raw_sources)
    return r.observations, {s["id"] for s in r.sources}, r


def test_real_data_has_no_errors(raw_sources):
    obs, sids, _ = real(raw_sources)
    assert codes(check_observations(obs, sids), "error") == set()


def test_duplicates_detected(raw_sources):
    obs, sids, _ = real(raw_sources)
    obs.append(copy.deepcopy(obs[0]))
    assert "duplicate" in codes(check_observations(obs, sids), "error")


def test_negative_and_non_integer_counts(raw_sources):
    obs, sids, _ = real(raw_sources)
    obs[0]["value"] = -1
    obs[3]["value"] = 12.5
    errs = codes(check_observations(obs, sids), "error")
    assert {"negative", "integer"} <= errs


def test_missing_must_be_null_not_zero(raw_sources):
    obs, sids, _ = real(raw_sources)
    obs[0]["status"] = "missing"  # value still present
    assert "missing" in codes(check_observations(obs, sids), "error")


def test_invalid_geo_status_unit_source(raw_sources):
    obs, sids, _ = real(raw_sources)
    obs[0]["geo"] = "XX"
    obs[1]["status"] = "definitive"
    obs[2]["unit"] = "per 100k"
    obs[4]["source_id"] = "somewhere:else"
    errs = codes(check_observations(obs, sids), "error")
    assert {"geo", "status", "unit", "source"} <= errs


def test_wrong_rate_denominator(raw_sources):
    obs, sids, _ = real(raw_sources)
    rate = next(o for o in obs if o["indicator"] == "road_fatalities_per_million" and o["value"])
    rate["value"] = rate["value"] / 10  # e.g. per 100k mistakenly
    assert "rate_denominator" in codes(check_observations(obs, sids), "error")


def test_eu_double_counting_detected(raw_sources):
    obs, sids, _ = real(raw_sources)
    for o in obs:
        if o["geo"] == "EU27_2020" and o["indicator"] == "road_fatalities" and o["period"] == "2019":
            o["value"] = o["value"] * 2
    assert "double_count" in codes(check_observations(obs, sids), "error")


def test_coverage_gap_is_warning(raw_sources):
    obs, sids, _ = real(raw_sources)
    for o in obs:
        if o["geo"] == "MT" and o["period"] == "2024" and o["indicator"] != "population_average":
            o["value"], o["status"] = None, "missing"
    issues = check_observations(obs, sids)
    assert "coverage" in codes(issues, "warning")
    assert not codes(issues, "error")


def test_missing_baseline_is_error(raw_sources):
    obs, sids, _ = real(raw_sources)
    for o in obs:
        if o["geo"] == "EU27_2020" and o["period"] == "2019" and o["indicator"] == "road_fatalities":
            o["value"], o["status"] = None, "missing"
    assert "baseline" in codes(check_observations(obs, sids), "error")


def test_cross_check_flags_inconsistent_source_rate(raw_sources):
    obs, _, r = real(raw_sources)
    issues = cross_check(obs, r.cross_check)
    msgs = [i["message"] for i in issues if i["code"] == "source_rate_inconsistent"]
    assert any(m.startswith("EU27_2020") for m in msgs)
    assert "cross_check_counts" not in codes(issues)
    assert "cross_check_rates" not in codes(issues)


def test_revision_detection(raw_sources):
    obs, _, _ = real(raw_sources)
    previous = copy.deepcopy(obs)
    target = next(o for o in obs if o["geo"] == "NL" and o["indicator"] == "road_fatalities" and o["period"] == "2023")
    target["value"] = int(target["value"] * 1.2)
    summary, issues = compare_with_previous(obs, previous, "2026-10-01T00:00:00Z")
    assert summary["changed"] == 1
    assert summary["examples"][0]["geo"] == "NL"
    assert "large_revision" in codes(issues, "warning")
    assert not codes(issues, "error")


def test_small_revision_is_not_flagged(raw_sources):
    obs, _, _ = real(raw_sources)
    previous = copy.deepcopy(obs)
    target = next(o for o in obs if o["geo"] == "DE" and o["indicator"] == "road_fatalities" and o["period"] == "2023")
    target["value"] += 3
    summary, issues = compare_with_previous(obs, previous, None)
    assert summary["changed"] == 1 and not issues


def test_coverage_drop_is_error(raw_sources):
    obs, _, _ = real(raw_sources)
    previous = copy.deepcopy(obs)
    for o in obs[: len(obs) // 3]:
        o["value"], o["status"] = None, "missing"
    _, issues = compare_with_previous(obs, previous, None)
    assert "coverage_drop" in codes(issues, "error")


def test_latest_period_regression_is_error(raw_sources):
    obs, _, _ = real(raw_sources)
    previous = copy.deepcopy(obs)
    obs = [o for o in obs if o["period"] != "2024"]
    _, issues = compare_with_previous(obs, previous, None)
    assert "latest_period_regressed" in codes(issues, "error")


def test_schema_rejects_bad_status():
    doc = {"schema_version": "1.0.0", "generated_at": "2026-10-14T00:00:00Z", "observations": [{
        "geo": "NL", "geo_name": "Netherlands", "indicator": "road_fatalities", "period": "2024", "frequency": "annual",
        "value": 1, "unit": "persons", "status": "definitive", "source_flag": None, "source_id": "x",
        "source_url": "https://example.org", "source_published_at": None, "retrieved_at": "2026-10-14T00:00:00Z"}]}
    assert validate_schema("observations", doc)
    doc["observations"][0]["status"] = "unknown"
    assert validate_schema("observations", doc) == []
    doc["observations"][0]["retrieved_at"] = "yesterday"
    assert validate_schema("observations", doc)
