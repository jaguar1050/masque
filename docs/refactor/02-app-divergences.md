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
| `masque_population_etl.R` | 0.1.0 → 0.3.0 (0.3.0 adds a map-declared `phenotype_rule`, an `eligibility` design subset and per-concept `skipNegative`, all needed by the first real run; the script header lists them). Four defects fixed, two hard stops added, `--downloaded-at`, `unit` on every estimate, `rse` omitted rather than null when not computable. | Running 0.1.0 against its own shipped map halted R before reading data (the TODO scan hit the string-valued `_instruction` entry); `as.integer(NA %in% codes)` turned Refused / Don't-know respondents into phenotype-negatives; `list(domain = NULL)` serialised as `{}`; `sapply` over one variable could collapse to a vector and break `apply`. The hard stops refuse to run on a TODO `phenotype_definition` or a conjunction that references an unmapped concept, so the §7.1 decision is made by the clinical lead rather than silently narrowed. The header of the script carries the same list. |
| `phenotype_map_nhis_2024.json` | `_instruction` documents the status vocabulary (`TODO*` refuses to run; `unmapped`; `mapped`). | The ETL now reads statuses with `startsWith("TODO")`, so `TODO-OR-ACCEPT-UNMAPPED` on `recalcitrance_proxy` also stops until someone decides. The design block, hints and every concept are unchanged. |
| `population_estimates.schema.json` | Adds optional `unit` (`proportion` / `usd` / `count` / `years`) on an estimate. | The renderer formats by unit instead of guessing from the name. |
| `README_DATA_CONNECTION.md` | Paths updated to `app/etl/` and `app/data/`; step 4 is now "commit and index" with the panel upload as a preview; the status vocabulary, `--downloaded-at`, and the NHANES route (a second map file, not a codebook fill) are spelled out step by step. | The hand-off for the first real run. |
| `nhanes_fetch.py`, `nhanes_prepare.py`, `phenotype_map_nhanes_<cycle>.json` | New, no counterpart in `reference/`. Standard-library Python fetcher that verifies the SAS XPORT signature of every download and writes a manifest; a merger that reads XPORT v5 natively, left-joins components on `SEQN`, and writes the ETL's CSV with provenance; the NHANES maps, one per 1999–2004 cycle, filled from the files' own variable labels. | The archive delivered on 24 September held 28 copies of a CDC 404 page saved under `.XPT` names. Both scripts refuse to pass on anything that is not real data. The prepare step was verified here against XPORT files written by pyreadstat (`app/tests/fixtures/nhanes/`, synthetic, invented variables). |

## Population estimates added 27 September 2026 (NHIS 2019–2023)

| File | What it is |
|---|---|
| `app/etl/phenotype_map_nhis_{2019,2021,2023}.json`, `phenotype_map_nhis_2023_age40.json` | Filled NHIS maps. Items identified from the public-use files' column names, code frames and universes; each map says the question wording is not in the CSV and must be verified against the codebook. `YRSINUS_A` (years in the U.S.) and `FDSBALANCE_A` (food security) were ruled out by their universes and code frames. 2020 and 2022 carry no headache item and produce no artifact. |
| `app/data/population-estimates.nhis-*.json` | Four artifacts: 2023 all adults, 2023 adults 40+ (NHANES comparator), 2021, 2019. |
| `app/data/provenance/nhis_2019_2023.provenance.json` | SHA-256 of each CDC zip and CSV; every CSV verified byte-identical to the one inside CDC's zip. |
| `masque_population_etl.R` | `eligibility.missing`: codes of the eligibility variable meaning unknown (NHIS age 97/98/99) make a respondent ineligible instead of very old. |
| `MASQUE_Population.jsx` | Cross-source summary table: one row per artifact with population, headache item, otologic arms and the ETL's own estimates. It computes nothing. |
| `PopulationArtifact.jsx` | Question notes rendered as plain text beneath each variable, no longer wrapped in quotation marks, since NHIS notes describe items rather than quote labels. |

**Headache-threshold sensitivity (not committed as an artifact).** The NHIS headache item is a frequency scale. Primary maps count "some days" or more. Re-running NHIS 2023 with only "most days" or "every day" counted:

| NHIS 2023 | Primary (some days or more) | Sensitivity (most days or every day) |
|---|---|---|
| All adults | 14.8% (14.2–15.3) | 6.8% (6.4–7.1) |
| Adults 40+ | 14.4% (13.7–15.0) | 6.1% (5.7–6.5) |

The NHANES 1999–2004 estimates for adults 40+ (11.5–12.9%, "severe headaches or migraines") sit between the two, consistent with NHANES's severity qualifier making its item narrower than the NHIS item as primarily scored and broader than its strict reading.

## Sources reviewed without an estimate, and NAMCS (27 September 2026)

`app/data/population-estimates.index.json` gains a `reviewed` list, rendered by `MASQUE_Population.jsx` as a "Sources reviewed" card: NHIS 2020 and 2022 (no headache item), the BRFSS 2022 condensed extract (design variables `_STSTR`/`_PSU` dropped, no headache/dizziness/tinnitus item, "not asked" coded as 0), and NAMCS single years (each below the NCHS 30-record standard; 2017 not collected because no codebook was available). Each entry states what would change it.

NAMCS 2015/2016/2018/2019 were analysed once the NCHS documentation arrived:

