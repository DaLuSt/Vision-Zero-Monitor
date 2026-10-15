"""Minimal SPARQL client for the EU Publications Office endpoint (JSON results)."""

from __future__ import annotations

import json
import logging
import time

import requests

from . import config

log = logging.getLogger(__name__)


class SparqlError(RuntimeError):
    """The endpoint could not be queried or returned an unexpected response."""


def _flatten(payload: object) -> list[dict[str, str]]:
    """SPARQL JSON results → list of {variable: value} with unbound variables omitted."""
    if not isinstance(payload, dict) or "results" not in payload or "bindings" not in payload.get("results", {}):
        raise SparqlError("Response is not a SPARQL JSON result set")
    rows = []
    for b in payload["results"]["bindings"]:
        if not isinstance(b, dict):
            raise SparqlError("Malformed binding in SPARQL response")
        rows.append({k: str(v.get("value", "")) for k, v in b.items() if isinstance(v, dict)})
    return rows


def query(sparql: str, session: requests.Session | None = None, retries: int = config.HTTP_RETRIES,
          backoff_seconds: float = 5.0) -> tuple[list[dict[str, str]], dict]:
    """Run a SELECT query. Returns (rows, raw_payload). Retries network errors, 429 and 5xx."""
    sess = session or requests.Session()
    last = None
    for attempt in range(1, retries + 1):
        try:
            resp = sess.post(
                config.SPARQL_ENDPOINT,
                data={"query": sparql},
                headers={"Accept": "application/sparql-results+json", "User-Agent": config.USER_AGENT},
                timeout=config.HTTP_TIMEOUT_SECONDS,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                raise SparqlError(f"HTTP {resp.status_code}")
            if resp.status_code != 200:
                raise SparqlError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            if len(resp.content) > config.HTTP_MAX_BYTES:
                raise SparqlError("Response too large")
            payload = json.loads(resp.content.decode("utf-8"))
            return _flatten(payload), payload
        except (requests.RequestException, ValueError, SparqlError) as exc:
            last = exc
            if isinstance(exc, SparqlError) and str(exc).startswith("HTTP 4") and "429" not in str(exc):
                break
            if attempt < retries:
                wait = backoff_seconds * 2 ** (attempt - 1)
                log.warning("SPARQL attempt %d failed (%s); retrying in %.0fs", attempt, exc, wait)
                time.sleep(wait)
    raise SparqlError(f"SPARQL query failed: {last}")
