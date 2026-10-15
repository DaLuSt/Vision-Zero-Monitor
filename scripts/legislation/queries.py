"""SPARQL queries against the EU Publications Office (Cellar, CDM ontology).

Queries return one row per item; multi-valued properties are aggregated with
GROUP_CONCAT so that no row multiplication happens.
"""

from __future__ import annotations

PREFIXES = """PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""
ENG = "<http://publications.europa.eu/resource/authority/language/ENG>"
CORRIGENDUM_FILTER = 'FILTER(!REGEX(STR(?celex), "R\\\\([0-9]+\\\\)$"))'


def _types(types) -> str:
    return ", ".join(f'"{t}"' for t in sorted(types))


def _values(celexes) -> str:
    return " ".join(f'"{c}"^^xsd:string' for c in sorted(celexes))


def discover_acts(eurovoc: str, types) -> str:
    """CELEX numbers of legal acts (sector 3) indexed with the given EuroVoc concept."""
    return PREFIXES + f"""
SELECT DISTINCT ?celex WHERE {{
  ?w cdm:work_is_about_concept_eurovoc <{eurovoc}> ;
     cdm:resource_legal_id_celex ?celex ;
     cdm:resource_legal_id_sector "3"^^xsd:string ;
     cdm:work_has_resource-type ?rtu .
  FILTER(STRAFTER(STR(?rtu), "resource-type/") IN ({_types(types)}))
  {CORRIGENDUM_FILTER}
}}"""


def act_details(celexes, eurovoc: str) -> str:
    """Core metadata for the given acts. Multi-valued dates are concatenated with '|'."""
    return PREFIXES + f"""
SELECT ?celex (SAMPLE(?rt) AS ?type) (SAMPLE(?date) AS ?date_document) (SAMPLE(?inforce) AS ?in_force)
       (SAMPLE(?eov) AS ?end_of_validity) (SAMPLE(?eli) AS ?eli) (SAMPLE(?title) AS ?title)
       (SAMPLE(?tagged) AS ?indexed_road_safety) (SAMPLE(?dg) AS ?responsible)
       (GROUP_CONCAT(DISTINCT STR(?eif); separator="|") AS ?entry_into_force)
       (GROUP_CONCAT(DISTINCT STR(?tr); separator="|") AS ?transposition)
WHERE {{
  VALUES ?celex {{ {_values(celexes)} }}
  ?w cdm:resource_legal_id_celex ?celex ; cdm:work_has_resource-type ?rtu .
  BIND(STRAFTER(STR(?rtu), "resource-type/") AS ?rt)
  OPTIONAL {{ ?w cdm:work_date_document ?date }}
  OPTIONAL {{ ?w cdm:resource_legal_in-force ?inforce }}
  OPTIONAL {{ ?w cdm:resource_legal_date_end-of-validity ?eov }}
  OPTIONAL {{ ?w cdm:resource_legal_eli ?eli }}
  OPTIONAL {{ ?w cdm:resource_legal_date_entry-into-force ?eif }}
  OPTIONAL {{ ?w cdm:directive_date_transposition ?tr }}
  OPTIONAL {{ ?w cdm:resource_legal_responsibility_of_agent ?dgu . BIND(STRAFTER(STR(?dgu), "corporate-body/") AS ?dg) }}
  BIND(EXISTS {{ ?w cdm:work_is_about_concept_eurovoc <{eurovoc}> }} AS ?tagged)
  OPTIONAL {{ ?e cdm:expression_belongs_to_work ?w ; cdm:expression_uses_language {ENG} ; cdm:expression_title ?title }}
}} GROUP BY ?celex"""


RELATIONS = ("amends", "repeals", "replaces", "adopts", "proposes_to_amend")


def relations(celexes) -> str:
    """Lifecycle relations between the given acts and other documents, in both directions."""
    props = " ".join(f"cdm:resource_legal_{r}_resource_legal" for r in RELATIONS)
    return PREFIXES + f"""
