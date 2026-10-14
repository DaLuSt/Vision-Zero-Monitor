# Test fixtures

* `eurostat_2026-10-14/` — **real** Eurostat dissemination API responses captured on
  2026-10-14 by `python -m scripts.data_pipeline.run --save-raw`. They are used so that
  tests run offline. They are not used by the production dashboard.
* Synthetic JSON-stat documents used for edge cases are constructed inside the tests
  (`tests/conftest.py::make_jsonstat`) and are clearly marked as synthetic. They must never
  be copied into `public/data/`.
