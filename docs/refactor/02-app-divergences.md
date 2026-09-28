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

## MEPS (28 September 2026)

| File | What it is |
|---|---|
| `app/etl/meps_prepare.py` | New. Reads one MEPS year's SAS V9 files with pyreadstat and writes one row per person: design variables, `AGELAST`, `SEX`, `TOTEXP`, condition codes joined in `CONDS`, and `COST_<concept>` for each map-listed cost concept (all-payer spending on distinct events linked to that concept; office-based, outpatient, emergency, inpatient, prescribed medicines). Writes a provenance file with each input's sha256 and the link counts. |
| `app/etl/meps_pool.py` | New. Stacks per-year CSVs, divides `PERWT` by the number of years, keeps the annual design, and optionally attaches HC-036 `STRA9624`/`PSU9624` by DUPERSID + PANEL; refuses pre-2018 years (PANEL comes from DUPERSID) and any record without exactly one HC-036 match. Standard library only. |
| `phenotype_map_meps_2019_2021.json`, `..._sinus.json` | The 2021 maps with pooled metadata and caveats; pooled totals renamed `sinus_care_spend_annual_total_*`. |
| `phenotype_map_meps_2019.json`, `_2020.json`, `_2021.json`, `..._sinus.json` | ICD-10-CM prefixes on `CONDS` (headache G43/G44/R51; dizziness R42/H81/H82; hearing H90/H91; H93 for tinnitus; sinusitis J01/J32), adults (`AGELAST` ≥ 18), `minUnweightedN` 100, `minPositiveCases` 30. The sinus maps add `costEstimates`. |
| `masque_population_etl.R` 0.6.0 | Prefix match inside a delimited list; records with zero or missing weight are dropped from every domain (MEPS gives out-of-scope persons weight 0); `_meta.minUnweightedN` (default 30, as before); map-declared `costEstimates` (mean or total, over the eligible domain or its phenotype-positive part), overall and by sex; a row whose interval cannot be computed is suppressed with `ci: [null, null]`. The eligibility caveat no longer ends in a doubled full stop. `_meta.suppressionStandard` names whose rule a suppressed row fell under: the MEPS maps say AHRQ, the FAERS maps say NCHS thresholds applied by analogy (FAERS has no standard of its own); unset keeps the NCHS wording. |
| `population_estimates.schema.json` | `ci` items may be `null` (only on a suppressed row). |
| `PopulationArtifact.jsx` | Labels for the MEPS quantities; totals of a million dollars or more print as "$923.4 million" or "$3.33 billion"; condition codes are called condition codes, not diagnosis codes, outside NAMCS. |
| `MASQUE_Population.jsx` | Suppressed summary cells name the standard from the row's own reason instead of always "NCHS standard". Summary-table sex cells now take the headline quantity's own subgroup rows (previously the first `sex=` row of any quantity, which was right only because every earlier artifact had one quantity); each row names its quantity; a note that the dollar figures are spending, not avoidable cost. |

All eleven earlier artifacts were regenerated with ETL 0.6.0 and their original download dates. Every estimate, interval, n and suppression flag is identical; the files gain `unitOfAnalysis` and `unweightedPositives` (written since 0.4.0) and lose the doubled full stop.

Results. Adults 18+; household-reported conditions; sex strata only (no gender item). Suppressed: RSE > 30%, n < 100, or fewer than 30 positive sample persons.

| Estimate | Year | All | Women | Men |
|---|---|---|---|---|
| Headache or migraine condition + dizziness, hearing-loss or H93 ear condition | 2019 | 0.19% (0.12–0.25), 42 of 21,306 | 0.27% | suppressed (11 positive) |
| | 2020 | 0.24% (0.17–0.32), 52 of 21,140 | 0.38% | suppressed (11 positive) |
| | 2021 | 0.26% (0.17–0.35), 55 of 21,986 | 0.44% | suppressed (10 positive) |
| Among adults reporting sinusitis, share also reporting headache or migraine | 2019 | 8.87% (6.47–11.26), 62 of 643 | 12.62% | suppressed (6 positive) |
| | 2020 | 9.56% (6.11–13.00), 46 of 462 | 11.69% | suppressed (7 positive) |
| | 2021 | 9.28% (6.23–12.33), 49 of 461 | 11.34% | suppressed (6 positive) |
| Sinusitis-care spending per adult with sinusitis, nominal $ | 2019 | $402 ($300–$505) | $463 | $300 |
| | 2020 | $505 ($293–$717) | $394 | suppressed (RSE 41%) |
| | 2021 | $850 ($382–$1,317) | $598 | suppressed (RSE 50%) |
| Sinusitis-care spending, national total | 2019 | $3.33 billion ($2.41–$4.25 billion) | $2.40 billion | $0.92 billion |
| | 2020 | $2.90 billion ($1.70–$4.10 billion) | $1.49 billion | suppressed (RSE 40%) |
| | 2021 | $5.05 billion ($2.23–$7.87 billion) | $2.52 billion | suppressed (RSE 51%) |
| Same spending, adults with sinusitis and headache or migraine | all three | suppressed (n = 62, 46, 49) | suppressed | suppressed |

