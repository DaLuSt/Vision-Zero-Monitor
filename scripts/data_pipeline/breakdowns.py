"""Road-death breakdowns by road user and by mode of transport.

Breakdowns are published separately from observations.json in a compact,
columnar file (public/data/breakdowns.json): one series of yearly values per
geo × dimension × category, aligned to a shared list of periods.
"""

from __future__ import annotations

from . import config
from .fetch import RawSource
from .jsonstat import Dataset, SchemaChangeError
from .transform import browser_url, map_status, to_utc_iso


def _check_mapping(spec: dict, ds: Dataset) -> None:
    """Every source category except TOTAL must be mapped exactly once."""
    mapped = [c for cat in spec["categories"] for c in cat["source_categories"]]
    if len(mapped) != len(set(mapped)):
        raise SchemaChangeError(f"{spec['id']}: a source category is mapped twice")
    present = set(ds.categories.get(spec["dimension"], [])) - {"TOTAL"}
    unmapped = sorted(present - set(mapped))
    if unmapped:
        raise SchemaChangeError(
            f"{ds.dataset_id}: new {spec['dimension']} categories {unmapped} are not mapped in "
            f"config.BREAKDOWNS; refusing to publish a breakdown that would omit deaths"
        )
    absent = sorted(set(mapped) - present)
    if absent:
        raise SchemaChangeError(f"{ds.dataset_id}: expected {spec['dimension']} categories {absent} are missing")


def build_breakdowns(parsed: dict[str, Dataset], raw: dict[str, RawSource], periods: list[str], generated_at: str) -> dict:
    dimensions, series = [], []
    for spec in config.BREAKDOWNS:
        ds = parsed[spec["source_id"]]
        _check_mapping(spec, ds)
        for k, v in spec["fixed"].items():
            if v not in ds.categories.get(k, []):
                raise SchemaChangeError(f"{ds.dataset_id}: dimension {k} lacks category {v}")
        source_periods = set(ds.categories["time"])
        dimensions.append({
            "id": spec["id"],
            "label": spec["label"],
            "description": spec["description"],
            "unit": "persons",
            "source_id": spec["source_id"],
            "source_url": browser_url(config.SOURCES[spec["source_id"]]["dataset"]),
            "source_published_at": to_utc_iso(ds.annotation_date("UPDATE_DATA") or ds.updated),
            "retrieved_at": raw[spec["source_id"]].retrieved_at,
            "categories": [
                {k: cat[k] for k in ("id", "label", "description", "source_categories")} for cat in spec["categories"]
            ],
        })
        for geo in config.ALL_GEOS:
            has_geo = geo in ds.categories["geo"]
            for cat in spec["categories"]:
                values: list[int | None] = []
                statuses: list[str] = []
                for period in periods:
                    parts, flags = [], []
                    if has_geo and period in source_periods:
                        for src in cat["source_categories"]:
                            v, f = ds.get(**spec["fixed"], **{spec["dimension"]: src}, geo=geo, time=period)
                            parts.append(v)
                            flags.append(f)
                    # A group is only as complete as its parts: one missing part makes it missing.
                    if not parts or any(p is None for p in parts):
                        values.append(None)
                        statuses.append("missing")
                        continue
                    if any(float(p) != int(p) for p in parts):
                        raise SchemaChangeError(f"{ds.dataset_id}: non-integer count for {geo} {cat['id']} {period}")
                    total = int(sum(parts))
                    flag = "".join(sorted(set("".join(f for f in flags if f)))) or None
                    values.append(total)
                    statuses.append(map_status(total, flag))
                series.append({"geo": geo, "dimension": spec["id"], "category": cat["id"],
                               "values": values, "statuses": statuses})

    # EU aggregates for years in which some Member States did not report a breakdown put
    # those countries' deaths under "unknown"; record coverage so users can tell.
    idx = {(s["geo"], s["dimension"], s["category"]): s for s in series}
    for dim, spec in zip(dimensions, config.BREAKDOWNS):
        cats = [c["id"] for c in spec["categories"]]
        dim["eu_members_reporting"] = [
            sum(all(idx[(g, spec["id"], c)]["values"][i] is not None for c in cats) for g in config.MEMBER_STATES)
            for i in range(len(periods))
        ]

    return {
        "schema_version": config.SCHEMA_VERSION,
        "generated_at": generated_at,
        "periods": periods,
        "dimensions": dimensions,
        "series": series,
    }


def series_index(doc: dict) -> dict[tuple[str, str, str], dict]:
    return {(s["geo"], s["dimension"], s["category"]): s for s in doc.get("series", [])}
