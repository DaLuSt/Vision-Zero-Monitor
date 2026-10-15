"""Validation of the legislation register. Errors block publication; warnings are reported."""

from __future__ import annotations

from collections import Counter

from . import config
from ..data_pipeline.validate import issue, validate_schema


def check_register(doc: dict, previous: dict | None = None) -> list[dict]:
    issues = validate_schema("legislation", doc)
    acts, props = doc.get("acts", []), doc.get("proposals", [])

    dup = [c for c, n in Counter(a["celex"] for a in acts).items() if n > 1]
    if dup:
        issues.append(issue("error", "duplicate", f"Duplicate acts: {dup[:5]}"))
    dup = [c for c, n in Counter(p["celex"] for p in props).items() if n > 1]
    if dup:
        issues.append(issue("error", "duplicate", f"Duplicate proposals: {dup[:5]}"))

    if len(acts) < config.MIN_ACTS:
        issues.append(issue("error", "too_few", f"Only {len(acts)} acts found (minimum {config.MIN_ACTS}); query or source changed"))

    present = {a["celex"] for a in acts}
    missing = [c["celex"] for c in config.CURATED_ADDITIONS if c["celex"] not in present]
    if missing:
        issues.append(issue("error", "curated_missing", f"Curated acts not found at the source: {missing}"))
    redundant = [a["celex"] for a in acts if a["inclusion"]["basis"] == "eurovoc"
                 and a["celex"] in {c["celex"] for c in config.CURATED_ADDITIONS}]
    if redundant:
        issues.append(issue("warning", "curated_redundant",
                            f"Curated acts are now indexed as 'road safety' and can be removed from the list: {redundant}"))

    no_status = [a["celex"] for a in acts if a["in_force"] is None]
    if no_status:
        issues.append(issue("warning", "in_force_unknown",
                            f"{len(no_status)} act(s) without an in-force flag at the source, e.g. {no_status[:5]}"))
    # Inconsistent dates at the source are published as-is but reported for review.
    odd = [a["celex"] for a in acts
           if a["date_adopted"] and a["end_of_validity"] and a["end_of_validity"] < a["date_adopted"]]
    if odd:
        issues.append(issue("warning", "source_dates", f"End of validity before adoption at the source: {odd[:5]}"))
    for p in props:
        if p["status"] == "adopted" and not p["adopted_by"]:
            issues.append(issue("error", "status", f"{p['celex']}: adopted without an adopting act"))
        if p["date_sent"] and p["end_of_validity"] and p["end_of_validity"] < p["date_sent"]:
            issues.append(issue("error", "dates", f"{p['celex']}: closed before it was sent"))

    if previous and previous.get("acts"):
        old = len(previous["acts"])
        if old and (old - len(acts)) / old > config.COUNT_DROP_FAIL_FRACTION:
            issues.append(issue("error", "count_drop", f"Acts dropped from {old} to {len(acts)}; refusing to publish"))
        gone = sorted({a["celex"] for a in previous["acts"]} - present)
        if gone:
            issues.append(issue("warning", "removed", f"{len(gone)} act(s) no longer in the register: {gone[:10]}"))
    return issues
