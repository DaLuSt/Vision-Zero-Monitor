import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.data_pipeline import config  # noqa: E402
from scripts.data_pipeline.run import load_raw  # noqa: E402

FIXTURE_DIR = ROOT / "tests" / "fixtures" / "eurostat_2026-10-14"


@pytest.fixture
def raw_sources():
    """Real Eurostat responses captured 2026-10-14 (deep-copied per test)."""
    return copy.deepcopy(load_raw(FIXTURE_DIR))


@pytest.fixture
def fixture_dir():
    return FIXTURE_DIR


def make_jsonstat(dims: dict[str, list[str]], values: dict[tuple, float], statuses: dict[tuple, str] | None = None,
                  updated="2026-01-01T00:00:00+0100") -> dict:
    """Build a SYNTHETIC JSON-stat 2.0 document (test-only)."""
    ids = list(dims)
    size = [len(dims[d]) for d in ids]
    strides = []
    for i in range(len(ids)):
        s = 1
        for n in size[i + 1:]:
            s *= n
        strides.append(s)

    def flat(coords):
        return str(sum(dims[d].index(c) * strides[i] for i, (d, c) in enumerate(zip(ids, coords))))

    return {
        "version": "2.0", "class": "dataset", "label": "SYNTHETIC TEST DATA", "updated": updated,
        "id": ids, "size": size,
        "dimension": {d: {"label": d, "category": {"index": {c: i for i, c in enumerate(cats)},
                                                      "label": {c: c for c in cats}}} for d, cats in dims.items()},
        "value": {flat(k): v for k, v in values.items()},
        "status": {flat(k): v for k, v in (statuses or {}).items()},
        "extension": {"id": "SYNTH", "annotation": [{"type": "UPDATE_DATA", "date": updated}],
                      "status": {"label": {"p": "provisional", "e": "estimated"}}},
    }


@pytest.fixture
def jsonstat_factory():
    return make_jsonstat


def write_json(path: Path, doc) -> None:
    path.write_text(json.dumps(doc), encoding="utf-8")


EU_GEOS = config.ALL_GEOS
