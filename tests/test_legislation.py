"""Legislation register: parsing, status rules, validation and run behaviour (saved real SPARQL responses)."""

import copy
import json
from pathlib import Path

import pytest

from scripts.data_pipeline.validate import validate_schema
from scripts.legislation import build, config
from scripts.legislation import run as run_mod
from scripts.legislation.sparql import SparqlError, _flatten
from scripts.legislation.validate import check_register

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "legislation_2026-10-15"
RETRIEVED = "2026-10-15T05:47:34Z"


def clock(ts):
    return lambda: ts


@pytest.fixture(scope="module")
def rows():
    return build.fetch_rows(run_mod.replay_runner(FIXTURE))


@pytest.fixture
def register(rows):
    return build.build_register(copy.deepcopy(rows), RETRIEVED, "2026-10-15T06:00:00Z")


def acts_by_celex(doc):
    return {a["celex"]: a for a in doc["acts"]}


# --- helpers -----------------------------------------------------------------

def test_flatten_sparql_json():
    payload = {"head": {"vars": ["celex", "title"]},
               "results": {"bindings": [{"celex": {"type": "literal", "value": "32015L0413"}}]}}
    assert _flatten(payload) == [{"celex": "32015L0413"}]


@pytest.mark.parametrize("value,expected", [
    ("2015-03-11", "2015-03-11"), ("2015-03-11T00:00:00", "2015-03-11"),
    ("9999-12-31", None), ("", None), (None, None), ("n/a", None),
])
def test_date_normalisation(value, expected):
    assert build._date(value) == expected


def test_dates_are_deduplicated_and_sorted():
    assert build._dates("2029-11-26|2027-11-26|2027-11-26|9999-12-31") == ["2027-11-26", "2029-11-26"]


@pytest.mark.parametrize("row,expected", [
    ({"number_prefix": "COM", "number_year": "2023", "number_seq": "0127", "celex": "52023PC0127"}, "COM(2023) 127"),
    ({"celex": "52014PC0476"}, "COM(2014) 476"),
    ({"celex": "52001PC0789(02)"}, "COM(2001) 789"),
    ({"celex": "32015L0413"}, None),
])
def test_com_reference(row, expected):
    assert build.com_reference(row) == expected


@pytest.mark.parametrize("row,expected", [
    ({"adopted_by": "32025L2205"}, "adopted"),
    ({"end_of_validity": "9999-12-31"}, "open"),
    ({}, "open"),
    ({"end_of_validity": "2020-06-30"}, "closed_without_act"),
])
def test_proposal_status(row, expected):
    assert build.proposal_status(row) == expected


# --- register from real responses --------------------------------------------

def test_register_is_schema_valid(register):
    assert validate_schema("legislation", register) == []
    assert [i for i in check_register(register) if i["level"] == "error"] == []


def test_register_counts(register):
    s = register["summary"]
    assert s["acts_total"] == len(register["acts"]) == 166
    assert s["acts_in_force"] == 122
    assert s["proposals_open"] == 6
    assert s["proposals_open_unclear"] == 2
    assert sum(s["acts_in_force_by_type"].values()) == s["acts_in_force"]


def test_known_act_lifecycle(register):
    acts = acts_by_celex(register)
    cbe = acts["32015L0413"]  # cross-border exchange of information on traffic offences
    assert cbe["type_label"] == "Directive"
    assert cbe["date_adopted"] == "2015-03-11"
    assert cbe["proposal"]["celex"] == "52014PC0476"
    assert cbe["proposal"]["reference"] == "COM(2014) 476"
    assert [r["celex"] for r in cbe["amended_by"]] == ["32024L3237"]
    assert cbe["amendment_proposals"] == ["52023PC0126"]
    assert cbe["url"] == "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32015L0413"

    licences = acts["32025L2205"]
    assert licences["transposition_deadlines"] == ["2027-11-26", "2028-11-26", "2029-11-26"]
    assert [r["celex"] for r in acts["32006L0126"]["repealed_by"]] == ["32025L2205"]


def test_curated_additions_are_labelled(register):
    acts = acts_by_celex(register)
    for c in config.CURATED_ADDITIONS:
        assert acts[c["celex"]]["inclusion"] == {"basis": "curated", "reason": c["reason"]}
    assert acts["32015L0413"]["inclusion"]["basis"] == "eurovoc"


def test_every_act_proposal_has_a_reference(register):
    with_proposal = [a for a in register["acts"] if a["proposal"]]
    assert with_proposal
    assert all(a["proposal"]["reference"] for a in with_proposal)


def test_proposals_are_commission_proposals_only(register):
    assert {p["type"] for p in register["proposals"]} <= set(config.PROPOSAL_TYPES)
    for p in register["proposals"]:
        if p["status"] == "adopted":
            assert p["adopted_by"]


