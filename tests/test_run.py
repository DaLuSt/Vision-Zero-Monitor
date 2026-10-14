"""End-to-end pipeline behaviour: export, unchanged detection, failure recovery."""

import json

from scripts.data_pipeline import run as run_mod
from scripts.data_pipeline.export import PUBLIC_FILES, write_atomic
from scripts.data_pipeline.fetch import FetchError
from scripts.data_pipeline.validate import validate_schema

import pytest


def clock(ts):
    return lambda: ts


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_full_run_from_fixtures(tmp_path, fixture_dir):
    outcome = run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-14T06:00:00Z"))
    assert outcome == "success"
    for name in PUBLIC_FILES:
        doc = read(tmp_path / f"{name}.json")
        assert validate_schema(name, doc) == [], name
    status = read(tmp_path / "pipeline_status.json")
    assert validate_schema("pipeline_status", status) == []
    assert status["last_outcome"] == "success"
    meta = read(tmp_path / "metadata.json")
    assert meta["validation"]["passed"] is True
    assert meta["frequency_notice"].startswith("Official fatality statistics are published periodically.")
    assert meta["targets"][0]["target_value"] == 11378.5
    assert not list(tmp_path.glob(".tmp-*"))


def test_unchanged_source_does_not_rewrite(tmp_path, fixture_dir):
    run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-14T06:00:00Z"))
    before = {n: (tmp_path / f"{n}.json").read_bytes() for n in [*PUBLIC_FILES, "pipeline_status"]}
    outcome = run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-21T06:00:00Z"))
    assert outcome == "unchanged"
    after = {n: (tmp_path / f"{n}.json").read_bytes() for n in before}
    assert before == after


def test_fetch_failure_preserves_previous_data(tmp_path, fixture_dir):
    run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-14T06:00:00Z"))
    before = {n: (tmp_path / f"{n}.json").read_bytes() for n in PUBLIC_FILES}

    def broken():
        raise FetchError("Could not retrieve https://ec.europa.eu/...: HTTP 503")

    outcome = run_mod.run(tmp_path, fetcher=broken, now=clock("2026-10-21T06:00:00Z"))
    assert outcome == "failure"
    assert before == {n: (tmp_path / f"{n}.json").read_bytes() for n in PUBLIC_FILES}
    status = read(tmp_path / "pipeline_status.json")
    assert status["last_outcome"] == "failure"
    assert status["last_attempt_at"] == "2026-10-21T06:00:00Z"
    assert status["last_success_at"] == "2026-10-14T06:00:00Z"
    assert "HTTP 503" in status["message"]

    # Recovery with unchanged data records the recovery but keeps data files untouched.
    outcome = run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-28T06:00:00Z"))
    assert outcome == "unchanged"
    assert read(tmp_path / "pipeline_status.json")["last_outcome"] == "unchanged"
    assert before == {n: (tmp_path / f"{n}.json").read_bytes() for n in PUBLIC_FILES}


def test_invalid_source_does_not_publish(tmp_path, fixture_dir):
    run_mod.run(tmp_path, from_raw=fixture_dir, now=clock("2026-10-14T06:00:00Z"))
    before = (tmp_path / "observations.json").read_bytes()
    raw = run_mod.load_raw(fixture_dir)
    raw["eurostat:tran_sf_roadus"].payload["value"] = {}  # empty dataset from the source

    outcome = run_mod.run(tmp_path, fetcher=lambda: raw, now=clock("2026-10-21T06:00:00Z"))
    assert outcome == "failure"
    assert (tmp_path / "observations.json").read_bytes() == before
    assert "ValidationFailed" in read(tmp_path / "pipeline_status.json")["message"]


def test_first_run_failure_writes_no_data(tmp_path):
    def broken():
        raise FetchError("offline")
    assert run_mod.run(tmp_path, fetcher=broken, now=clock("2026-10-14T06:00:00Z")) == "failure"
    assert not (tmp_path / "observations.json").exists()
    assert read(tmp_path / "pipeline_status.json")["last_success_at"] is None


def test_write_atomic_rejects_unexpected_names(tmp_path):
    with pytest.raises(ValueError):
        write_atomic(tmp_path, {"../../etc/passwd": {}})


def test_cli_exit_codes(tmp_path, fixture_dir, monkeypatch):
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    assert run_mod.main(["--output", str(tmp_path), "--from-raw", str(fixture_dir)]) == 0
    assert run_mod.main(["--output", str(tmp_path), "--from-raw", str(tmp_path / "nope")]) == 1


def test_committed_public_data_is_valid():
    """The dataset committed in public/data must satisfy every schema (guards manual edits)."""
    root = run_mod.ROOT / "public" / "data"
    for name in [*PUBLIC_FILES, "pipeline_status"]:
        assert validate_schema(name, read(root / f"{name}.json")) == [], name