SELECT ?celex ?direction ?relation ?other (SAMPLE(?ort) AS ?other_type)
       (SAMPLE(?odate) AS ?other_date) (SAMPLE(?osent) AS ?other_dispatch) (SAMPLE(?otitle) AS ?other_title)
WHERE {{
  VALUES ?celex {{ {_values(celexes)} }}
  VALUES ?p {{ {props} }}
  ?w cdm:resource_legal_id_celex ?celex .
  {{ ?w ?p ?o . BIND("out" AS ?direction) }} UNION {{ ?o ?p ?w . BIND("in" AS ?direction) }}
  ?o cdm:resource_legal_id_celex ?other .
  FILTER(!REGEX(STR(?other), "R\\\\([0-9]+\\\\)$"))
  BIND(STRBEFORE(STRAFTER(STR(?p), "resource_legal_"), "_resource_legal") AS ?relation)
  OPTIONAL {{ ?o cdm:work_has_resource-type ?ortu . BIND(STRAFTER(STR(?ortu), "resource-type/") AS ?ort) }}
  OPTIONAL {{ ?o cdm:work_date_document ?odate }}
  OPTIONAL {{ ?o cdm:resource_legal_date_dispatch ?osent }}
  OPTIONAL {{ ?oe cdm:expression_belongs_to_work ?o ; cdm:expression_uses_language {ENG} ; cdm:expression_title ?otitle }}
}} GROUP BY ?celex ?direction ?relation ?other"""


def discover_proposals(eurovoc: str, types) -> str:
    """Commission legislative proposals indexed with the given EuroVoc concept."""
    return PREFIXES + f"""
SELECT DISTINCT ?celex WHERE {{
  ?p cdm:work_is_about_concept_eurovoc <{eurovoc}> ;
     cdm:resource_legal_id_celex ?celex ;
     cdm:work_has_resource-type ?rtu .
  FILTER(STRAFTER(STR(?rtu), "resource-type/") IN ({_types(types)}))
  {CORRIGENDUM_FILTER}
}}"""


def proposal_details(celexes) -> str:
    """Status data for proposals: dispatch date, end of validity, adopting act, COM number."""
    return PREFIXES + f"""
SELECT ?celex (SAMPLE(?rt) AS ?type) (SAMPLE(?sent) AS ?date_sent) (SAMPLE(?eov) AS ?end_of_validity)
       (SAMPLE(?prefix) AS ?number_prefix) (SAMPLE(?year) AS ?number_year) (SAMPLE(?seq) AS ?number_seq)
       (SAMPLE(?title) AS ?title)
       (GROUP_CONCAT(DISTINCT STR(?actc); separator="|") AS ?adopted_by)
       (GROUP_CONCAT(DISTINCT STR(?targetc); separator="|") AS ?proposes_to_amend)
WHERE {{
  VALUES ?celex {{ {_values(celexes)} }}
  ?p cdm:resource_legal_id_celex ?celex .
  OPTIONAL {{ ?p cdm:work_has_resource-type ?rtu . BIND(STRAFTER(STR(?rtu), "resource-type/") AS ?rt) }}
  OPTIONAL {{ ?p cdm:resource_legal_date_dispatch ?sent }}
  OPTIONAL {{ ?p cdm:resource_legal_date_end-of-validity ?eov }}
  OPTIONAL {{ ?p cdm:resource_legal_internal_number_prefix ?prefix }}
  OPTIONAL {{ ?p cdm:resource_legal_internal_number_year ?year }}
  OPTIONAL {{ ?p cdm:resource_legal_internal_number_sequential_number ?seq }}
  OPTIONAL {{ ?a cdm:resource_legal_adopts_resource_legal ?p ; cdm:resource_legal_id_celex ?actc .
             FILTER(!REGEX(STR(?actc), "R\\\\([0-9]+\\\\)$")) }}
  OPTIONAL {{ ?p cdm:resource_legal_proposes_to_amend_resource_legal ?t . ?t cdm:resource_legal_id_celex ?targetc }}
  OPTIONAL {{ ?e cdm:expression_belongs_to_work ?p ; cdm:expression_uses_language {ENG} ; cdm:expression_title ?title }}
}} GROUP BY ?celex"""
