"""Policy commitments: curated-file rules, target calculations and run behaviour."""

import copy
import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from scripts.commitments import build as b
from scripts.commitments.verify_sources import normalise
from scripts.data_pipeline.validate import validate_schema

ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = json.loads((ROOT / "public" / "data" / "observations.json").read_text(encoding="utf-8"))
# Test clocks follow the curated review date, so a new review never makes these tests stale.
REVIEWED = json.loads(b.CURATED.read_text(encoding="utf-8"))["reviewed_at"]
NOW = f"{REVIEWED}T06:00:00Z"
LATER = (date.fromisoformat(REVIEWED) + timedelta(days=5)).isoformat() + "T06:00:00Z"


def clock(ts):
    return lambda: ts


@pytest.fixture
def curated():
    return copy.deepcopy(json.loads(b.CURATED.read_text(encoding="utf-8")))


def synthetic_obs(values: dict[int, float], geo="EU27_2020"):
    return {"observations": [
        {"geo": geo, "indicator": "road_fatalities", "period": str(y), "value": v, "status": "unknown"}
        for y, v in values.items()
    ]}


def target(**kw):
    t = {"id": "t", "indicator": "road_deaths", "description": "test", "reduction": 0.5, "baseline_year": 2020,
         "target_year": 2030, "measure": {"geo": "EU27_2020", "indicator": "road_fatalities"},
         "not_measured_reason": None, "scope_note": None, "monitoring_baselines": []}
    t.update(kw)
    return t


def codes(issues):
    return {i["code"] for i in issues if i["level"] == "error"}


# --- curated file ----------------------------------------------------------------

def test_curated_file_is_valid(curated):
    assert b.check(curated, OBSERVATIONS, REVIEWED) == []


def test_every_commitment_has_a_primary_official_source_with_a_quote(curated):
    for c in curated["commitments"]:
        primaries = [s for s in c["sources"] if s["role"] == "primary"]
        assert primaries, c["id"]
        for s in c["sources"]:
            assert s["url"].startswith("https://")
            assert len(s["quote"]) >= 20
        assert "not legally binding" in c["nature"].lower() or "not legally binding" in c["nature"]


def test_2030_target_is_recorded_as_stated_and_with_the_commission_monitoring_baseline(curated):
    c = next(c for c in curated["commitments"] if c["id"] == "eu-2030-interim-targets")
    deaths = next(t for t in c["targets"] if t["id"] == "deaths")
    assert (deaths["baseline_year"], deaths["target_year"], deaths["reduction"]) == (2020, 2030, 0.5)
    assert [m["year"] for m in deaths["monitoring_baselines"]] == [2019]
    assert "between 2020 and 2030" in c["sources"][0]["quote"]


# --- calculations ------------------------------------------------------------------

def test_built_document_uses_official_figures():
    doc = b.build(json.loads(b.CURATED.read_text(encoding="utf-8")), OBSERVATIONS, NOW)
    assert validate_schema("commitments", doc) == []
    by_id = {c["id"]: c for c in doc["commitments"]}

    halving_2020 = by_id["eu-2020-halving"]["targets"][0]["outcomes"][0]
    assert halving_2020["baseline_value"] == 29611
    assert halving_2020["target_value"] == 14805.5
    assert (halving_2020["compare_year"], halving_2020["compare_value"]) == (2020, 18830)
    assert halving_2020["deadline_passed"] is True
    assert halving_2020["change_pct"] == -36.4
    assert halving_2020["above_target_value"] is True

    stated, monitoring = by_id["eu-2030-interim-targets"]["targets"][0]["outcomes"]
    assert (stated["basis"], stated["baseline_year"], stated["target_value"]) == ("as_stated", 2020, 9415.0)
    assert (monitoring["basis"], monitoring["baseline_year"], monitoring["target_value"]) == ("commission_monitoring", 2019, 11378.5)
    assert stated["deadline_passed"] is False and stated["compare_year"] == 2024

    vz = by_id["eu-2050-vision-zero"]["targets"][0]
    assert vz["outcomes"] == [] and vz["reference"]["period"] == 2024
    assert doc["summary"] == {"commitments": 12, "targets": 14, "targets_measured": 6}
    national = {c["id"]: c for c in doc["commitments"] if c["level"] == "national"}
    es = national["es-esv-2030"]["targets"][0]["outcomes"][0]
    assert (es["baseline_value"], es["target_value"]) == (1755, 877.5)  # the strategy's own baseline figure
    pl = national["pl-npbrd-2021-2030"]["targets"][0]["outcomes"][0]
    assert (pl["baseline_value"], pl["target_value"]) == (2909, 1454.5)  # "no more than 1455"
    assert national["de-vsp-2021-2030"]["targets"][0]["outcomes"] == []  # no baseline year stated
    se = national["se-etappmal-2030"]["targets"][0]["outcomes"][0]
    # Mean of Eurostat 2017–2019 (253, 324, 221), as in the Swedish target; at most 133 in 2030.
    assert (se["baseline_average_of"], se["baseline_value"], se["target_value"]) == ([2017, 2018, 2019], 266.0, 133.0)
    # EU commitments first, newest first within each level.
    levels = [c["level"] for c in doc["commitments"]]
    assert levels == sorted(levels, key=lambda lv: lv != "eu")


def test_outcome_before_the_deadline_uses_the_latest_year():
    obs = b.index_observations(synthetic_obs({2020: 1000, 2023: 900, 2024: 800}))
    o = b.outcome(obs, target(), 2020, "as_stated")
    assert (o["target_value"], o["compare_year"], o["compare_value"]) == (500.0, 2024, 800)
    assert o["change_pct"] == -20.0
    assert o["share_of_required_reduction"] == 0.4
    assert o["deadline_passed"] is False and o["above_target_value"] is True


