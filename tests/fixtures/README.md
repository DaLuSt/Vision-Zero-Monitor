# Test fixtures

* `eurostat_2026-10-14/` — **real** Eurostat dissemination API responses captured on
  2026-10-14 by `python -m scripts.data_pipeline.run --save-raw`. They are used so that
  tests run offline. They are not used by the production dashboard.
  `tran_sf_roadus.json` (now with all ages and sexes) and `tran_sf_roadro.json` were captured
  on 2026-10-17 when the age, sex and road-type breakdowns were added; `manifest.json` records
  each file's own request URL and retrieval time. Eurostat's release date is the same
  (2026-08-25) for both captures of `tran_sf_roadus`.
* Synthetic JSON-stat documents used for edge cases are constructed inside the tests
  (`tests/conftest.py::make_jsonstat`) and are clearly marked as synthetic. They must never
  be copied into `public/data/`.
