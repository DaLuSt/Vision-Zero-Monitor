"""Bump the release version in CITATION.cff, package.json and package-lock.json.

Used by .github/workflows/release.yml before it tags a release. Standard library only.
Prints `version=X.Y.Z` (for $GITHUB_OUTPUT) and refuses to run if the files disagree.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


class ReleaseError(Exception):
    pass


def next_version(current: str, bump: str) -> str:
    m = SEMVER.match(current)
    if not m:
        raise ReleaseError(f"current version {current!r} is not X.Y.Z")
    major, minor, patch = map(int, m.groups())
    if bump == "major":
        return f"{major + 1}.0.0"
    if bump == "minor":
        return f"{major}.{minor + 1}.0"
    if bump == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise ReleaseError(f"unknown bump {bump!r}; use major, minor or patch")


def _cff_field(text: str, field: str) -> str | None:
    m = re.search(rf'^{field}:\s*"?([^"\n]+)"?\s*$', text, flags=re.M)
    return m.group(1).strip() if m else None


def current_version(root: Path = ROOT) -> str:
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
    cff = _cff_field((root / "CITATION.cff").read_text(encoding="utf-8"), "version")
    if pkg != cff:
        raise ReleaseError(f"package.json ({pkg}) and CITATION.cff ({cff}) disagree; fix them first")
    return pkg


def is_newer(new: str, old: str) -> bool:
    return tuple(map(int, SEMVER.match(new).groups())) > tuple(map(int, SEMVER.match(old).groups()))


def apply(version: str, released: str, root: Path = ROOT) -> None:
    cff_path = root / "CITATION.cff"
    cff = cff_path.read_text(encoding="utf-8")
    cff = re.sub(r"^version:.*$", f"version: {version}", cff, count=1, flags=re.M)
    cff = re.sub(r"^date-released:.*$", f'date-released: "{released}"', cff, count=1, flags=re.M)
    cff_path.write_text(cff, encoding="utf-8")

    for name in ("package.json", "package-lock.json"):
        path = root / name
        if not path.exists():
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        doc["version"] = version
        if name == "package-lock.json" and "" in doc.get("packages", {}):
            doc["packages"][""]["version"] = version
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None, root: Path = ROOT) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bump", choices=["major", "minor", "patch"], default="minor")
    ap.add_argument("--version", default="", help="exact version X.Y.Z; overrides --bump")
    ap.add_argument("--date", default=date.today().isoformat(), help="release date YYYY-MM-DD")
    args = ap.parse_args(argv)
    try:
        current = current_version(root)
        version = args.version.strip() or next_version(current, args.bump)
        if not SEMVER.match(version):
            raise ReleaseError(f"version {version!r} is not X.Y.Z")
        if not is_newer(version, current):
            raise ReleaseError(f"version {version} is not newer than the current {current}")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", args.date):
            raise ReleaseError(f"date {args.date!r} is not YYYY-MM-DD")
        apply(version, args.date, root)
    except ReleaseError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    print(f"version={version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
