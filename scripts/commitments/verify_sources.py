"""Check every quote in data/curated/commitments.json against the official document.

Downloads each source document, extracts its text and confirms that the quote occurs
in it word for word (ignoring whitespace, quote-mark style and line-break hyphenation).
Official translations of quotes in other languages are checked the same way against the
issuer's own translated document; translations made for this site are labelled and not checked.
Run this before changing the curated file and record the date in "reviewed_at".

Usage:
    python -m scripts.commitments.verify_sources [--cache DIR]

Needs network access and `pdftotext` (poppler-utils) for PDF documents. Not part of CI:
the documents are fetched from external sites that may rate-limit automated access.
Exit status 0 when every quote was found, 1 otherwise.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from .build import CURATED

UA = "Mozilla/5.0 (compatible; VisionZeroMonitor-verify/1.0; +https://github.com/DaLuSt/Vision-Zero-Monitor)"
CELEX_URL = re.compile(r"uri=CELEX:([0-9A-Z()]+)")
OP_PUBLICATION = re.compile(r"op\.europa\.eu/.+/publication/([0-9a-f-]{36})")
UNDOCS = re.compile(r"undocs\.org/(.+)$")
# Public intermediate certificates that some official sites fail to send (see the file headers).
# They are added to the default trust store to complete the chain; verification stays on.
EXTRA_CERTS = sorted((Path(__file__).parent / "certs").glob("*.pem"))


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    for cert in EXTRA_CERTS:
        ctx.load_verify_locations(cafile=str(cert))
    return ctx


SSL_CONTEXT = _ssl_context()


def _get(url: str, accept: str = "*/*") -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, headers={"Accept": accept, "Accept-Language": "eng", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=90, context=SSL_CONTEXT) as r:  # noqa: S310 (fixed, reviewed URLs)
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get("Content-Type", "")


def _cellar(resource: str) -> bytes:
    """Fetch an EU document from the Publications Office (Cellar) by content negotiation."""
    for accept in ("application/xhtml+xml", "application/pdf"):
        status, body, ctype = _get(resource, accept)
        if status == 200:
            return body
        if status == 300:  # several files (e.g. act and annexes): fetch them all
            items = re.findall(rb'href="(http://publications\.europa\.eu/resource/cellar/[^"]+)"', body)
            return b"\n".join(_get(i.decode())[1] for i in items)
    raise RuntimeError(f"No HTML or PDF manifestation for {resource}")


def fetch(url: str) -> bytes:
    if m := CELEX_URL.search(url):
        return _cellar(f"http://publications.europa.eu/resource/celex/{m.group(1)}")
    if m := OP_PUBLICATION.search(url):
        return _cellar(f"http://publications.europa.eu/resource/cellar/{m.group(1)}")
    if m := UNDOCS.search(url):
        url = f"https://documents.un.org/api/symbol/access?s={m.group(1)}&l=en&t=pdf"
    status, body, _ = _get(url)
    if status != 200:
        raise RuntimeError(f"HTTP {status} for {url}")
    return body


def to_text(body: bytes) -> str:
    if body[:5] == b"%PDF-" or b"%PDF-" in body[:1024]:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body)
            f.flush()
            return subprocess.run(["pdftotext", f.name, "-"], capture_output=True, check=True, text=True).stdout
    text = body.decode("utf-8", "replace")
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    return html.unescape(re.sub(r"(?s)<[^>]+>", " ", text))


def normalise(text: str) -> str:
    text = text.replace("­", "")  # soft hyphens
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)  # words split across lines
    text = re.sub(r"[“”„\"]", '"', text)
    text = re.sub(r"[‘’']", "'", text)
    text = re.sub(r"[–—]", "-", text)
    text = re.sub(r"(\d)[\s\u2009\u202f\u00a0]+%", r"\1%", text)  # "50 %" typeset with a (thin) space
    return re.sub(r"\s+", " ", text).strip().lower()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, help="Keep downloaded documents in this directory")
    args = parser.parse_args(argv)
    import json

    doc = json.loads(CURATED.read_text(encoding="utf-8"))
    texts: dict[str, str] = {}
    failures = 0
    checks = []
    for c in doc["commitments"]:
        for s in c["sources"]:
            checks.append((c["id"], s["reference"], s["location"], s["url"], s["quote"]))
            tr = s.get("translation")
            if tr and tr["kind"] == "official":
                checks.append((c["id"], f"{s['reference']} (official translation)", tr["location"], tr["url"], tr["text"]))
    for cid, reference, location, url, quote in checks:
        try:
            if url not in texts:
                body = fetch(url)
                if args.cache:
                    args.cache.mkdir(parents=True, exist_ok=True)
                    (args.cache / (hashlib.sha256(url.encode()).hexdigest()[:16] + ".bin")).write_bytes(body)
                texts[url] = normalise(to_text(body))
            found = normalise(quote).rstrip(".;") in texts[url]
        except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
            print(f"ERROR {cid} {reference}: {exc}")
            failures += 1
            continue
        print(f"{'OK   ' if found else 'MISSING'} {cid} · {reference} · {location}")
        failures += 0 if found else 1
    print(f"\n{failures} problem(s)." if failures else "\nAll quotes found in their source documents.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
