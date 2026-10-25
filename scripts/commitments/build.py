"""Build public/data/commitments.json from the curated commitments and the official statistics.

Commitments (strategies, declarations, resolutions) are published as documents, not as
data, so they are curated by hand in data/curated/commitments.json, each with a verbatim
quote and a link to the official text (see scripts/commitments/verify_sources.py). This
step validates that file and, for every target that can be measured with the dashboard's
statistics, calculates the target value and the recorded outcome from observations.json.

Usage:
    python -m scripts.commitments.build [--observations FILE] [--output DIR]

Exit status 0 when the file was updated or is unchanged, 1 on failure (the previously
published file is then left untouched).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Callable

from ..data_pipeline.export import read_json
from ..data_pipeline.fetch import utc_now_iso
from ..data_pipeline.transform import most_cautious
from ..data_pipeline.validate import issue, validate_schema

log = logging.getLogger("commitments")
ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "curated" / "commitments.json"
DEFAULT_OUTPUT = ROOT / "public" / "data"
FILENAME = "commitments.json"
SCHEMA_VERSION = "1.0.0"

Observations = dict[tuple[str, str, int], dict]  # (geo, indicator, year) → observation


class CommitmentsFailed(RuntimeError):
    pass


def index_observations(doc: dict) -> Observations:
    out: Observations = {}
    for o in doc.get("observations", []):
        if re.fullmatch(r"\d{4}", str(o.get("period", ""))):
            out[(o["geo"], o["indicator"], int(o["period"]))] = o
    return out


def _value(obs: Observations, geo: str, ind: str, year: int) -> tuple[float | None, str | None]:
    o = obs.get((geo, ind, year))
    return (o["value"], o["status"]) if o and o.get("value") is not None else (None, None)


def _latest(obs: Observations, geo: str, ind: str) -> int | None:
    years = [y for (g, i, y), o in obs.items() if g == geo and i == ind and o.get("value") is not None]
    return max(years) if years else None


def _pct(new: float, base: float) -> float:
    return round((new - base) / base * 100, 1)


def _baseline(obs: Observations, geo: str, ind: str, years: list[int]) -> tuple[float | None, str | None]:
    """Official figure for one year, or the mean of several (missing if any year is missing)."""
    values = [_value(obs, geo, ind, y) for y in years]
    if any(v is None for v, _ in values):
        return None, None
    if len(values) == 1:
        return values[0]
    return round(sum(v for v, _ in values) / len(values), 1), most_cautious(*(st for _, st in values))


def outcome(obs: Observations, target: dict, baseline_year: int, basis: str) -> dict:
    """Target value and recorded outcome for one baseline. Values are official figures; nothing is estimated.

    A target stated against an average of several years (e.g. Sweden: mean of 2017–2019) uses that
    mean as its baseline; Commission monitoring baselines are single years.
    """
    geo, ind = target["measure"]["geo"], target["measure"]["indicator"]
    average = target.get("baseline_average_of") if basis == "as_stated" else None
    base, base_status = _baseline(obs, geo, ind, average or [baseline_year])
    latest = _latest(obs, geo, ind)
    target_year = target["target_year"]
    deadline_passed = latest is not None and latest >= target_year
    compare_year = target_year if deadline_passed else latest
    value, status = _value(obs, geo, ind, compare_year) if compare_year is not None else (None, None)
    result = {
        "basis": basis,
        "baseline_year": baseline_year,
        "baseline_value": base,
        "baseline_status": base_status,
        "target_year": target_year,
        "target_value": None,
        "required_change_pct": round(-target["reduction"] * 100, 1),
        "compare_year": compare_year,
        "compare_value": value,
        "compare_status": status,
        "deadline_passed": deadline_passed,
        "change_pct": None,
        "share_of_required_reduction": None,
        "above_target_value": None,
    }
    if average:
        result["baseline_average_of"] = average
    if base is not None:
        target_value = base * (1 - target["reduction"])
        result["target_value"] = round(target_value, 1)
        if value is not None:
            result["change_pct"] = _pct(value, base)
            result["share_of_required_reduction"] = round((base - value) / (base - target_value), 3)
            result["above_target_value"] = value > target_value
    return result


def build(curated: dict, observations: dict, generated_at: str) -> dict:
    obs = index_observations(observations)
    commitments = []
    for c in curated["commitments"]:
        targets = []
        for t in c["targets"]:
            t = dict(t)
            t["outcomes"] = []
            t["reference"] = None
            m = t.get("measure")
            if m and t.get("reduction") is not None and t.get("baseline_year") is not None:
                t["outcomes"].append(outcome(obs, t, t["baseline_year"], "as_stated"))
                for mb in t.get("monitoring_baselines", []):
                    t["outcomes"].append(outcome(obs, t, mb["year"], "commission_monitoring"))
            elif m:  # e.g. "close to zero by 2050": show the latest official figure for reference only
                latest = _latest(obs, m["geo"], m["indicator"])
                value, status = _value(obs, m["geo"], m["indicator"], latest) if latest else (None, None)
                t["reference"] = {"period": latest, "value": value, "status": status}
            targets.append(t)
        commitments.append({**c, "targets": targets})
    commitments.sort(key=lambda c: (c["level"] != "eu", [-int(x) for x in c["date"].split("-")]))
    measurable = sum(1 for c in commitments for t in c["targets"] if t["outcomes"])
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "reviewed_at": curated["reviewed_at"],
        "review_note": curated["review_note"],
        "statistics_source": "Eurostat tran_sf_roadus (road deaths), as published in observations.json",
        "summary": {
            "commitments": len(commitments),
            "targets": sum(len(c["targets"]) for c in commitments),
            "targets_measured": measurable,
        },
        "commitments": commitments,
    }


def check(curated: dict, observations: dict, today: str) -> list[dict]:
    """Rules on the curated file. Errors block publication."""
    issues = validate_schema("commitments_curated", curated)
    if issues:
        return issues
    obs = index_observations(observations)
    ids = Counter(c["id"] for c in curated["commitments"])
    issues += [issue("error", "duplicate", f"Duplicate commitment id {i!r}") for i, n in ids.items() if n > 1]
    if curated["reviewed_at"] > today:
        issues.append(issue("error", "review_date", f"reviewed_at {curated['reviewed_at']} is in the future"))
    for c in curated["commitments"]:
        tids = Counter(t["id"] for t in c["targets"])
        issues += [issue("error", "duplicate", f"{c['id']}: duplicate target id {i!r}") for i, n in tids.items() if n > 1]
        if not any(s["role"] == "primary" for s in c["sources"]):
            issues.append(issue("error", "source", f"{c['id']}: no primary source"))
        national = c["level"] == "national"
        if national != ("geo" in c) or national != (c["form"] == "national_strategy"):
            issues.append(issue("error", "national",
                                f"{c['id']}: national commitments need a geo and form national_strategy; others neither"))
        for s in c["sources"]:
            tr = s.get("translation")
            if s.get("language", "en") != "en" and not tr:
                issues.append(issue("error", "translation", f"{c['id']}: quote in {s['language']} has no English translation"))
            if tr and tr["kind"] == "official" and not (tr.get("url") and tr.get("location")):
                issues.append(issue("error", "translation", f"{c['id']}: official translation needs its url and location"))
        for t in c["targets"]:
            where = f"{c['id']}/{t['id']}"
            b, y = t.get("baseline_year"), t["target_year"]
            if b is not None and b >= y:
                issues.append(issue("error", "years", f"{where}: baseline year {b} is not before target year {y}"))
            avg = t.get("baseline_average_of")
            if avg and (avg != sorted(set(avg)) or avg[-1] != b):
                issues.append(issue("error", "years", f"{where}: baseline_average_of must be ascending and end with baseline year {b}"))
            measured = t.get("measure") and t.get("reduction") is not None and b is not None
            if not measured and not t.get("not_measured_reason"):
                issues.append(issue("error", "reason", f"{where}: not measured but no not_measured_reason given"))
            if t.get("measure"):
                g, ind = t["measure"]["geo"], t["measure"]["indicator"]
                if national and g != c.get("geo"):
                    issues.append(issue("error", "measure", f"{where}: measured for {g}, but the strategy is for {c.get('geo')}"))
                if not any(k[0] == g and k[1] == ind for k in obs):
                    issues.append(issue("error", "measure", f"{where}: no observations for {g}/{ind}"))
                for year in ((avg or [b]) if measured else []) + [mb["year"] for mb in t.get("monitoring_baselines", [])]:
                    if _value(obs, g, ind, year)[0] is None:
                        issues.append(issue("error", "baseline", f"{where}: no official value for {g} {year}"))
    return issues


def content_hash(doc: dict) -> str:
    stable = {k: v for k, v in doc.items() if k != "generated_at"}
    return hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()


def write_atomic(path: Path, doc: dict) -> None:
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def run(output_dir: Path = DEFAULT_OUTPUT, curated_path: Path = CURATED, observations_path: Path | None = None,
        now: Callable[[], str] = utc_now_iso) -> str:
    target = output_dir / FILENAME
    previous = read_json(target)
    try:
        curated = read_json(curated_path)
        observations = read_json(observations_path or output_dir / "observations.json")
        if curated is None or observations is None:
            raise CommitmentsFailed("curated commitments or observations.json missing or not valid JSON")
        generated_at = now()
        issues = check(curated, observations, generated_at[:10])
        if not issues:
            doc = build(curated, observations, generated_at)
            issues = validate_schema("commitments", doc)
        for i in issues:
            (log.error if i["level"] == "error" else log.warning)("%s: %s", i["code"], i["message"])
        if any(i["level"] == "error" for i in issues):
            raise CommitmentsFailed(f"{sum(i['level'] == 'error' for i in issues)} validation error(s)")
        if previous and content_hash(previous) == content_hash(doc):
            log.info("Commitments unchanged (%d commitments)", len(doc["commitments"]))
            return "unchanged"
        output_dir.mkdir(parents=True, exist_ok=True)
        write_atomic(target, doc)
        s = doc["summary"]
        log.info("Commitments updated: %d commitments, %d targets (%d measured)",
                 s["commitments"], s["targets"], s["targets_measured"])
        return "success"
    except (CommitmentsFailed, KeyError, TypeError, ValueError, OSError) as exc:
        log.error("Commitments failed (%s): %s. Previous file kept.", type(exc).__name__, exc)
        return "failure"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--observations", type=Path, help="Defaults to <output>/observations.json")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    outcome_ = run(args.output, observations_path=args.observations)
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"commitments_outcome={outcome_}\n")
    print(f"commitments_outcome={outcome_}")
    return 1 if outcome_ == "failure" else 0


if __name__ == "__main__":
    sys.exit(main())

