# 02 — Intentional divergences between `app/` and `reference/`

`reference/fixed-src/` is the feature-parity baseline and the rollback copy; `reference/MASQUE_v0.3.1/` is the pristine upstream release. Both are read-only. This file records every place where `app/` deliberately differs from them, so a parity check knows what to whitelist, exactly as the three TDZ fixes were recorded for `fixed-src`. Anything that differs and is not listed here is a defect.

Dated 24 September 2026. Instrument, lexicon, probe set and gold set are untouched by everything below; no item, weight, cut-point, phrase, probe, red flag or patient-facing wording changed.

## `app/src/` vs `reference/fixed-src/`

| File | Divergence | Why |
|---|---|---|
| `MASQUE_Scribe_v0_3.jsx` | Imports `./MASQUE_Voice.js`; adds Listen / Stop listening, a speaker toggle, an interim-preview bubble, transcript `src` tags, domain-bar pulse, and an honest note that transcription runs through the browser's speech service. | Native microphone capture (commit `d59e734`). |
| `MASQUE_Scribe_v0_3.jsx` | `skipPrompt` no longer writes `"no"` for a scored item; it records the prompt as skipped (`skipped` state) and the suggestion list hides it. | A skipped prompt is *not asked*, not *denied*. Writing `"no"` counted it toward coverage, removed its headroom from the attainable range, and put a denial in the note and the QuestionnaireResponse — the absent-data-as-negative-data error the codebase's first invariant forbids. |
| `MASQUE_Screener_v0_3.jsx` | `screenToCohortRow` takes `ctx` (defaulting to `{}`) and `captureScreen` passes it. | The builder read `ctx.visit_label` (`fixed-src` L585) without ever receiving `ctx`, so **"Append this screen"** threw a `ReferenceError` in the deployed screener and the pilot could not capture a row. |
| `ResearchReadinessPanel.jsx` | The inline `PopulationArtifact` component is removed and imported from `./PopulationArtifact.jsx`; the population-tab hint names `app/etl/` and the Population page. | One renderer for the panel's preview path and the new page. The extracted version fixes two rendering defects: a non-string `domain` (the 0.1.0 ETL wrote `{}` for the total row) was misfiled as a subgroup and rendered as a React child; and every total row was labelled "Phenotype prevalence" and formatted as a percent regardless of what it was, which would have shown a MEPS dollar figure as `4300000%`. |
| `MASQUE_Voice.js`, `PopulationArtifact.jsx`, `MASQUE_Population.jsx`, `MASQUE_SchemaCheck.js` | New modules with no counterpart in `fixed-src`. | Voice capture; the open-data population page and its renderer; the schema check both the page and the local validator use. |

## `app/etl/` vs `reference/MASQUE_v0.3.1/etl/`

`app/etl/` is the canonical, published copy from this date; the reference copy stays at ETL 0.1.0 for the record.

| File | Divergence | Why |
|---|---|---|
| `masque_population_etl.R` | 0.1.0 → 0.2.0. Four defects fixed, two hard stops added, `--downloaded-at`, `unit` on every estimate, `rse` omitted rather than null when not computable. | Running 0.1.0 against its own shipped map halted R before reading data (the TODO scan hit the string-valued `_instruction` entry); `as.integer(NA %in% codes)` turned Refused / Don't-know respondents into phenotype-negatives; `list(domain = NULL)` serialised as `{}`; `sapply` over one variable could collapse to a vector and break `apply`. The hard stops refuse to run on a TODO `phenotype_definition` or a conjunction that references an unmapped concept, so the §7.1 decision is made by the clinical lead rather than silently narrowed. The header of the script carries the same list. |
| `phenotype_map_nhis_2024.json` | `_instruction` documents the status vocabulary (`TODO*` refuses to run; `unmapped`; `mapped`). | The ETL now reads statuses with `startsWith("TODO")`, so `TODO-OR-ACCEPT-UNMAPPED` on `recalcitrance_proxy` also stops until someone decides. The design block, hints and every concept are unchanged. |
| `population_estimates.schema.json` | Adds optional `unit` (`proportion` / `usd` / `count` / `years`) on an estimate. | The renderer formats by unit instead of guessing from the name. |
| `README_DATA_CONNECTION.md` | Paths updated to `app/etl/` and `app/data/`; step 4 is now "commit and index" with the panel upload as a preview; the status vocabulary, `--downloaded-at`, and the NHANES route (a second map file, not a codebook fill) are spelled out step by step. | The hand-off for the first real run. |
| `nhanes_fetch.py`, `nhanes_prepare.py`, `phenotype_map_nhanes_1999_2004.json` | New, no counterpart in `reference/`. Standard-library Python fetcher that verifies the SAS XPORT signature of every download and writes a manifest; a merger that reads XPORT v5 natively, left-joins components on `SEQN`, and writes the ETL's CSV with provenance; the NHANES map with its design block filled and every concept TODO with a component hint. | The archive delivered on 24 September held 28 copies of a CDC 404 page saved under `.XPT` names. Both scripts refuse to pass on anything that is not real data. The prepare step was verified here against XPORT files written by pyreadstat (`app/tests/fixtures/nhanes/`, synthetic, invented variables). |

## Verification

- ETL 0.2.0 was run here (R 4.3.3, survey 4.4) on `app/tests/fixtures/synthetic_nhis_like.csv` with `phenotype_map_synthetic.json`, producing `population-estimates.synthetic.json`. The fixture is invented: `source.dataset` is `SYNTHETIC`, the strata and PSU codes are fake, and the map's status text says so. It exists so the ETL and the renderer can be exercised without a public-use file and is never deployed.
- Against the shipped NHIS map the ETL now stops with the intended message (concepts still TODO) instead of an R error.
- The Population page was loaded in Chromium in all three states (no artifact listed; fixture listed; malformed artifact listed) with `data-masque-ready === "true"` and a clean console; the screener's Append no longer throws; the scribe's Skip leaves coverage unchanged.

## Version labels

`APP_VERSION` remains `0.3.0` in every app file, as it was in 0.3.1's source; the README and VERSIONS.md in `reference/` describe release 0.3.1. Reconciling that label is a decision for the next release, recorded in `01-inventory.md` §4, and is not changed here. The ETL carries its own `ETL_VERSION` (0.2.0) and the artifact reports it in `producedBy`.
