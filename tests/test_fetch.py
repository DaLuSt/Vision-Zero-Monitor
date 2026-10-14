import json

import pytest
import requests

from scripts.data_pipeline import fetch


class FakeResponse:
    def __init__(self, status=200, body=b"{}"):
        self.status_code = status
        self._body = body

    def iter_content(self, n):
        for i in range(0, len(self._body), n):
            yield self._body[i:i + n]

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def get(self, url, **kw):
        self.calls += 1
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def test_build_url_repeats_multi_valued_params():
    url = fetch.build_url("tran_sf_roadus", {"unit": ["NR", "P_MHAB"], "sex": "T"}, ["EU27_2020", "NL"])
    assert url.startswith("https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tran_sf_roadus?")
    assert "unit=NR&unit=P_MHAB" in url and "geo=EU27_2020&geo=NL" in url and "format=JSON" in url


def test_fetch_json_success():
    s = FakeSession([FakeResponse(body=json.dumps({"class": "dataset"}).encode())])
    assert fetch.fetch_json("https://x", session=s) == {"class": "dataset"}


def test_fetch_retries_transient_errors(monkeypatch):
    monkeypatch.setattr(fetch.time, "sleep", lambda s: None)
    s = FakeSession([requests.ConnectionError("down"), FakeResponse(503), FakeResponse(body=b'{"ok": 1}')])
    assert fetch.fetch_json("https://x", session=s, retries=3) == {"ok": 1}
    assert s.calls == 3


def test_fetch_gives_up_after_retries(monkeypatch):
    monkeypatch.setattr(fetch.time, "sleep", lambda s: None)
    s = FakeSession([FakeResponse(500)] * 3)
    with pytest.raises(fetch.FetchError, match="after 3 attempts"):
        fetch.fetch_json("https://x", session=s, retries=3)


def test_fetch_does_not_retry_client_errors():
    s = FakeSession([FakeResponse(404)])
    with pytest.raises(fetch.FetchError, match="HTTP 404"):
        fetch.fetch_json("https://x", session=s, retries=3)
    assert s.calls == 1


def test_fetch_rejects_invalid_json():
    s = FakeSession([FakeResponse(body=b"<html>maintenance</html>")])
    with pytest.raises(fetch.FetchError, match="not valid JSON"):
        fetch.fetch_json("https://x", session=s)


def test_fetch_rejects_oversized(monkeypatch):
    monkeypatch.setattr(fetch.config, "HTTP_MAX_BYTES", 10)
    s = FakeSession([FakeResponse(body=b'{"a": "' + b"x" * 100 + b'"}')])
    with pytest.raises(fetch.FetchError, match="exceeds"):
        fetch.fetch_json("https://x", session=s)