The MEPS phenotype is far below the NHIS and NHANES figures because a MEPS condition record needs the respondent to name the condition as a reason for care, a disability day or a current problem; the interview surveys ask about each symptom directly. The vestibular arm rests on R42 alone (H81/H82 collapsed on the public file). This is a difference of measurement, not of population. The 2020 figures cover the first pandemic year, when MEPS fieldwork moved to telephone and care use fell.

Much of the 2021 spending rise is one person. One sample adult (four outpatient events of about $35,000 each, each linked to chronic sinusitis alone) carries 24% of the weighted 2021 total; without that person the mean is about $645. The largest single person carries 7% in 2019 and 16% in 2020. The 2021 artifact states this in a map caveat. Also, all but one of the 1,566 adult person-year records reporting sinusitis across the three years have sinusitis-linked care, so the sinusitis denominator is in practice adults with sinusitis-linked care.

**Pooled 2019–2021** (`meps_pool.py`, added when AHRQ's HC-036 file arrived). A correction first: earlier text here and in the README said pooling these years needed HC-036. The HC-036 documentation (sections C-1, C-2) says the opposite for years that are all 2019 or later: use the annual files' common VARSTR/VARPSU. The pooled artifacts do that, with weights divided by 3. HC-036 was used as a check: the file matched its codebook (483,346 records; 28,512 / 27,805 / 28,336 persons flagged for 2019 / 2020 / 2021, equal to the annual files), every pooled record matched one HC-036 row on DUPERSID + PANEL, and it regroups 2,638 records into other strata. Re-running both pooled maps on `STRA9624`/`PSU9624` gives standard errors within 0.5% of the annual design's on every row (ratios 0.995–1.003) and the same suppression decisions.

84,653 records, 46,263 distinct persons.

| Estimate, pooled 2019–2021 | All | Women | Men |
|---|---|---|---|
| Phenotype | 0.23% (0.18–0.28), 149 of 64,432 | 0.36% | 0.09% (0.05–0.13), 32 positive |
| Among adults reporting sinusitis, share also reporting headache or migraine | 9.19% (7.02–11.35), 157 of 1,566 | 11.94% | suppressed (19 positive) |
| Sinusitis-care spending per adult with sinusitis | $565 ($406–$724) | $486 | $719 ($303–$1,135) |
| Same, average annual national total | $3.76 billion ($2.67–$4.85 billion) | $2.14 billion | $1.62 billion |
| Spending per adult with sinusitis and headache or migraine | suppressed (RSE 35%) | $454 ($215–$692), n = 138 | suppressed |
| Same, average annual national total | suppressed | $0.24 billion | suppressed |

Pooling brings in three figures no single year could report: the phenotype for men, spending for men, and spending for women with both conditions. The men's spending rests largely on the 2021 case (25% of the men's total; $539 without it), and the artifact says so. Dollars are each year's nominal dollars averaged.

Not done: inflation adjustment, and home-health spending (file not supplied).

## Verification

- ETL 0.2.0 was run here (R 4.3.3, survey 4.4) on `app/tests/fixtures/synthetic_nhis_like.csv` with `phenotype_map_synthetic.json`, producing `population-estimates.synthetic.json`. The fixture is invented: `source.dataset` is `SYNTHETIC`, the strata and PSU codes are fake, and the map's status text says so. It exists so the ETL and the renderer can be exercised without a public-use file and is never deployed.
- Against the shipped NHIS map the ETL now stops with the intended message (concepts still TODO) instead of an R error.
- The Population page was loaded in Chromium in all three states (no artifact listed; fixture listed; malformed artifact listed) with `data-masque-ready === "true"` and a clean console; the screener's Append no longer throws; the scribe's Skip leaves coverage unchanged.

## Version labels

`APP_VERSION` remains `0.3.0` in every app file, as it was in 0.3.1's source; the README and VERSIONS.md in `reference/` describe release 0.3.1. Reconciling that label is a decision for the next release, recorded in `01-inventory.md` §4, and is not changed here. The ETL carries its own `ETL_VERSION` (0.6.0) and the artifact reports it in `producedBy`.
