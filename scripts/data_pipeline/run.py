"""Pipeline entry point: fetch → transform → validate → export.

Usage:
    python -m scripts.data_pipeline.run [--output public/data] [--save-raw DIR] [--from-raw DIR]

Exit status is 0 when data were updated or unchanged, 1 when the run failed.
On failure only `pipeline_status.json` is written; the previous valid dataset is kept.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Callable

from . import config
from .export import PUBLIC_FILES, read_json, write_atomic
from .fetch import FetchError, RawSource, fetch_all, utc_now_iso
from .jsonstat import SchemaChangeError
from .transform import build_latest, build_targets, content_hash, coverage, transform
from .validate import check_observations, compare_with_previous, cross_check, validate_schema

log = logging.getLogger("data_pipeline")

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "public" / "data"

FREQUENCY_NOTICE = (
    "Official fatality statistics are published periodically. This dashboard checks for updated data weekly; "
    "the underlying figures are not necessarily weekly."
)

STATUS_VOCABULARY = {
    "final": "Published by the source as final.",
    "provisional": "Flagged by the source as provisional (p); may be revised.",
    "estimated": "Flagged by the source as estimated (e).",
    "missing": "No value published by the source for this period. Shown as a gap, never as zero.",
    "unknown": "Published without a status flag; finality cannot be established from the source.",
}


class ValidationFailed(RuntimeError):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__("; ".join(e["message"] for e in errors[:5]))


def save_raw(raw: dict[str, RawSource], directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for sid, r in raw.items():
        dataset = config.SOURCES[sid]["dataset"]
        (directory / f"{dataset}.json").write_text(json.dumps(r.payload), encoding="utf-8")
        manifest[sid] = {"url": r.url, "retrieved_at": r.retrieved_at, "file": f"{dataset}.json"}
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")


def load_raw(directory: Path) -> dict[str, RawSource]:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    out = {}
    for sid in config.SOURCES:
        entry = manifest[sid]
        # File names come from configuration, not from the manifest content.
        path = directory / f"{config.SOURCES[sid]['dataset']}.json"
        out[sid] = RawSource(source_id=sid, url=entry["url"], retrieved_at=entry["retrieved_at"],
                             payload=json.loads(path.read_text(encoding="utf-8")))
    return out


def _status_doc(attempt_at: str, outcome: str, last_success_at: str | None, message: str, run_url: str | None) -> dict:
    return {
        "schema_version": config.SCHEMA_VERSION,
        "last_attempt_at": attempt_at,
        "last_outcome": outcome,
        "last_success_at": last_success_at,
        "message": message[:2000],
        "run_url": run_url,
    }


def build_documents(raw: dict[str, RawSource], generated_at: str, previous_obs: list[dict] | None,
                    previous_generated_at: str | None) -> tuple[dict[str, dict], list[dict], list[dict]]:
    result = transform(raw)
    observations = result.observations
    targets = build_targets(observations)
    source_ids = {s["id"] for s in result.sources}

    issues = check_observations(observations, source_ids)
    issues += cross_check(observations, result.cross_check)
    revisions, revision_issues = compare_with_previous(observations, previous_obs, previous_generated_at)
    issues += revision_issues

    latest = build_latest(observations, targets, generated_at)
    docs = {
        "observations": {"schema_version": config.SCHEMA_VERSION, "generated_at": generated_at, "observations": observations},
        "countries": {
            "schema_version": config.SCHEMA_VERSION,
            "countries": [{"geo": g, "iso2": iso, "name": name, "eu_member": True}
                          for g, (iso, name) in config.MEMBER_STATES.items()],
        },
        "indicators": {"schema_version": config.SCHEMA_VERSION, "indicators": config.INDICATORS},
        "latest": latest,
    }
    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]
    docs["metadata"] = {
        "schema_version": config.SCHEMA_VERSION,
        "generated_at": generated_at,
        "content_hash": content_hash(observations, result.sources),
        "frequency_notice": FREQUENCY_NOTICE,
        "status_vocabulary": STATUS_VOCABULARY,
        "sources": result.sources,
        "targets": targets,
        "coverage": coverage(observations, latest["latest_period"]),
        "validation": {"passed": not errors, "errors": errors, "warnings": warnings},
        "revisions": revisions,
    }
    for name in PUBLIC_FILES:
        errors += validate_schema(name, docs[name])
    return docs, errors, warnings


def run(output_dir: Path = DEFAULT_OUTPUT, from_raw: Path | None = None, save_raw_dir: Path | None = None,
        run_url: str | None = None, fetcher: Callable[[], dict[str, RawSource]] = fetch_all,
        now: Callable[[], str] = utc_now_iso) -> str:
    attempt_at = now()
    prev_status = read_json(output_dir / "pipeline_status.json") or {}
    prev_meta = read_json(output_dir / "metadata.json")
    prev_obs_doc = read_json(output_dir / "observations.json")
    last_success_at = prev_status.get("last_success_at")

    try:
        raw = load_raw(from_raw) if from_raw else fetcher()
        if save_raw_dir:
            save_raw(raw, save_raw_dir)
        docs, errors, warnings = build_documents(
            raw, attempt_at,
            prev_obs_doc.get("observations") if prev_obs_doc else None,
            prev_meta.get("generated_at") if prev_meta else None,
        )
        if errors:
            raise ValidationFailed(errors)

        all_present = all((output_dir / f"{n}.json").exists() for n in PUBLIC_FILES)
        if prev_meta and all_present and prev_meta.get("content_hash") == docs["metadata"]["content_hash"]:
            log.info("Source content unchanged (%s); keeping existing files", docs["metadata"]["content_hash"])
            if prev_status.get("last_outcome") == "failure":
                # Record recovery so the dashboard stops showing the failure.
                write_atomic(output_dir, {"pipeline_status": _status_doc(
                    attempt_at, "unchanged", attempt_at, "Sources retrieved and validated; data unchanged.", run_url)})
            return "unchanged"

        for w in warnings:
            log.warning("%s: %s", w["code"], w["message"])
        rev = docs["metadata"]["revisions"]
        message = (f"Data updated. Latest EU reference period {docs['latest']['latest_period']}; "
                   f"{rev['changed']} changed, {rev['added']} added, {rev['removed']} removed value(s); "
                   f"{len(warnings)} validation warning(s).")
        docs["pipeline_status"] = _status_doc(attempt_at, "success", attempt_at, message, run_url)
        write_atomic(output_dir, docs)
        log.info(message)
        return "success"
    except (FetchError, SchemaChangeError, ValidationFailed, KeyError, ValueError, OSError) as exc:
        kind = type(exc).__name__
        log.error("Pipeline failed (%s): %s", kind, exc)
        if isinstance(exc, ValidationFailed):
            for e in exc.errors[:20]:
                log.error("  %s: %s", e["code"], e["message"])
        write_atomic(output_dir, {"pipeline_status": _status_doc(
            attempt_at, "failure", last_success_at,
            f"{kind}: {exc}. The previously published dataset has been kept.", run_url)})
        return "failure"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output directory (default: public/data)")
    parser.add_argument("--from-raw", type=Path, help="Use previously saved raw responses instead of the network")
    parser.add_argument("--save-raw", type=Path, help="Save raw API responses to this directory")
    parser.add_argument("--run-url", default=os.environ.get("PIPELINE_RUN_URL"), help="Link to the CI run")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    outcome = run(args.output, from_raw=args.from_raw, save_raw_dir=args.save_raw, run_url=args.run_url)
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"outcome={outcome}\n")
    print(f"outcome={outcome}")
    return 1 if outcome == "failure" else 0


if __name__ == "__main__":
    sys.exit(main())
