"""Minimal, defensive JSON-stat 2.0 parser for Eurostat dissemination API responses.

Only the subset of JSON-stat used by Eurostat is supported: a single `dataset`
with `id`, `size`, `dimension`, `value` (dict or list) and optional `status`.
Anything unexpected raises `SchemaChangeError` instead of producing guesses.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field
from typing import Any


class SchemaChangeError(ValueError):
    """The source response does not have the structure the pipeline was built for."""


@dataclass
class Dataset:
    dataset_id: str
    label: str
    updated: str | None
    dimension_ids: list[str]
    categories: dict[str, list[str]]          # dimension -> ordered category codes
    category_labels: dict[str, dict[str, str]]
    cells: dict[tuple[str, ...], tuple[float | int | None, str | None]]
    status_labels: dict[str, str] = field(default_factory=dict)
    annotations: list[dict] = field(default_factory=list)

    def get(self, **coords: str) -> tuple[float | int | None, str | None]:
        """Return (value, flag) for a fully specified coordinate; (None, None) if absent."""
        missing = set(self.dimension_ids) - set(coords)
        if missing:
            raise KeyError(f"Missing dimensions: {sorted(missing)}")
        key = tuple(coords[d] for d in self.dimension_ids)
        return self.cells.get(key, (None, None))

    def annotation_date(self, kind: str) -> str | None:
        for ann in self.annotations:
            if ann.get("type") == kind and isinstance(ann.get("date"), str):
                return ann["date"]
        return None


def _require(cond: bool, message: str) -> None:
    if not cond:
        raise SchemaChangeError(message)


def parse(payload: Any, expected_dimensions: set[str] | None = None) -> Dataset:
    _require(isinstance(payload, dict), "Response is not a JSON object")
    if "error" in payload:
        raise SchemaChangeError(f"Source returned an error object: {str(payload['error'])[:300]}")
    _require(payload.get("class") == "dataset", "Response is not a JSON-stat dataset")
    ids = payload.get("id")
    size = payload.get("size")
    dims = payload.get("dimension")
    _require(isinstance(ids, list) and all(isinstance(i, str) for i in ids), "Invalid 'id'")
    _require(isinstance(size, list) and len(size) == len(ids), "Invalid 'size'")
    _require(all(isinstance(s, int) and s >= 0 for s in size), "Invalid 'size' entries")
    _require(isinstance(dims, dict), "Invalid 'dimension'")
    if expected_dimensions is not None:
        _require(
            expected_dimensions.issubset(ids),
            f"Expected dimensions {sorted(expected_dimensions)} not all present in {ids}",
        )

    categories: dict[str, list[str]] = {}
    labels: dict[str, dict[str, str]] = {}
    for dim_id, n in zip(ids, size):
        cat = (dims.get(dim_id) or {}).get("category") or {}
        index = cat.get("index")
        if isinstance(index, dict):
            ordered = sorted(index, key=lambda k: index[k])
            _require(sorted(index.values()) == list(range(len(index))), f"Non-contiguous index for {dim_id}")
        elif isinstance(index, list):
            ordered = list(index)
        else:
            _require(False, f"Missing category index for dimension {dim_id}")
        _require(len(ordered) == n, f"Dimension {dim_id} size mismatch")
        categories[dim_id] = [str(c) for c in ordered]
        raw_labels = cat.get("label") or {}
        labels[dim_id] = {str(k): str(v) for k, v in raw_labels.items()} if isinstance(raw_labels, dict) else {}

    total = math.prod(size)
    values = payload.get("value", {})
    statuses = payload.get("status", {}) or {}
    if isinstance(values, list):
        _require(len(values) == total, "Dense 'value' array has wrong length")
        values = {str(i): v for i, v in enumerate(values) if v is not None}
    if isinstance(statuses, list):
        statuses = {str(i): s for i, s in enumerate(statuses) if s}
    _require(isinstance(values, dict) and isinstance(statuses, dict), "Invalid 'value' or 'status'")

    cells: dict[tuple[str, ...], tuple[float | int | None, str | None]] = {}
    for flat, combo in enumerate(itertools.product(*(categories[d] for d in ids))):
        key = str(flat)
        v = values.get(key)
        s = statuses.get(key)
        if v is None and s is None:
            continue
        if v is not None:
            _require(isinstance(v, (int, float)) and not isinstance(v, bool), f"Non-numeric value at {combo}: {v!r}")
            _require(math.isfinite(v), f"Non-finite value at {combo}")
        if s is not None:
            _require(isinstance(s, str) and len(s) <= 8, f"Invalid status flag at {combo}")
        cells[combo] = (v, s)
    # Indices beyond the cube indicate a structural mismatch.
    for key in itertools.chain(values, statuses):
        _require(key.isdigit() and int(key) < total, f"Out-of-range cell index {key!r}")

    ext = payload.get("extension") or {}
    status_labels = ((ext.get("status") or {}).get("label")) or {}
    return Dataset(
        dataset_id=str(ext.get("id") or payload.get("label") or ""),
        label=str(payload.get("label") or ""),
        updated=payload.get("updated") if isinstance(payload.get("updated"), str) else None,
        dimension_ids=list(ids),
        categories=categories,
        category_labels=labels,
        cells=cells,
        status_labels={str(k): str(v) for k, v in status_labels.items()},
        annotations=[a for a in (ext.get("annotation") or []) if isinstance(a, dict)],
    )