def test_outcome_after_the_deadline_uses_the_target_year():
    obs = b.index_observations(synthetic_obs({2010: 1000, 2020: 480, 2024: 600}))
    o = b.outcome(obs, target(baseline_year=2010, target_year=2020), 2010, "as_stated")
    assert (o["compare_year"], o["compare_value"], o["above_target_value"]) == (2020, 480, False)
    assert o["share_of_required_reduction"] == 1.04


def test_outcome_with_missing_target_year_value_stays_missing():
    obs = b.index_observations(synthetic_obs({2010: 1000, 2021: 600}))
    o = b.outcome(obs, target(baseline_year=2010, target_year=2020), 2010, "as_stated")
    assert o["compare_year"] == 2020 and o["compare_value"] is None and o["change_pct"] is None


# --- validation rules ---------------------------------------------------------------

def test_duplicate_ids_are_errors(curated):
    curated["commitments"].append(copy.deepcopy(curated["commitments"][0]))
    assert "duplicate" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_baseline_must_precede_target(curated):
    curated["commitments"][0]["targets"][0]["baseline_year"] = 2031
    assert "years" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_unmeasured_target_needs_a_reason(curated):
    t = next(t for c in curated["commitments"] for t in c["targets"] if t["measure"] is None)
    t["not_measured_reason"] = None
    assert "reason" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_measured_target_needs_official_data(curated):
    curated["commitments"][0]["targets"][0]["measure"]["geo"] = "XX"
    assert "measure" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_review_date_cannot_be_in_the_future(curated):
    curated["reviewed_at"] = "2027-01-01"
    assert "review_date" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_schema_rejects_non_https_sources_and_missing_quotes(curated):
    curated["commitments"][0]["sources"][0]["url"] = "http://example.com"
    del curated["commitments"][1]["sources"][0]["quote"]
    assert "schema" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


# --- run ----------------------------------------------------------------------------

def test_run_writes_then_reports_unchanged(tmp_path):
    (tmp_path / "observations.json").write_text(json.dumps(OBSERVATIONS))
    assert b.run(tmp_path, now=clock(NOW)) == "success"
    first = (tmp_path / "commitments.json").read_bytes()
    assert b.run(tmp_path, now=clock(LATER)) == "unchanged"
    assert (tmp_path / "commitments.json").read_bytes() == first


def test_invalid_curated_file_keeps_the_previous_output(tmp_path, curated):
    (tmp_path / "observations.json").write_text(json.dumps(OBSERVATIONS))
    b.run(tmp_path, now=clock(NOW))
    before = (tmp_path / "commitments.json").read_bytes()
    curated["commitments"][0]["targets"][0]["baseline_year"] = 2040
    bad = tmp_path / "curated.json"
    bad.write_text(json.dumps(curated))
    assert b.run(tmp_path, curated_path=bad, now=clock(NOW)) == "failure"
    assert (tmp_path / "commitments.json").read_bytes() == before


def test_published_file_is_current_and_valid():
    published = json.loads((ROOT / "public" / "data" / "commitments.json").read_text(encoding="utf-8"))
    assert validate_schema("commitments", published) == []
    rebuilt = b.build(json.loads(b.CURATED.read_text(encoding="utf-8")), OBSERVATIONS, published["generated_at"])
    assert b.content_hash(rebuilt) == b.content_hash(published), "run python -m scripts.commitments.build"


# --- quote verification helper ------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("reducing deaths by 50 % between", "reducingdeathsby50%between"),
    ("road-\n safety  “Vision Zero”", 'roadsafety"visionzero"'),
    ("2021–2030", "2021-2030"),
    # PDF extraction artefacts on both sides match the same quote.
    ("Trafikv erket nyttetappmål", "trafikverketnyttetappmål"),
])
def test_normalise(raw, expected):
    assert normalise(raw) == expected


# --- national strategies -----------------------------------------------------------

def national(curated, cid="es-esv-2030"):
    return next(c for c in curated["commitments"] if c["id"] == cid)


def test_national_strategies_have_a_country_and_translated_quotes(curated):
    for c in curated["commitments"]:
        assert (c["level"] == "national") == ("geo" in c) == (c["form"] == "national_strategy")
        for s in c["sources"]:
            if s.get("language", "en") != "en":
                assert s["translation"]["kind"] in ("official", "own")


def test_national_target_must_be_measured_for_its_own_country(curated):
    national(curated)["targets"][0]["measure"]["geo"] = "PL"
    assert "measure" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_national_strategy_needs_a_geo(curated):
    del national(curated)["geo"]
    assert "national" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_non_english_quote_needs_a_translation(curated):
    del national(curated)["sources"][0]["translation"]
    assert "translation" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_official_translation_needs_its_source(curated):
    del national(curated)["sources"][0]["translation"]["url"]
    assert "translation" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_averaged_baseline_must_end_with_the_baseline_year(curated):
    national(curated, "se-etappmal-2030")["targets"][0]["baseline_average_of"] = [2017, 2018]
    assert "years" in codes(b.check(curated, OBSERVATIONS, REVIEWED))


def test_averaged_baseline_is_missing_if_any_year_is():
    obs = b.index_observations(synthetic_obs({2017: 100, 2019: 80, 2024: 60}, geo="SE"))
    t = target(measure={"geo": "SE", "indicator": "road_fatalities"}, baseline_year=2019, baseline_average_of=[2017, 2018, 2019])
    o = b.outcome(obs, t, 2019, "as_stated")
    assert (o["baseline_value"], o["target_value"]) == (None, None)