| File | What it is |
|---|---|
| `app/etl/namcs_layout.json` | Record positions for the fields used, transcribed from each year's documentation. |
| `app/etl/namcs_prepare.py` | Standard-library fixed-width reader: validates every field against its code frame and refuses a mismatch (it caught the zero-padded probable-diagnosis flag and the documented `ZZZ` non-diagnosis entries before any number was produced); writes `DIAGn_CONF` excluding probable/rule-out diagnoses; `--stack` pools years with weights divided by the number of years. |
| `phenotype_map_namcs_2015_2019.json`, `..._sinus.json` | ICD-9/ICD-10 prefix lists per concept; visits as the unit; adults 18+; the sinus map restricts the domain to sinusitis visits. |
| `masque_population_etl.R` 0.4.0 | `positivePrefixes` + `absentIsNegative`, `eligibility.concept`, `unitOfAnalysis`, `estimateName`, `minPositiveCases`, map-supplied caveats, `unweightedPositives` on every estimate. Re-running NHANES 2001–2002 and NHIS 2023 (40+) reproduces their committed estimates exactly. |
| `PopulationArtifact.jsx`, `MASQUE_Population.jsx` | Visit-unit warning on NAMCS artifacts; diagnosis codes listed instead of field names; concept eligibility shown; proportions under 1% shown to two decimals; summary column renamed "Rule: any of". |

Pooled NAMCS results, adult office visits, annual-average weights:

| Estimate | All | Women | Men |
|---|---|---|---|
| Headache diagnosis + dizziness, hearing loss or tinnitus diagnosis, share of visits | 0.09% (0.05–0.12), 65 positive visits | 0.11% | suppressed |
| Among sinusitis visits, share also diagnosed with headache or migraine | 3.6% (1.7–5.5), 54 of 960 visits | suppressed | suppressed |

## FAERS (28 September 2026)

| File | What it is |
|---|---|
| `app/etl/faers_prepare.py` | Standard-library reader. Preferred input is the openFDA JSON pages as downloaded (added 28 September after the originals arrived): 53,990 records in five pages, matching the query's own total, 53,952 unique reports received 2001–2012. The CSV route is kept; the earlier CSV export had lost 26 reports to a broken flattening (1,389 fragment lines), none of them phenotype-positive, so both estimates are unchanged on the complete set. |
| `phenotype_map_faers_sample.json`, `..._sinus.json` | Exact MedDRA preferred-term lists per concept; `unitOfAnalysis: "report"`; no design (weight 1, one stratum, each report its own PSU) declared through `design.varianceMethod`. |
| `masque_population_etl.R` 0.5.0 | `positiveTerms` + `delimiter` (exact list-element match), map-declared `varianceMethod`, `termMap` in the artifact, `report` unit. Existing artifacts reproduce exactly. |
| `PopulationArtifact.jsx`, `MASQUE_Population.jsx` | "Adverse-event reports, not people" warning and summary-row label; MedDRA terms listed; summary note names the three units. |

Results, share of reports in this sample (simple binomial intervals; not a prevalence):

| Estimate | All | Women | Men |
|---|---|---|---|
| Headache term + dizziness, hearing-loss or tinnitus term on one report | 0.73% (0.66–0.80), 394 of 53,952 reports | 0.91% | 0.53% |
| Among reports coding sinusitis, share also coding headache or migraine | 14.6% (9.7–19.4), 30 of 206 | suppressed | suppressed |

**Extraction lexicon on MedDRA terms (lexicon 0.3.1).** No narratives exist in the original openFDA JSON either (24 records carry the narrative field, each only a 'CASE EVENT DATE' stamp), so the proposal 7.2 benchmark cannot run on openFDA data, so the extractor was run on each mapped term as a one-line utterance. For the clinical lead; no lexicon phrase was changed:

| Concept | Captured | Notes |
|---|---|---|
| Headache/migraine | 4 of 9 as `m_head` | HEADACHE, TENSION, CLUSTER and SINUS HEADACHE captured. Plain MIGRAINE, COMPLICATED MIGRAINE and BASILAR MIGRAINE capture nothing; MIGRAINE WITH/WITHOUT AURA set `m_aura` yes/no correctly. |
| Dizziness/vestibular | 0 of 9 as `v_vertigo` | By design for DIZZINESS and VERTIGO: the item is a duration scale with no fallback, so a cue without a duration is left for the prompt to ask. VERTIGO POSITIONAL sets `v_head`. BALANCE DISORDER, vestibular and Meniere terms have no cue. |
| Hearing loss | 0 of 9 | No hearing-loss cue exists. **SUDDEN HEARING LOSS does not raise `rf_ssnhl`**, whose cues are conversational ("hearing dropped", "lost my hearing"). A clinical-register phrase is a safety-relevant gap. |
| Tinnitus | 1 of 1 as `v_aural` | |
| Sinusitis | no MASQUE item | Expected: sinusitis is not a scored item. |

## Verification

- ETL 0.2.0 was run here (R 4.3.3, survey 4.4) on `app/tests/fixtures/synthetic_nhis_like.csv` with `phenotype_map_synthetic.json`, producing `population-estimates.synthetic.json`. The fixture is invented: `source.dataset` is `SYNTHETIC`, the strata and PSU codes are fake, and the map's status text says so. It exists so the ETL and the renderer can be exercised without a public-use file and is never deployed.
- Against the shipped NHIS map the ETL now stops with the intended message (concepts still TODO) instead of an R error.
- The Population page was loaded in Chromium in all three states (no artifact listed; fixture listed; malformed artifact listed) with `data-masque-ready === "true"` and a clean console; the screener's Append no longer throws; the scribe's Skip leaves coverage unchanged.

## Version labels

`APP_VERSION` remains `0.3.0` in every app file, as it was in 0.3.1's source; the README and VERSIONS.md in `reference/` describe release 0.3.1. Reconciling that label is a decision for the next release, recorded in `01-inventory.md` §4, and is not changed here. The ETL carries its own `ETL_VERSION` (0.2.0) and the artifact reports it in `producedBy`.
