"""Build public/data/legislation.json from the EU Publications Office.

Usage:
    python -m scripts.legislation.run [--output public/data] [--save-raw DIR] [--from-raw DIR]

Exit status 0 when the register was updated or is unchanged, 1 on failure. On failure the
previously published file is left untouched.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Callable

from ..data_pipeline.export import read_json
from ..data_pipeline.fetch import utc_now_iso
from . import sparql
from .build import STEPS, Runner, build_register, content_hash, fetch_rows
from .validate import check_register

log = logging.getLogger("legislation")
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "public" / "data"
FILENAME = "legislation.json"


class RegisterFailed(RuntimeError):
    pass


def live_runner(save_raw: Path | None) -> Runner:
    def run(step: str, query: str) -> list[dict[str, str]]:
        rows, payload = sparql.query(query)
        if save_raw:
            save_raw.mkdir(parents=True, exist_ok=True)
            (save_raw / f"{step}.json").write_text(json.dumps(payload), encoding="utf-8")
            (save_raw / f"{step}.rq").write_text(query, encoding="utf-8")
        return rows
    return run


def replay_runner(directory: Path) -> Runner:
    """Replay saved SPARQL responses (step names are fixed, never taken from the files)."""
    def run(step: str, query: str) -> list[dict[str, str]]:
        if step not in STEPS:
            raise RegisterFailed(f"Unknown step {step!r}")
        return sparql._flatten(json.loads((directory / f"{step}.json").read_text(encoding="utf-8")))
    return run


def write_atomic(path: Path, doc: dict) -> None:
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def run(output_dir: Path = DEFAULT_OUTPUT, runner: Runner | None = None, retrieved_at: str | None = None,
        now: Callable[[], str] = utc_now_iso) -> str:
    target = output_dir / FILENAME
    previous = read_json(target)
    try:
        generated_at = now()
        rows = fetch_rows(runner or live_runner(None))
        doc = build_register(rows, retrieved_at or generated_at, generated_at)
        issues = check_register(doc, previous)
        for i in issues:
            (log.error if i["level"] == "error" else log.warning)("%s: %s", i["code"], i["message"])
        if any(i["level"] == "error" for i in issues):
            raise RegisterFailed(f"{sum(i['level'] == 'error' for i in issues)} validation error(s)")
        if previous and content_hash(previous) == content_hash(doc):
            log.info("Legislation register unchanged (%d acts)", len(doc["acts"]))
            return "unchanged"
        output_dir.mkdir(parents=True, exist_ok=True)
        write_atomic(target, doc)
        s = doc["summary"]
        log.info("Legislation register updated: %d acts (%d in force), %d open proposals",
                 s["acts_total"], s["acts_in_force"], s["proposals_open"])
        return "success"
    except (sparql.SparqlError, RegisterFailed, KeyError, ValueError, OSError) as exc:
        log.error("Legislation register failed (%s): %s. Previous file kept.", type(exc).__name__, exc)
        return "failure"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--save-raw", type=Path, help="Save raw SPARQL responses and queries here")
    parser.add_argument("--from-raw", type=Path, help="Replay saved SPARQL responses instead of querying")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if args.from_raw:
        manifest = read_json(args.from_raw / "manifest.json") or {}
        outcome = run(args.output, replay_runner(args.from_raw), manifest.get("retrieved_at"))
    else:
        if args.save_raw:
            args.save_raw.mkdir(parents=True, exist_ok=True)
            (args.save_raw / "manifest.json").write_text(json.dumps({"retrieved_at": utc_now_iso()}), encoding="utf-8")
        outcome = run(args.output, live_runner(args.save_raw))
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"legislation_outcome={outcome}\n")
    print(f"legislation_outcome={outcome}")
    return 1 if outcome == "failure" else 0


if __name__ == "__main__":
    sys.exit(main())
