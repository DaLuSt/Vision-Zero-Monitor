"""Write the public JSON files atomically.

Files are first written to a temporary directory next to the destination and
only moved into place (os.replace) once every file has been written, so a
crash can never leave a half-written dataset behind.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path

PUBLIC_FILES = ("observations", "countries", "indicators", "metadata", "latest")


def dumps(document: dict) -> str:
    """Pretty-print, except that long record lists are written one record per line (compact, diff-friendly)."""
    if "observations" in document and isinstance(document["observations"], list):
        head = {k: v for k, v in document.items() if k != "observations"}
        lines = [json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in document["observations"]]
        body = json.dumps(head, ensure_ascii=False, indent=1)[:-2]
        return body + ',\n "observations": [\n' + ",\n".join(lines) + "\n ]\n}\n"
    return json.dumps(document, ensure_ascii=False, indent=1) + "\n"


def read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_atomic(output_dir: Path, documents: dict[str, dict]) -> list[Path]:
    """Write {name: document} as <output_dir>/<name>.json atomically. Names are fixed, never source-derived."""
    allowed = set(PUBLIC_FILES) | {"pipeline_status"}
    unknown = set(documents) - allowed
    if unknown:
        raise ValueError(f"Refusing to write unexpected files: {sorted(unknown)}")
    output_dir.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=".tmp-", dir=output_dir))
    written: list[Path] = []
    try:
        for name, doc in documents.items():
            (tmp / f"{name}.json").write_text(dumps(doc), encoding="utf-8")
        for name in documents:
            dest = output_dir / f"{name}.json"
            os.replace(tmp / f"{name}.json", dest)
            written.append(dest)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return written
