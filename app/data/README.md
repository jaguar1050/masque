# app/data — committed population-estimates artifacts

This folder holds the finished, design-aware estimates that the Population estimates section of
screenAIr's Research tab renders (`app/population.html` now redirects there): 19 artifacts from NHIS,
NHANES, NAMCS, FAERS and MEPS, each listed in `population-estimates.index.json`. Every one was
written by `app/etl/masque_population_etl.R`; none is edited by hand.

## Adding an estimate

1. Run the ETL (see `app/etl/README_DATA_CONNECTION.md`):

   ```
   Rscript app/etl/masque_population_etl.R --data ./adult24.csv \
     --map app/etl/phenotype_map_nhis_2024.json \
     --out app/data/population-estimates.nhis-2024.json --downloaded-at 2026-09-24
   ```

2. Commit the JSON it writes here. Name it `population-estimates.<dataset>-<cycle>.json`.
3. Add one entry to `population-estimates.index.json`:

   ```json
   { "path": "./data/population-estimates.nhis-2024.json", "addedOn": "2026-09-24", "note": "NHIS 2024 Sample Adult" }
   ```

The page validates every listed file against `app/etl/population_estimates.schema.json`
and refuses anything that fails, so a malformed artifact is shown as refused rather than
rendered wrongly. Edit the ETL or the map, never the numbers.

## provenance/

Records written by the preparation scripts, kept beside the artifacts they feed. They are
committed as the scripts wrote them and not edited afterwards, so two things in them need saying
here rather than being corrected in place:

- `nhanes-fetch-manifest.json` (URLs, bytes, SHA-256 and fetch times of the NHANES XPT files) was
  written by `app/etl/nhanes_fetch.py` on the project lead's machine, not in the environment that
  ran the ETL.
- The `directory` field of `nhanes_<cycle>.provenance.json` is the temporary scratch folder the
  XPT files were merged in. It records where `nhanes_prepare.py` ran, not a location anyone can
  open; the component file names and SHA-256 values beside it are what identify the inputs.

## What never goes here

- Row-level survey data. Public-use files are downloaded by whoever runs the ETL and are
  identified in the artifact by name and SHA-256 only.
- Clinic cohort rows. Those are uploaded into the research panel in the Research tab of
  screenAIr (`app/screenair.html`) and never leave the browser.
- Anything synthetic. The test fixture lives under `app/tests/fixtures/` and is not deployed.
