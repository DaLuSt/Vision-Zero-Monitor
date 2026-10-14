import pytest

from scripts.data_pipeline.jsonstat import SchemaChangeError, parse


def test_parse_real_response(raw_sources):
    ds = parse(raw_sources["eurostat:tran_sf_roadus"].payload)
    assert ds.dimension_ids == ["freq", "sex", "age", "unit", "pers_cat", "geo", "time"]
    value, flag = ds.get(freq="A", sex="T", age="TOTAL", unit="NR", pers_cat="TOTAL", geo="EU27_2020", time="2019")
    assert value == 22757 and flag is None
    assert ds.annotation_date("UPDATE_DATA") == "2026-08-25T23:00:00+0200"


def test_parse_status_flags(raw_sources):
    ds = parse(raw_sources["eurostat:demo_gind"].payload)
    value, flag = ds.get(freq="A", indic_de="AVG", geo="EU27_2020", time="2024")
    assert value > 400_000_000
    assert flag == "ep"
    assert ds.status_labels["p"] == "provisional"


def test_absent_cell_returns_none(jsonstat_factory):
    doc = jsonstat_factory({"geo": ["NL", "BE"], "time": ["2020"]}, {("NL", "2020"): 5})
    ds = parse(doc)
    assert ds.get(geo="BE", time="2020") == (None, None)


def test_dense_value_array(jsonstat_factory):
    doc = jsonstat_factory({"geo": ["NL", "BE"], "time": ["2020"]}, {})
    doc["value"] = [1, None]
    ds = parse(doc)
    assert ds.get(geo="NL", time="2020") == (1, None)
    assert ds.get(geo="BE", time="2020") == (None, None)


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d.update({"class": "collection"}), "not a JSON-stat dataset"),
    (lambda d: d.update({"size": [2]}), "Invalid 'size'"),
    (lambda d: d["value"].update({"99": 1}), "Out-of-range"),
    (lambda d: d["value"].update({"0": "12"}), "Non-numeric"),
    (lambda d: d.update({"error": {"label": "boom"}}), "error object"),
])
def test_unexpected_schema_raises(jsonstat_factory, mutate, message):
    doc = jsonstat_factory({"geo": ["NL", "BE"], "time": ["2020"]}, {("NL", "2020"): 5})
    mutate(doc)
    with pytest.raises(SchemaChangeError, match=message):
        parse(doc)


def test_expected_dimensions_enforced(jsonstat_factory):
    doc = jsonstat_factory({"geo": ["NL"], "time": ["2020"]}, {("NL", "2020"): 5})
    with pytest.raises(SchemaChangeError, match="Expected dimensions"):
        parse(doc, expected_dimensions={"geo", "time", "unit"})
