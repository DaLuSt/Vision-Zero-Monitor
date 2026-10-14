"""Download raw datasets from the Eurostat dissemination API.

The fetcher only performs HTTP GET requests against a fixed, configured host and
returns parsed JSON. Downloaded content is treated as data; nothing is executed.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests

from . import config

log = logging.getLogger(__name__)


class FetchError(RuntimeError):
    """A source could not be retrieved."""


@dataclass
class RawSource:
    source_id: str
    url: str
    payload: dict
    retrieved_at: str


def build_url(dataset: str, params: dict, geos: list[str]) -> str:
    query: list[tuple[str, str]] = [("format", "JSON"), ("lang", "EN")]
    for key, value in params.items():
        for v in value if isinstance(value, list) else [value]:
            query.append((key, str(v)))
    for geo in geos:
        query.append(("geo", geo))
    return f"{config.EUROSTAT_API_BASE}/{dataset}?{urlencode(query)}"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class _Retryable(FetchError):
    """Transient failure (network error, HTTP 429 or 5xx)."""


def _get_once(sess: requests.Session, url: str) -> dict:
    try:
        resp = sess.get(
            url,
            timeout=config.HTTP_TIMEOUT_SECONDS,
            headers={"User-Agent": config.USER_AGENT, "Accept": "application/json"},
            stream=True,
        )
    except requests.RequestException as exc:
        raise _Retryable(f"network error: {exc}") from exc
    with resp:
        if resp.status_code == 429 or resp.status_code >= 500:
            raise _Retryable(f"HTTP {resp.status_code}")
        if resp.status_code != 200:
            raise FetchError(f"HTTP {resp.status_code}")
        chunks, size = [], 0
        for chunk in resp.iter_content(64 * 1024):
            size += len(chunk)
            if size > config.HTTP_MAX_BYTES:
                raise FetchError(f"response exceeds {config.HTTP_MAX_BYTES} bytes")
            chunks.append(chunk)
    try:
        payload = json.loads(b"".join(chunks).decode("utf-8"))
    except ValueError as exc:
        raise FetchError(f"response is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise FetchError("response is not a JSON object")
    return payload


def fetch_json(url: str, session: requests.Session | None = None, retries: int = config.HTTP_RETRIES,
               backoff_seconds: float = 2.0) -> dict:
    sess = session or requests.Session()
    for attempt in range(1, retries + 1):
        try:
            return _get_once(sess, url)
        except _Retryable as exc:
            if attempt == retries:
                raise FetchError(f"Could not retrieve {url} after {retries} attempts: {exc}") from exc
            wait = backoff_seconds * 2 ** (attempt - 1)
            log.warning("Fetch attempt %d failed (%s); retrying in %.0fs", attempt, exc, wait)
            time.sleep(wait)
        except FetchError as exc:
            raise FetchError(f"Could not retrieve {url}: {exc}") from exc
    raise AssertionError("unreachable")


def fetch_all(session: requests.Session | None = None) -> dict[str, RawSource]:
    """Fetch every configured source. Raises FetchError if any source fails."""
    out: dict[str, RawSource] = {}
    for source_id, spec in config.SOURCES.items():
        url = build_url(spec["dataset"], spec["params"], config.ALL_GEOS)
        log.info("Fetching %s", url)
        payload = fetch_json(url, session=session)
        out[source_id] = RawSource(source_id=source_id, url=url, payload=payload, retrieved_at=utc_now_iso())
    return out
