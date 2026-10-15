"""Normalize parsed Eurostat datasets into the observatory's observation model."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import config
from .fetch import RawSource
from .jsonstat import Dataset, SchemaChangeError, parse

STATUS_ORDER = {"missing": 0, "estimated": 1, "provisional": 2, "unknown": 3, "final": 4}

EXPECTED_DIMENSIONS = {
    "eurostat:tran_sf_roadus": {"freq", "sex", "age", "unit", "pers_cat", "geo", "time"},
    "eurostat:tran_sf_roadve": {"freq", "unit", "vehicle", "geo", "time"},
    "eurostat:demo_gind": {"freq", "indic_de", "geo", "time"},
    "eurostat:sdg_11_40": {"freq", "tra_infr", "unit", "geo", "time"},
}

METHODOLOGY_URL = "https://github.com/DaLuSt/Vision-Zero-Monitor/blob/main/docs/METHODOLOGY.md#rates-per-million-inhabitants"


@dataclass
class TransformResult:
    observations: list[dict]
    sources: list[dict]
    cross_check: dict = field(default_factory=dict)
    parsed: dict = field(default_factory=dict)   # source_id -> jsonstat.Dataset
    periods: list = field(default_factory=list)  # reference periods of the primary source


def to_utc_iso(value: str | None) -> str | None:
    """Convert Eurostat timestamps such as '2026-08-25T23:00:00+0200' to UTC ISO 8601."""
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            return None
        return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def map_status(value: float | int | None, flag: str | None) -> str:
    """Map a Eurostat value + flag to the controlled status vocabulary.

    Eurostat does not publish an explicit 'final' flag, so an unflagged value
    is 'unknown' rather than silently 'final'.
    """
    if value is None:
        return "missing"
    if not flag:
        return "unknown"
    f = flag.lower()
    if "e" in f:
        return "estimated"
    if "p" in f:
        return "provisional"
    return "unknown"


def most_cautious(*statuses: str) -> str:
    return min(statuses, key=lambda s: STATUS_ORDER[s])


def browser_url(dataset: str) -> str:
    return config.EUROSTAT_BROWSER.format(code=dataset)


def _periods(ds: Dataset) -> list[str]:
    periods = ds.categories["time"]
    for p in periods:
        if not (len(p) == 4 and p.isdigit()):
            raise SchemaChangeError(f"Unexpected time period {p!r} in {ds.dataset_id}; expected annual YYYY")
    return periods


def _require_categories(ds: Dataset, dim: str, required: list[str]) -> None:
    present = set(ds.categories.get(dim, []))
    missing = [c for c in required if c not in present]
    if missing:
        raise SchemaChangeError(f"{ds.dataset_id}: dimension {dim} lacks categories {missing}")


def _obs(geo, indicator, period, value, unit, flag, source_id, source_url, published, retrieved, status=None, note=None):
    o = {
        "geo": geo,
        "geo_name": config.GEO_NAMES[geo],
        "indicator": indicator,
        "period": period,
        "frequency": "annual",
        "value": value,
        "unit": unit,
        "status": status or map_status(value, flag),
        "source_flag": flag or None,
        "source_id": source_id,
        "source_url": source_url,
        "source_published_at": published,
        "retrieved_at": retrieved,
    }
    if note:
        o["status_note"] = note
    return o


def parse_sources(raw: dict[str, RawSource]) -> dict[str, Dataset]:
    parsed = {}
    for source_id, expected in EXPECTED_DIMENSIONS.items():
        if source_id not in raw:
            raise SchemaChangeError(f"Source {source_id} missing from fetch results")
        parsed[source_id] = parse(raw[source_id].payload, expected_dimensions=expected)
    return parsed


def transform(raw: dict[str, RawSource]) -> TransformResult:
    ds = parse_sources(raw)
    roadus = ds["eurostat:tran_sf_roadus"]
    pop = ds["eurostat:demo_gind"]
    sdg = ds["eurostat:sdg_11_40"]

    _require_categories(roadus, "unit", ["NR", "P_MHAB"])
    _require_categories(roadus, "sex", ["T"])
    _require_categories(roadus, "age", ["TOTAL"])
    _require_categories(roadus, "pers_cat", ["TOTAL"])
    _require_categories(roadus, "geo", [config.EU_AGGREGATE])
    _require_categories(pop, "indic_de", ["AVG"])
    _require_categories(sdg, "unit", ["NR", "RT"])

    periods = _periods(roadus)
    pop_periods = set(_periods(pop))
    sdg_periods = set(_periods(sdg))

    meta = {}
    for sid, d in ds.items():
        published = to_utc_iso(d.annotation_date("UPDATE_DATA") or d.updated)
        meta[sid] = {"published": published, "retrieved": raw[sid].retrieved_at}

    r_meta, p_meta = meta["eurostat:tran_sf_roadus"], meta["eurostat:demo_gind"]
    r_url, p_url = browser_url("tran_sf_roadus"), browser_url("demo_gind")

    observations: list[dict] = []
    cross = {"sdg_counts": {}, "sdg_rates_per_100k": {}, "roadus_rates_per_million": {}}

    for geo in config.ALL_GEOS:
        for period in periods:
            deaths, d_flag = roadus.get(freq="A", sex="T", age="TOTAL", unit="NR", pers_cat="TOTAL", geo=geo, time=period) \
                if geo in roadus.categories["geo"] else (None, None)
            if deaths is not None:
                if float(deaths) != int(deaths):
                    raise SchemaChangeError(f"Non-integer fatality count {deaths!r} for {geo} {period}")
                deaths = int(deaths)
            observations.append(_obs(geo, "road_fatalities", period, deaths, "persons", d_flag,
                                     "eurostat:tran_sf_roadus", r_url, r_meta["published"], r_meta["retrieved"]))

            population, p_flag = (None, None)
            if period in pop_periods and geo in pop.categories["geo"]:
                population, p_flag = pop.get(freq="A", indic_de="AVG", geo=geo, time=period)
            if population is not None:
                population = int(population)
            observations.append(_obs(geo, "population_average", period, population, "persons", p_flag,
                                     "eurostat:demo_gind", p_url, p_meta["published"], p_meta["retrieved"]))

            if deaths is not None and population:
                rate = round(deaths / population * 1_000_000, 1)
                d_status, p_status = map_status(deaths, d_flag), map_status(population, p_flag)
                status = most_cautious(d_status, p_status)
                flags = "".join(sorted(set((d_flag or "") + (p_flag or "")))) or None
                note_parts = []
                if d_flag:
                    note_parts.append(f"fatalities flagged '{d_flag}'")
                if p_flag:
                    note_parts.append(f"population flagged '{p_flag}'")
                note = ("Derived value; " + " and ".join(note_parts) + " by Eurostat.") if note_parts else None
            else:
                rate, status, flags, note = None, "missing", None, None
            published = max(filter(None, [r_meta["published"], p_meta["published"]]), default=None)
            retrieved = max(r_meta["retrieved"], p_meta["retrieved"])
            observations.append(_obs(geo, "road_fatalities_per_million", period, rate, "per million inhabitants",
                                     flags, "derived:road_fatalities_per_million", METHODOLOGY_URL,
                                     published, retrieved, status=status, note=note))

            # Cross-check data (not published as observations).
            key = f"{geo}|{period}"
            if geo in roadus.categories["geo"]:
                v, _ = roadus.get(freq="A", sex="T", age="TOTAL", unit="P_MHAB", pers_cat="TOTAL", geo=geo, time=period)
                if v is not None:
                    cross["roadus_rates_per_million"][key] = v
            if period in sdg_periods and geo in sdg.categories["geo"]:
                v, _ = sdg.get(freq="A", tra_infr="TOTAL", unit="NR", geo=geo, time=period)
                if v is not None:
                    cross["sdg_counts"][key] = v
                v, _ = sdg.get(freq="A", tra_infr="TOTAL", unit="RT", geo=geo, time=period)
                if v is not None:
                    cross["sdg_rates_per_100k"][key] = v

    sources = []
    for sid, spec in config.SOURCES.items():
        d = ds[sid]
        sources.append({
            "id": sid,
            "publisher": spec["publisher"],
            "title": spec["title"],
            "dataset": spec["dataset"],
            "role": spec["role"],
            "url": browser_url(spec["dataset"]),
            "api_url": raw[sid].url,
            "metadata_url": spec["metadata_url"],
            "source_published_at": meta[sid]["published"],
            "retrieved_at": meta[sid]["retrieved"],
            "latest_period_in_source": max(_periods(d)) if d.categories["time"] else None,
            "status_flag_labels": d.status_labels,
            "license": spec["license"],
        })
    sources.append({
        "id": "derived:road_fatalities_per_million",
        "publisher": "Vision Zero Monitor (derived from Eurostat data)",
        "title": "Road fatalities per million inhabitants (derived)",
        "dataset": None,
        "role": "derived",
        "url": METHODOLOGY_URL,
        "api_url": None,
        "metadata_url": METHODOLOGY_URL,
        "source_published_at": None,
        "retrieved_at": max(r_meta["retrieved"], p_meta["retrieved"]),
        "latest_period_in_source": None,
        "status_flag_labels": {},
        "license": "Derived from Eurostat data; same reuse terms apply",
    })
    return TransformResult(observations=observations, sources=sources, cross_check=cross, parsed=ds, periods=periods)


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------

def index_observations(observations: list[dict]) -> dict[tuple[str, str, str], dict]:
    return {(o["geo"], o["indicator"], o["period"]): o for o in observations}


def pct_change(current: float | None, base: float | None) -> float | None:
    if current is None or base is None or base == 0:
        return None
    return (current - base) / base * 100


def build_targets(observations: list[dict]) -> list[dict]:
    idx = index_observations(observations)
    out = []
    for t in config.TARGETS:
        base = idx.get((t["geo"], t["indicator"], t["baseline_period"]))
        base_value = base["value"] if base else None
        out.append({
            **t,
            "baseline_value": base_value,
            "baseline_status": base["status"] if base else "missing",
            "target_value": base_value * (1 - t["reduction_fraction"]) if base_value is not None else None,
        })
    return out


def latest_period_with_data(observations: list[dict], geo: str, indicator: str) -> str | None:
    periods = [o["period"] for o in observations if o["geo"] == geo and o["indicator"] == indicator and o["value"] is not None]
    return max(periods) if periods else None


def coverage(observations: list[dict], period: str | None) -> dict:
    if period is None:
        return {"period": None, "member_states_reporting": 0, "member_states_total": len(config.MEMBER_STATES), "missing": list(config.MEMBER_STATES)}
    idx = index_observations(observations)
    missing = [g for g in config.MEMBER_STATES if (idx.get((g, "road_fatalities", period)) or {}).get("value") is None]
    return {
        "period": period,
        "member_states_reporting": len(config.MEMBER_STATES) - len(missing),
        "member_states_total": len(config.MEMBER_STATES),
        "missing": missing,
    }


def build_latest(observations: list[dict], targets: list[dict], generated_at: str) -> dict:
    idx = index_observations(observations)
    eu = config.EU_AGGREGATE
    target = targets[0]
    period = latest_period_with_data(observations, eu, "road_fatalities")

    def val(geo, ind, p):
        o = idx.get((geo, ind, p))
        return (o["value"], o["status"]) if o else (None, "missing")

    eu_summary = None
    if period:
        prev = str(int(period) - 1)
        deaths, d_status = val(eu, "road_fatalities", period)
        prev_deaths, prev_status = val(eu, "road_fatalities", prev)
        rate, r_status = val(eu, "road_fatalities_per_million", period)
        base, tgt = target["baseline_value"], target["target_value"]
        progress = None
        if base is not None and tgt is not None and deaths is not None and base != tgt:
            progress = (base - deaths) / (base - tgt)
        eu_summary = {
            "period": period,
            "fatalities": deaths,
            "fatalities_status": d_status,
            "rate_per_million": rate,
            "rate_status": r_status,
            "previous_period": prev,
            "previous_fatalities": prev_deaths,
            "previous_status": prev_status,
            "yoy_change_abs": (deaths - prev_deaths) if deaths is not None and prev_deaths is not None else None,
            "yoy_change_percent": pct_change(deaths, prev_deaths),
            "baseline_period": target["baseline_period"],
            "baseline_fatalities": base,
            "change_from_baseline_percent": pct_change(deaths, base),
            "target_period": target["target_period"],
            "target_fatalities": tgt,
            "progress_towards_target_fraction": progress,
        }

    countries = []
    for geo, (iso, name) in config.MEMBER_STATES.items():
        p = latest_period_with_data(observations, geo, "road_fatalities")
        deaths, status = val(geo, "road_fatalities", p) if p else (None, "missing")
        rate, rate_status = val(geo, "road_fatalities_per_million", p) if p else (None, "missing")
        prev = val(geo, "road_fatalities", str(int(p) - 1))[0] if p else None
        base = val(geo, "road_fatalities", target["baseline_period"])[0]
        countries.append({
            "geo": geo,
            "iso2": iso,
            "name": name,
            "period": p,
            "fatalities": deaths,
            "status": status,
            "rate_per_million": rate,
            "rate_status": rate_status,
            "yoy_change_percent": pct_change(deaths, prev),
            "change_from_baseline_percent": pct_change(deaths, base),
        })

    return {
        "schema_version": config.SCHEMA_VERSION,
        "generated_at": generated_at,
        "latest_period": period,
        "eu": eu_summary,
        "coverage": coverage(observations, period),
        "countries": countries,
    }


def content_hash(observations: list[dict], sources: list[dict], breakdowns: dict | None = None,
                 published_config: dict | None = None) -> str:
    """Hash of the substantive content, ignoring retrieval timestamps.

    `published_config` (targets, indicator definitions, notices) is included so that a change in
    methodology text or targets is exported even when the source data are unchanged.
    """
    stable_obs = [{k: v for k, v in o.items() if k != "retrieved_at"} for o in observations]
    stable_src = [{k: v for k, v in s.items() if k not in ("retrieved_at",)} for s in sources]
    stable_bd = None
    if breakdowns is not None:
        stable_bd = {
            "periods": breakdowns["periods"],
            "dimensions": [{k: v for k, v in d.items() if k != "retrieved_at"} for d in breakdowns["dimensions"]],
            "series": breakdowns["series"],
        }
    payload = {"o": stable_obs, "s": stable_src} if stable_bd is None else {"o": stable_obs, "s": stable_src, "b": stable_bd}
    if published_config is not None:
        payload["c"] = published_config
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(blob).hexdigest()
