"""Schema and statistical validation.

Issues are either `error` (hard failure: nothing is published) or `warning`
(published, but surfaced on the dashboard and in the workflow log).
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import jsonschema

from . import config

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schemas"
VALID_STATUSES = {"final", "provisional", "estimated", "missing", "unknown"}
INDICATOR_UNITS = {i["id"]: i["unit"] for i in config.INDICATORS}
COUNT_INDICATORS = {i["id"] for i in config.INDICATORS if i["value_type"] == "count"}

_format_checker = jsonschema.FormatChecker()


@_format_checker.checks("date-time", raises=ValueError)
def _is_datetime(value: object) -> bool:
    if not isinstance(value, str):
        return True
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timestamp lacks a timezone")
    return True


def issue(level: str, code: str, message: str) -> dict:
    return {"level": level, "code": code, "message": message}


def load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def validate_schema(name: str, document: dict) -> list[dict]:
    validator = jsonschema.Draft202012Validator(load_schema(name), format_checker=_format_checker)
    problems = []
    for err in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path)):
        path = "/".join(str(p) for p in err.absolute_path)
        problems.append(issue("error", "schema", f"{name}.json {path or '<root>'}: {err.message[:300]}"))
        if len(problems) >= 20:
            problems.append(issue("error", "schema", f"{name}.json: further schema errors truncated"))
            break
    return problems


def check_observations(observations: list[dict], source_ids: set[str]) -> list[dict]:
    issues: list[dict] = []
    if not observations:
        return [issue("error", "empty", "No observations were produced")]

    keys = Counter((o["geo"], o["indicator"], o["period"], o["frequency"]) for o in observations)
    dups = [k for k, n in keys.items() if n > 1]
    if dups:
        issues.append(issue("error", "duplicate", f"{len(dups)} duplicate observation keys, e.g. {dups[:3]}"))

    by_key = {(o["geo"], o["indicator"], o["period"]): o for o in observations}
    for o in observations:
        where = f"{o['geo']} {o['indicator']} {o['period']}"
        if o["geo"] not in config.GEO_NAMES:
            issues.append(issue("error", "geo", f"Unknown geo code {o['geo']!r}"))
        if o["status"] not in VALID_STATUSES:
            issues.append(issue("error", "status", f"{where}: invalid status {o['status']!r}"))
        if o["indicator"] in INDICATOR_UNITS and o["unit"] != INDICATOR_UNITS[o["indicator"]]:
            issues.append(issue("error", "unit", f"{where}: unit {o['unit']!r} != {INDICATOR_UNITS[o['indicator']]!r}"))
        if o["source_id"] not in source_ids:
            issues.append(issue("error", "source", f"{where}: unknown source {o['source_id']!r}"))
        v = o["value"]
        if (v is None) != (o["status"] == "missing"):
            issues.append(issue("error", "missing", f"{where}: value/status mismatch (value={v!r}, status={o['status']})"))
        if v is not None:
            if v < 0:
                issues.append(issue("error", "negative", f"{where}: negative value {v}"))
            if o["indicator"] in COUNT_INDICATORS and (not isinstance(v, int) or isinstance(v, bool)):
                issues.append(issue("error", "integer", f"{where}: count is not an integer ({v!r})"))

    # Rates must equal deaths / population * 1e6 (the denominator check).
    for (geo, ind, period), o in by_key.items():
        if ind != "road_fatalities_per_million" or o["value"] is None:
            continue
        d = by_key.get((geo, "road_fatalities", period), {}).get("value")
        p = by_key.get((geo, "population_average", period), {}).get("value")
        if d is None or not p:
            issues.append(issue("error", "rate_inputs", f"{geo} {period}: rate present without inputs"))
        elif abs(d / p * 1e6 - o["value"]) > 0.051:
            issues.append(issue("error", "rate_denominator", f"{geo} {period}: rate {o['value']} != {d}/{p}*1e6"))

    # EU aggregate must be the official aggregate, never the sum of members plus itself.
    periods = sorted({o["period"] for o in observations if o["indicator"] == "road_fatalities"})
    for period in periods:
        members = [by_key.get((g, "road_fatalities", period), {}).get("value") for g in config.MEMBER_STATES]
        eu = by_key.get((config.EU_AGGREGATE, "road_fatalities", period), {}).get("value")
        if eu is not None and all(m is not None for m in members):
            total = sum(members)
            if total != eu:
                issues.append(issue("warning", "eu_aggregate",
                                    f"{period}: EU27 aggregate {eu} differs from sum of Member States {total}"))
            if eu >= 2 * total * 0.99 and total > 0:
                issues.append(issue("error", "double_count", f"{period}: EU aggregate appears to double count"))

    # Coverage of the latest period.
    latest = max((o["period"] for o in observations
                  if o["indicator"] == "road_fatalities" and o["geo"] == config.EU_AGGREGATE and o["value"] is not None),
                 default=None)
    if latest is None:
        issues.append(issue("error", "no_eu", "No EU27 road fatality observation available"))
    else:
        missing = [g for g in config.MEMBER_STATES if by_key.get((g, "road_fatalities", latest), {}).get("value") is None]
        if missing:
            issues.append(issue("warning", "coverage", f"{latest}: no road fatality data for {', '.join(missing)}"))

    for t in config.TARGETS:
        base = by_key.get((t["geo"], t["indicator"], t["baseline_period"]), {})
        if base.get("value") is None:
            issues.append(issue("error", "baseline", f"Baseline {t['geo']} {t['baseline_period']} is unavailable"))
        elif base.get("source_id") != "eurostat:tran_sf_roadus":
            issues.append(issue("error", "baseline_source", "Baseline must come from the primary source"))
    return issues


def cross_check(observations: list[dict], cross: dict) -> list[dict]:
    """Compare against independent Eurostat publications. Discrepancies are warnings."""
    issues: list[dict] = []
    by_key = {(o["geo"], o["indicator"], o["period"]): o["value"] for o in observations}
    count_diff, rate_diff, roadus_rate_diff = defaultdict(list), defaultdict(list), defaultdict(list)
    for key, sdg_count in cross.get("sdg_counts", {}).items():
        geo, period = key.split("|")
        ours = by_key.get((geo, "road_fatalities", period))
        if ours is not None and ours != sdg_count:
            count_diff[geo].append(f"{period} ({ours} vs {sdg_count:g})")
    for key, sdg_rate in cross.get("sdg_rates_per_100k", {}).items():
        geo, period = key.split("|")
        ours = by_key.get((geo, "road_fatalities_per_million", period))
        if ours is not None and abs(ours / 10 - sdg_rate) > config.CROSS_CHECK_RATE_TOLERANCE:
            rate_diff[geo].append(f"{period} ({ours} vs {sdg_rate * 10:g})")
    for key, published in cross.get("roadus_rates_per_million", {}).items():
        geo, period = key.split("|")
        ours = by_key.get((geo, "road_fatalities_per_million", period))
        if ours is not None and published and abs(ours - published) / published > config.SOURCE_RATE_WARN_FRACTION:
            roadus_rate_diff[geo].append(f"{period} ({ours} vs {published:g})")
    for geo, items in sorted(count_diff.items()):
        issues.append(issue("warning", "cross_check_counts",
                            f"{geo}: tran_sf_roadus counts differ from sdg_11_40 in {len(items)} year(s): {', '.join(items[:5])}"))
    for geo, items in sorted(rate_diff.items()):
        issues.append(issue("warning", "cross_check_rates",
                            f"{geo}: derived rate per million differs from sdg_11_40 (x10) in {len(items)} year(s): {', '.join(items[:5])}"))
    for geo, items in sorted(roadus_rate_diff.items()):
        issues.append(issue("warning", "source_rate_inconsistent",
                            f"{geo}: tran_sf_roadus published P_MHAB disagrees with its own counts / average population "
                            f"in {len(items)} year(s), e.g. {', '.join(items[:3])}. Derived rates are used."))
    return issues


def compare_with_previous(new: list[dict], previous: list[dict] | None, previous_generated_at: str | None) -> tuple[dict, list[dict]]:
    """Detect revisions and coverage drops relative to the last valid dataset."""
    summary = {"compared_with": previous_generated_at, "changed": 0, "added": 0, "removed": 0, "examples": []}
    if not previous:
        return summary, []
    issues: list[dict] = []
    key = lambda o: (o["geo"], o["indicator"], o["period"], o["frequency"])  # noqa: E731
    old = {key(o): o["value"] for o in previous}
    cur = {key(o): o["value"] for o in new}
    big_revisions = []
    for k, v in cur.items():
        if k not in old or old[k] is None:
            if v is not None:
                summary["added"] += 1
            continue
        if v is None:
            summary["removed"] += 1
            continue
        if v != old[k]:
            summary["changed"] += 1
            frac = abs(v - old[k]) / old[k] if old[k] else 1.0
            example = {"geo": k[0], "indicator": k[1], "period": k[2], "old": old[k], "new": v}
            if len(summary["examples"]) < 50:
                summary["examples"].append(example)
            if frac > config.REVISION_WARN_FRACTION and k[1] == "road_fatalities":
                big_revisions.append(f"{k[0]} {k[2]}: {old[k]} → {v}")
    summary["removed"] += sum(1 for k, v in old.items() if k not in cur and v is not None)
    if big_revisions:
        issues.append(issue("warning", "large_revision",
                            f"{len(big_revisions)} road fatality value(s) revised by more than "
                            f"{config.REVISION_WARN_FRACTION:.0%}; review: {'; '.join(big_revisions[:10])}"))
    old_nonnull = sum(1 for v in old.values() if v is not None)
    new_nonnull = sum(1 for v in cur.values() if v is not None)
    if old_nonnull and (old_nonnull - new_nonnull) / old_nonnull > config.COVERAGE_DROP_FAIL_FRACTION:
        issues.append(issue("error", "coverage_drop",
                            f"Non-null observations dropped from {old_nonnull} to {new_nonnull}; refusing to publish"))
    elif summary["removed"]:
        issues.append(issue("warning", "removed", f"{summary['removed']} previously available value(s) are no longer published"))

    def latest(obs):
        return max((o["period"] for o in obs if o["indicator"] == "road_fatalities"
                    and o["geo"] == config.EU_AGGREGATE and o["value"] is not None), default=None)
    old_latest, new_latest = latest(previous), latest(new)
    if old_latest and (new_latest is None or new_latest < old_latest):
        issues.append(issue("error", "latest_period_regressed",
                            f"Latest EU reference period went from {old_latest} to {new_latest}; refusing to publish"))
    return summary, issues
