import pytest

from scripts.data_pipeline import config
from scripts.data_pipeline.jsonstat import SchemaChangeError
from scripts.data_pipeline.transform import (
    build_latest, build_targets, content_hash, map_status, most_cautious, pct_change, to_utc_iso, transform,
)


def by_key(observations):
    return {(o["geo"], o["indicator"], o["period"]): o for o in observations}


def test_normalizes_real_data(raw_sources):
    result = transform(raw_sources)
    idx = by_key(result.observations)
    eu = idx[("EU27_2020", "road_fatalities", "2019")]
    assert eu["value"] == 22757
    assert eu["unit"] == "persons"
    assert eu["frequency"] == "annual"
    assert eu["source_id"] == "eurostat:tran_sf_roadus"
    assert eu["source_published_at"] == "2026-08-25T21:00:00Z"
    assert eu["retrieved_at"] == "2026-10-14T19:31:12Z"
    assert eu["source_url"].startswith("https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadus")
    # Greece uses the Eurostat code EL.
    assert idx[("EL", "road_fatalities", "2024")]["geo_name"] == "Greece"


def test_one_observation_per_geo_indicator_period(raw_sources):
    result = transform(raw_sources)
    keys = [(o["geo"], o["indicator"], o["period"]) for o in result.observations]
    assert len(keys) == len(set(keys))
    periods = {o["period"] for o in result.observations}
    assert len(keys) == len(config.ALL_GEOS) * 3 * len(periods)


def test_unflagged_values_are_unknown_not_final(raw_sources):
    result = transform(raw_sources)
    statuses = {o["status"] for o in result.observations if o["indicator"] == "road_fatalities"}
    assert "final" not in statuses
    assert statuses <= {"unknown", "missing", "provisional", "estimated"}


def test_rate_inherits_population_flag(raw_sources):
    idx = by_key(transform(raw_sources).observations)
    rate = idx[("EU27_2020", "road_fatalities_per_million", "2024")]
    assert rate["value"] == pytest.approx(19933 / 450068417 * 1e6, abs=0.05)
    assert rate["status"] == "estimated"  # population flagged 'ep'
    assert rate["source_flag"] == "ep"
    assert "population flagged 'ep'" in rate["status_note"]


def test_derived_rates_match_sdg_11_40(raw_sources):
    result = transform(raw_sources)
    idx = by_key(result.observations)
    checked = 0
    for key, sdg_rate in result.cross_check["sdg_rates_per_100k"].items():
        geo, period = key.split("|")
        ours = idx[(geo, "road_fatalities_per_million", period)]["value"]
        if ours is not None:
            assert ours / 10 == pytest.approx(sdg_rate, abs=0.06), key
            checked += 1
    assert checked > 500


def test_missing_values_are_null_not_zero(raw_sources):
    payload = raw_sources["eurostat:tran_sf_roadus"].payload
    # Remove NL 2024 deaths from the real response.
    dims = payload["id"]
    import math
    strides = [math.prod(payload["size"][i + 1:]) for i in range(len(dims))]
    coords = {"freq": "A", "sex": "T", "age": "TOTAL", "unit": "NR", "pers_cat": "TOTAL", "geo": "NL", "time": "2024"}
    flat = sum(payload["dimension"][d]["category"]["index"][coords[d]] * strides[i] for i, d in enumerate(dims))
    del payload["value"][str(flat)]
    idx = by_key(transform(raw_sources).observations)
    nl = idx[("NL", "road_fatalities", "2024")]
    assert nl["value"] is None and nl["status"] == "missing"
    rate = idx[("NL", "road_fatalities_per_million", "2024")]
    assert rate["value"] is None and rate["status"] == "missing"


@pytest.mark.parametrize("value, flag, expected", [
    (None, None, "missing"), (None, "p", "missing"), (10, None, "unknown"), (10, "p", "provisional"),
    (10, "e", "estimated"), (10, "ep", "estimated"), (10, "bp", "provisional"), (10, "b", "unknown"), (10, "", "unknown"),
])
def test_map_status(value, flag, expected):
    assert map_status(value, flag) == expected


def test_most_cautious():
    assert most_cautious("unknown", "provisional") == "provisional"
    assert most_cautious("final", "estimated") == "estimated"
    assert most_cautious("unknown", "final") == "unknown"


def test_to_utc_iso():
    assert to_utc_iso("2026-08-25T23:00:00+0200") == "2026-08-25T21:00:00Z"
    assert to_utc_iso(None) is None
    assert to_utc_iso("2026-08-25") is None  # naive dates are not guessed


def test_unexpected_time_format_raises(raw_sources):
    payload = raw_sources["eurostat:tran_sf_roadus"].payload
    idx = payload["dimension"]["time"]["category"]["index"]
    idx["2024-Q1"] = idx.pop("2024")
    with pytest.raises(SchemaChangeError, match="expected annual"):
        transform(raw_sources)


def test_missing_required_category_raises(raw_sources):
    payload = raw_sources["eurostat:tran_sf_roadus"].payload
    cat = payload["dimension"]["unit"]["category"]
    cat["index"] = {"NR": 0, "OTHER": 1}
    with pytest.raises(SchemaChangeError, match="P_MHAB"):
        transform(raw_sources)


def test_targets_and_latest(raw_sources):
    obs = transform(raw_sources).observations
    targets = build_targets(obs)
    t = targets[0]
    assert t["baseline_value"] == 22757
    assert t["target_value"] == 11378.5  # fractional benchmark preserved
    latest = build_latest(obs, targets, "2026-10-14T00:00:00Z")
    eu = latest["eu"]
    assert latest["latest_period"] == "2024"
    assert eu["fatalities"] == 19933
    assert eu["yoy_change_abs"] == 19933 - 20386
    assert eu["yoy_change_percent"] == pytest.approx((19933 - 20386) / 20386 * 100)
    assert eu["change_from_baseline_percent"] == pytest.approx((19933 - 22757) / 22757 * 100)
    assert eu["progress_towards_target_fraction"] == pytest.approx((22757 - 19933) / (22757 - 11378.5))
    assert latest["coverage"]["member_states_reporting"] == 27
    assert len(latest["countries"]) == 27


def test_pct_change_handles_missing():
    assert pct_change(None, 10) is None
    assert pct_change(10, None) is None
    assert pct_change(10, 0) is None
    assert pct_change(5, 10) == -50


def test_content_hash_ignores_retrieval_time(raw_sources):
    r1 = transform(raw_sources)
    for r in raw_sources.values():
        r.retrieved_at = "2030-01-01T00:00:00Z"
    r2 = transform(raw_sources)
    assert content_hash(r1.observations, r1.sources) == content_hash(r2.observations, r2.sources)