def test_long_open_proposals_are_flagged(register):
    unclear = {p["reference"] for p in register["proposals"] if p["status"] == "open" and p["status_note"]}
    assert unclear == {"COM(2017) 602", "COM(2011) 451"}
    recent = [p for p in register["proposals"] if p["status"] == "open" and p["date_sent"] >= "2023"]
    assert recent and all(p["status_note"] is None for p in recent)


def test_register_has_provenance(register):
    src = register["source"]
    assert src["endpoint"] == config.SPARQL_ENDPOINT
    assert src["retrieved_at"] == RETRIEVED
    assert src["eurovoc"]["id"] == config.EUROVOC_ROAD_SAFETY


def test_content_hash_ignores_timestamps(rows):
    a = build.build_register(copy.deepcopy(rows), RETRIEVED, "2026-10-15T06:00:00Z")
    b = build.build_register(copy.deepcopy(rows), "2026-10-22T05:00:00Z", "2026-10-22T06:00:00Z")
    assert build.content_hash(a) == build.content_hash(b)
    b["acts"][0]["in_force"] = not b["acts"][0]["in_force"]
    assert build.content_hash(a) != build.content_hash(b)


# --- validation ----------------------------------------------------------------

def codes(issues, level="error"):
    return {i["code"] for i in issues if i["level"] == level}


def test_duplicate_acts_are_errors(register):
    register["acts"].append(copy.deepcopy(register["acts"][0]))
    assert "duplicate" in codes(check_register(register))


def test_missing_curated_act_is_an_error(register):
    register["acts"] = [a for a in register["acts"] if a["celex"] != "32006L0126"]
    assert "curated_missing" in codes(check_register(register))


def test_large_count_drop_is_an_error(register):
    previous = copy.deepcopy(register)
    register["acts"] = register["acts"][:100]
    issues = check_register(register, previous)
    assert "count_drop" in codes(issues)
    assert "removed" in codes(issues, "warning")


def test_too_few_acts_is_an_error(register):
    register["acts"] = [a for a in register["acts"] if a["inclusion"]["basis"] == "curated"]
    assert "too_few" in codes(check_register(register))


def test_adopted_proposal_without_act_is_an_error(register):
    p = next(p for p in register["proposals"] if p["status"] == "adopted")
    p["adopted_by"] = []
    assert "status" in codes(check_register(register))


def test_schema_rejects_non_eurlex_links(register):
    register["acts"][0]["url"] = "https://example.com/act"
    assert validate_schema("legislation", register)


# --- run -------------------------------------------------------------------------

def test_run_writes_then_reports_unchanged(tmp_path):
    runner = run_mod.replay_runner(FIXTURE)
    assert run_mod.run(tmp_path, runner, RETRIEVED, now=clock("2026-10-15T06:00:00Z")) == "success"
    target = tmp_path / "legislation.json"
    first = target.read_bytes()
    assert json.loads(first)["generated_at"] == "2026-10-15T06:00:00Z"
    assert run_mod.run(tmp_path, runner, "2026-10-22T05:00:00Z", now=clock("2026-10-22T06:00:00Z")) == "unchanged"
    assert target.read_bytes() == first
    assert not list(tmp_path.glob("*.tmp"))


def test_source_failure_keeps_previous_file(tmp_path):
    run_mod.run(tmp_path, run_mod.replay_runner(FIXTURE), RETRIEVED, now=clock("2026-10-15T06:00:00Z"))
    before = (tmp_path / "legislation.json").read_bytes()

    def broken(step, query):
        raise SparqlError("HTTP 503 from SPARQL endpoint")

    assert run_mod.run(tmp_path, broken, now=clock("2026-10-22T06:00:00Z")) == "failure"
    assert (tmp_path / "legislation.json").read_bytes() == before


def test_validation_failure_keeps_previous_file(tmp_path):
    run_mod.run(tmp_path, run_mod.replay_runner(FIXTURE), RETRIEVED, now=clock("2026-10-15T06:00:00Z"))
    before = (tmp_path / "legislation.json").read_bytes()
    replay = run_mod.replay_runner(FIXTURE)

    def truncated(step, query):
        rows = replay(step, query)
        return rows[:20] if step in ("discover_acts", "act_details") else rows

    assert run_mod.run(tmp_path, truncated, now=clock("2026-10-22T06:00:00Z")) == "failure"
    assert (tmp_path / "legislation.json").read_bytes() == before


def test_cli_replay_writes_github_output(tmp_path, monkeypatch):
    gh = tmp_path / "gh_output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(gh))
    assert run_mod.main(["--from-raw", str(FIXTURE), "--output", str(tmp_path)]) == 0
    assert "legislation_outcome=success" in gh.read_text()
    doc = json.loads((tmp_path / "legislation.json").read_text())
    assert doc["source"]["retrieved_at"] == RETRIEVED


def test_published_file_matches_fixture_build():
    published = json.loads((Path(__file__).resolve().parents[1] / "public" / "data" / "legislation.json").read_text())
    assert validate_schema("legislation", published) == []
    assert published["summary"]["acts_total"] >= config.MIN_ACTS
