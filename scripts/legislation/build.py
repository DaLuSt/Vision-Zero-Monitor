"""Assemble the public legislation register from SPARQL rows.

The steps are:
  discover_acts      → CELEX numbers tagged "road safety" (+ curated additions)
  act_details        → title, type, dates, in-force status, ELI
  relations          → proposal adopted, amendments, repeals, replacements, proposals to amend
  discover_proposals → proposals tagged "road safety"
  proposal_details   → status of every proposal referenced above
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Callable

from . import config, queries

STEPS = ("discover_acts", "act_details", "relations", "discover_proposals", "proposal_details")

CELEX_RE = re.compile(r"^[0-9][0-9]{4}[A-Z]{1,3}[0-9]{4,6}(\([0-9]{2}\))?$")
OPEN_END = "9999-12-31"

Runner = Callable[[str, str], list[dict[str, str]]]  # (step name, sparql) → rows


def eurlex_url(celex: str) -> str:
    return config.EURLEX_URL.format(celex=celex)


def _date(value: str | None) -> str | None:
    """Normalise to YYYY-MM-DD; open-ended (9999-12-31) and empty values become None."""
    if not value:
        return None
    d = value[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", d) or d == OPEN_END:
        return None
    return d


def _dates(concat: str | None) -> list[str]:
    return sorted({d for d in (_date(x) for x in (concat or "").split("|")) if d})


def _bool(value: str | None) -> bool | None:
    if value in ("1", "true"):
        return True
    if value in ("0", "false"):
        return False
    return None


COM_CELEX_RE = re.compile(r"^5(\d{4})PC(\d{4,6})")
STALE_OPEN_YEARS = 5


def com_reference(row: dict[str, str]) -> str | None:
    """Official COM number, from the internal-number fields or else from the CELEX (5YYYYPCNNNN)."""
    prefix, year, seq = row.get("number_prefix"), row.get("number_year"), row.get("number_seq")
    if prefix and year and seq and seq.isdigit():
        return f"{prefix}({year}) {int(seq)}"
    m = COM_CELEX_RE.match(row.get("celex", ""))
    return f"COM({m.group(1)}) {int(m.group(2))}" if m else None


def proposal_status(row: dict[str, str]) -> str:
    """adopted: an act adopts it; open: no end of validity recorded; otherwise closed without an act."""
    if row.get("adopted_by"):
        return "adopted"
    eov = row.get("end_of_validity")
    if not eov or eov.startswith("9999"):
        return "open"
    return "closed_without_act"


def fetch_rows(run: Runner) -> dict[str, list[dict[str, str]]]:
    """Run the query sequence. `run` executes (or replays) one step."""
    ev = config.EUROVOC_ROAD_SAFETY
    out: dict[str, list[dict[str, str]]] = {}
    out["discover_acts"] = run("discover_acts", queries.discover_acts(ev, config.ACT_TYPES))
    celexes = {r["celex"] for r in out["discover_acts"]} | {c["celex"] for c in config.CURATED_ADDITIONS}
    out["act_details"] = run("act_details", queries.act_details(celexes, ev))
    out["relations"] = run("relations", queries.relations(celexes))
    out["discover_proposals"] = run("discover_proposals", queries.discover_proposals(ev, config.PROPOSAL_TYPES))
    proposal_ids = {r["celex"] for r in out["discover_proposals"]} | {
        r["other"] for r in out["relations"]
        if r.get("relation") == "proposes_to_amend" and r.get("direction") == "in"
    } | {
        r["other"] for r in out["relations"]
        if r.get("relation") == "adopts" and r.get("direction") == "out" and "PC" in r.get("other", "")
    }
    out["proposal_details"] = run("proposal_details", queries.proposal_details(proposal_ids))
    return out


def _related(r: dict[str, str]) -> dict:
    return {
        "celex": r["other"],
        "title": r.get("other_title") or None,
        "date": _date(r.get("other_date")) or _date(r.get("other_dispatch")),
        "url": eurlex_url(r["other"]),
    }


def build_register(rows: dict[str, list[dict[str, str]]], retrieved_at: str, generated_at: str) -> dict:
    curated = {c["celex"]: c["reason"] for c in config.CURATED_ADDITIONS}
    details = {r["celex"]: r for r in rows["act_details"]}

    # Proposals referenced anywhere, with their status.
    tagged_proposals = {r["celex"] for r in rows["discover_proposals"]}
    proposals = {}
    for p in rows["proposal_details"]:
        celex = p["celex"]
        if p.get("type") not in config.PROPOSAL_TYPES:
            continue  # e.g. Council first-reading positions linked by "proposes to amend"
        proposals[celex] = {
            "celex": celex,
            "reference": com_reference(p),
            "title": p.get("title") or None,
            "type": p.get("type") or None,
            "type_label": config.PROPOSAL_TYPES.get(p.get("type", ""), "Proposal"),
            "date_sent": _date(p.get("date_sent")),
            "status": proposal_status(p),
            "status_note": None,
            "end_of_validity": _date(p.get("end_of_validity")),
            "adopted_by": sorted(x for x in (p.get("adopted_by") or "").split("|") if x),
            "proposes_to_amend": sorted(x for x in (p.get("proposes_to_amend") or "").split("|") if x),
            "indexed_road_safety": celex in tagged_proposals,
            "url": eurlex_url(celex),
        }

    # An "open" status only means no adoption or end date is recorded in the metadata.
    for prop in proposals.values():
        if prop["status"] == "open" and prop["date_sent"]:
            years = (int(generated_at[:4]) - int(prop["date_sent"][:4]))
            if years > STALE_OPEN_YEARS:
                prop["status_note"] = (f"No adoption, withdrawal or end date recorded in EUR-Lex metadata after "
                                       f"{years} years; the procedure may have ended. Check the EUR-Lex page.")

    rel: dict[str, dict[str, list[dict]]] = {}
    for r in rows["relations"]:
        key = {
            ("in", "amends"): "amended_by", ("out", "amends"): "amends",
            ("in", "repeals"): "repealed_by", ("out", "repeals"): "repeals",
            ("in", "replaces"): "replaced_by", ("out", "replaces"): "replaces",
            ("out", "adopts"): "proposal", ("in", "proposes_to_amend"): "amendment_proposals",
        }.get((r.get("direction"), r.get("relation")))
        if key is None:
            continue
        if key == "proposal" and "PC" not in r["other"]:
            continue  # "adopts" also links acts to non-proposal documents
        rel.setdefault(r["celex"], {}).setdefault(key, []).append(_related(r))

    acts = []
    for celex, d in details.items():
        rtype = d.get("type", "")
        links = rel.get(celex, {})
        dedup = lambda items: sorted({i["celex"]: i for i in items}.values(), key=lambda i: (i["date"] or "", i["celex"]))  # noqa: E731
        proposal_links = dedup(links.get("proposal", []))
        proposal = None
        if proposal_links:
            p = proposals.get(proposal_links[0]["celex"])
            proposal = {
                "celex": proposal_links[0]["celex"],
                "reference": p["reference"] if p else com_reference({"celex": proposal_links[0]["celex"]}),
                "date_sent": p["date_sent"] if p else proposal_links[0]["date"],
                "url": proposal_links[0]["url"],
            }
        indexed = _bool(d.get("indexed_road_safety")) is True
        acts.append({
            "celex": celex,
            "title": d.get("title") or None,
            "type": rtype,
            "type_label": config.ACT_TYPES.get(rtype, rtype or "Legal act"),
            "date_adopted": _date(d.get("date_document")),
            "entry_into_force": _dates(d.get("entry_into_force")),
            "transposition_deadlines": _dates(d.get("transposition")),
            "in_force": _bool(d.get("in_force")),
            "end_of_validity": _date(d.get("end_of_validity")),
            "eli": d.get("eli") or None,
            "url": eurlex_url(celex),
            "responsible": d.get("responsible") or None,
            "inclusion": (
                {"basis": "eurovoc", "reason": "Indexed by the EU Publications Office under EuroVoc 'road safety' (4047)."}
                if indexed else {"basis": "curated", "reason": curated.get(celex, "Added by maintainers.")}
            ),
            "proposal": proposal,
            "amended_by": dedup(links.get("amended_by", [])),
            "amends": dedup(links.get("amends", [])),
            "repealed_by": dedup(links.get("repealed_by", [])),
            "repeals": dedup(links.get("repeals", [])),
            "replaced_by": dedup(links.get("replaced_by", [])),
            "replaces": dedup(links.get("replaces", [])),
            "amendment_proposals": sorted({x["celex"] for x in links.get("amendment_proposals", [])
                                           if x["celex"] in proposals}),
        })
    acts.sort(key=lambda a: (a["date_adopted"] or "", a["celex"]), reverse=True)
    props = sorted(proposals.values(), key=lambda p: (p["date_sent"] or "", p["celex"]), reverse=True)

    in_force = [a for a in acts if a["in_force"]]
    by_type: dict[str, int] = {}
    for a in in_force:
        by_type[a["type_label"]] = by_type.get(a["type_label"], 0) + 1
    return {
        "schema_version": config.SCHEMA_VERSION,
        "generated_at": generated_at,
        "source": {
            "publisher": "Publications Office of the European Union (Cellar / EUR-Lex metadata)",
            "endpoint": config.SPARQL_ENDPOINT,
            "selection": "Legal acts and proposals indexed with EuroVoc concept 'road safety', plus curated additions",
            "eurovoc": {"id": config.EUROVOC_ROAD_SAFETY, "label": "road safety"},
            "curated_additions": config.CURATED_ADDITIONS,
            "retrieved_at": retrieved_at,
            "licence": "EUR-Lex data reuse: Commission Decision 2011/833/EU; © European Union",
        },
        "summary": {
            "acts_total": len(acts),
            "acts_in_force": len(in_force),
            "acts_in_force_by_type": dict(sorted(by_type.items())),
            "proposals_open": sum(1 for p in props if p["status"] == "open" and not p["status_note"]),
            "proposals_open_unclear": sum(1 for p in props if p["status"] == "open" and p["status_note"]),
        },
        "acts": acts,
        "proposals": props,
    }


def content_hash(doc: dict) -> str:
    stable = {k: v for k, v in doc.items() if k != "generated_at"}
    stable["source"] = {k: v for k, v in doc["source"].items() if k != "retrieved_at"}
    blob = json.dumps(stable, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(blob).hexdigest()
