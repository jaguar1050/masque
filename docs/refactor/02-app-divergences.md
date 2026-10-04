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

## screenAIr 0.4.0 (2 October 2026)

The four hard-wired MASQUE apps and the Simulator became **screenAIr**: one page
(`app/screenair.html`) with a module menu at the top and five tabs (Clinician Screener, Ambient
Scribe, Patient Companion, Research, Rubric Editor). The design is `03-design.md`; how to write a
module is `04-module-authoring.md`. MASQUE is now a module, **"Dizziness and Sinusitis (MASQUE
v1)"**: `app/modules/masque/masque.rubric.json` (data, extracted from the frozen source by
`app/tests/tools/extract-rubric.html`) and `masque.logic.js` (closures, moved verbatim). Both load
through the same path as an upload.

Instrument 0.2, lexicon 0.3.1, probe set 1.0.0 and gold set 0.2.0 are unchanged: no item, weight,
scale factor, cut-point, red flag, phrase, probe or patient-facing string was reworded,
renumbered or reweighted. Where two upstream copies diverged, the canonical copy named in
`01-inventory.md` §2 was taken, and each choice is a `reconciliation` entry in the rubric's
`changelog` (red flags take the Screener wording; item text from the Screener with the Scribe's
`ask`/`short`/`tag` and the Patient's clinician line kept as separate fields; Patient context
options not realigned; Simulator scenarios added as `sim-*` sample cases; `PROJECTS.MASQUE` moved
to `research`).

**Parity oracle.** `app/tests/baseline/src/` is a byte copy of the eleven `app/src` files as they
stood before the refactor (`MANIFEST.sha256`, source commit `5448d42`); `reference/fixed-src/`
stays the secondary oracle, and the `integrity` suite requires its diff to the baseline to equal
the hunks recorded in the first table of this file. The suites in `app/tests/suites/` compare the
new engine and apps with the baseline. The differences below are the only ones the harness
normalises; any other difference is a defect.

### Allowed differences from the baseline (design §8.4)

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD1 | Screener-surface bundle | `attainable-range.low = total`; note "bounded to {total}–{ceiling}" (Scr L1526, L1549) | `floor` in both | Inventory §7 risk 13: the attainable range starts at the floor, not the current total. |
| AD2 | Cohort rows (both apps), CSV header | no `module_id`; Scribe rows lack `subject_id`, `visit_label`, `gender` (Scb L497) | `module_id` after `app_version`; the Scribe uses the engine (Screener) row | One row builder for every module; rows say which module produced them. |
| AD3 | Data dictionary | no `module_id` or `complaint` entry; "MASQUE index at time of capture"; the Scribe download used a shorter list | `module_id` first, `complaint` before `coverage`; `{indexName} at time of capture` (identical text for MASQUE); one generator for both apps | One generator, generated from the module. |
| AD4 | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.0` | New release (design D21; lead question Q2). |
| AD5 | Scribe probe rail "re-asking {id}" (Scb L1169) | raw item id | the item's short label | Inventory §7 risk 13 (lead question Q17). |
| AD6 | Scribe red-flag wording (safety tab, capture tags, note, bundle Flag/ServiceRequest text, Scribe Questionnaire and dictionary downloads) | the Scribe's abbreviations (Scb L189-240) | the canonical Screener wording | Inventory §2 red flags; CLAUDE.md canonical-copy rule (lead question Q5). |
| AD7 | Screener meter zones | 33/33/34 (Scr L1216-1218) | 34/33/33, derived from the cut-points | Visual only; the meter is derived from the module (lead question Q19). |
| AD8 | Research-readiness panel | embedded under the Screener and Scribe; `band='low'` default; silent MASQUE fallback; `prototype-0.2` default `modelVersion`; brand score aliases for every project | in the Research tab, with a link card in its old place; `band=null`; no-screen, calibration (over every calibration-dependent figure) and routing-cleared gates; rows scoped by module and instrument version; unknown-project error card; aliases from the module; "Load demo cohort"; `module_id`/`scoring_hash` in the manifest and model card | Design D11. For MASQUE inputs every computed figure is identical (`research-parity`). |
| AD9 | Population page | its own page with brand row and footer | embedded in Research under the shell chrome; `population.html` redirects | Design D11. |
| AD10 | Patient Companion | unreviewed banner `noprint`; Spanish thin/not-sure ledes were English literals (Pat L1010-1012, L1058); `.txt` without the exact caveat line | banner printed; the existing `UI.es.thin`/`notSureLede` strings used; a final `Prototype · not for clinical use · YYYY-MM-DD` line (plus the patient provenance, edited-wording and stale-translation lines where they apply); a new self-contained `.html` download | Design D15; every export carries the caveat on its own face. |
| AD11 | Screener sample rail | 4 buttons | 9: the 4 unchanged plus the 5 Simulator scenarios (`sim-*`) | Design D23 (lead question Q3). |
| AD12 | Chrome around the apps | per-page `.masque-back` link and pill | shell header, module menu, caveat strip, tabs, footer, provenance badge, tab notes, patient-mode bar; `patient.html` without the `.masque-back` link | Design D10, D26. |

**No difference is permitted** in the Questionnaire and CDS output against the baseline
Screener, the Screener and Scribe routing copy, scoring, extraction, probes, patient summary
content, the Scribe note wording outside AD6, the cohort row outside AD2/AD4, or bundle text
outside AD1/AD6.

### Decisions settled during the build (design, "Orchestrator decisions")

| # | Decision |
|---|---|
| F1 | The t-ids rule (no module id, flag, phenotype value or brand in `src/engine`, `src/ui`, `src/apps`, `src/shell`) ignores import specifiers and the page-contract names (`masque-proto`, `masque-back`, `masque-status`, `masque-loader.js`, `data-masque-*`, `masqueReady`, `masqueTests`). |
| F2 | t-ids was waived for `src/shell/**` while the M1 shell mounted the legacy files; from M2 on it applies in full. |
| F3 | Three data files written on the user's machine keep their CRLF line endings (`data/provenance/nhanes-fetch-manifest.json`, `tests/fixtures/nhanes/nhanes_synthetic.csv`, `tests/fixtures/synthetic_nhis_like.csv`); the LF check exempts exactly these. |
| F4 | `validateModule({loaded})` takes bound modules, never registry entries; failed entries are not passed. |
| F5 | `RoutingState.answered` is the numeric count; the per-item predicate is `isAnswered(id)`. |
| F6 | Release `0.4.0` stays the default while Q2 is open; the version list that `index.html` carried now follows `policy.APP_VERSION` in the ⓘ drawer's About section. |
| F7 | The loader self-check files under `app/tests/loader-check/` are kept; the `.gitignore` additions are accepted. |
| F8 | A registry entry carries an optional `label` and `isDefault`; entry keys are `builtin:<rubric.id>` (fallback `builtin:<index>`). |
| F9 | `.pa-table` overflow at 375 px is fixed with a scroll wrapper (`.pa-scroll`) around each artifact in `MASQUE_Population.jsx`; `PopulationArtifact.jsx` itself is unchanged, and the shell keeps `.sa-panel{overflow-x:auto}`. |
| F10 | `referralGate` refuses a referral while any red flag is open on both surfaces, which agrees with the Scribe's own `routingCleared` on every reachable state. |

### New files

| Path (under `app/`) | What it is |
|---|---|
| `screenair.html` | The screenAIr page: the home screen (design D10, D27). |
| `modules/registry.json` | The built-in module list (rubric, logic and documentation paths per module). |
| `modules/masque/masque.rubric.json`, `masque.logic.js` | The MASQUE module (data layer; closure layer). |
| `modules/masque/SOURCES.md`, `README.md`, `CHANGELOG.md` | Field-by-field source map; the clinical rationale header comments of the seven retired and shared files, moved verbatim; the module change log. |
| `src/engine/*.js` (24 files) | The generic engine: contract, vocabulary, policy (release, caveats, limits), hashing, CSS scoping, downloads, PRNG, scoring, rules and gates, binding and validation, lineage, FHIR, cohort, extraction, probes, scribe, patient, derive, zip, export. Plain JS, no React, no module literals. |
| `src/ui/common.jsx` | Shared app UI (session store, provenance badge, tab notes). |
| `src/apps/{Screener,SampleRail,Scribe,PatientCompanion,ResearchTab,RubricEditor}.jsx` | The five generic tabs. |
| `src/shell/{ScreenAIr,ModuleWorkspace,PatientPage,ModulePicker,UploadDialog,chrome}.jsx`, `registry.js`, `shell.css.js` | The shell, the standalone patient page, the module menu and upload, module loading and saving. |
| `tests/baseline/**`, `tests/harness/**`, `tests/suites/**`, `tests/fixtures/modules/**`, `tests/fixtures/mutations/**`, `tests/dev/**`, `tests/tools/extract-rubric.*`, `tests/loader-check/**`, `tests/playwright/**` | Local-only parity harness, fixtures, dev pages, the rubric extractor and the cloud runner. Never deployed. |

Repository docs: `docs/refactor/03-design.md`, `docs/refactor/04-module-authoring.md`.

### Changed files

| Path (under `app/`) | Change |
|---|---|
| `assets/masque-loader.js` | `importSource` and `inspectSource` (compile or parse source text), parallel dependency builds, cycle detection, `boot` passes props to the root (`env = {loader, appBase}`). Existing `boot` and `importModule` behaviour unchanged. |
| `src/ResearchReadinessPanel.jsx` | Backward-compatible props for the Research tab (`research`, `moduleId`, `scoringHash`, the gates, row scope, `onDataChange`); `band` defaults to `null`; unknown project → error card; "Load demo cohort" (cohorts built by `engine/cohort.js makeCohort`). `PROJECTS.MASQUE` is still present (see below). |
| `src/MASQUE_Population.jsx` | Optional `baseUrl`, path and `embedded`/`banner` props whose defaults reproduce the old page; CSS scoped under `.sa-pop`; a scroll wrapper around each artifact (F9). |
| `patient.html` | Boots `src/shell/PatientPage.jsx`: the standalone at-home Patient Companion for the default built-in module (or `?module=<built-in id>`), with no tabs, module menu, upload, editor, research or link to the clinician program. It is not a redirect. |
| `index.html`, `screener.html`, `scribe.html`, `population.html`, `simulator.html` | Redirect pages (below). |
| `data/README.md` | Cohort rows are uploaded in the Research tab. |

### Redirects

Each redirect page keeps `noindex, nofollow`, uses `<meta http-equiv="refresh">` plus
`location.replace`, and shows a visible link and "Prototype · not for clinical use". The FTP host
and `python -m http.server` ignore `.htaccess`, so there are no server redirects.

| Page | Lands on |
|---|---|
| `index.html` | `screenair.html` (keeps any `#…` it was given). Its description, notice and version list are in the ⓘ drawer's About section. |
| `screener.html` | `screenair.html#tab=screener` |
| `scribe.html` | `screenair.html#tab=scribe` |
| `population.html` | `screenair.html#tab=research` (`app/etl/README_DATA_CONNECTION.md` names this page, so the pointer stays valid) |
| `simulator.html` | `screenair.html` (keeps any `#…` it was given) |

### Retired files

Deleted from `app/src/` by an explicit list (never a glob):
`MASQUE_Screener_v0_3.jsx`, `MASQUE_Scribe_v0_3.jsx`, `MASQUE_Patient_v0_3.jsx`,
`MASQUE_Simulator.jsx`, `MASQUE_Extraction.js`, `MASQUE_Probes.js`. Their content lives on in the
MASQUE module (data and closures), in the engine (generic code) and, byte for byte, in
`app/tests/baseline/src/` (the parity oracle), `reference/fixed-src/` and git history. The
Simulator's "What to notice" rails are not carried (Q4); its scenarios and demo cohorts are.

Kept at their paths: `MASQUE_Voice.js` (unchanged; the Scribe tab imports it),
`PopulationArtifact.jsx`, `MASQUE_Population.jsx`, `MASQUE_SchemaCheck.js` (also imported natively
by `tests/population-artifact-check.html`) and `ResearchReadinessPanel.jsx`.

**`PROJECTS.MASQUE` in the panel.** The design (§9.15) schedules removing it at retirement, now
that the Research tab passes the module's own `research` block. It is kept for now: the
`research` suite's backward-compatibility checks (§8.3) still mount the panel with
`project="MASQUE"` and no `research` prop, and removing the entry would turn those into the
unknown-project card. Its values are byte-identical to the baseline's and to `rubric.research`
(checked by the `values` suite). Removing it needs the compatibility case changed first; this is
recorded for the lead.

### Version label

The release is **0.4.0** (`engine/policy.js APP_VERSION`), which supersedes the 0.3.0/0.3.1 drift
recorded under "Version labels" above, pending the lead (Q2). The five axes are kept apart and
shown separately everywhere (footer, ⓘ drawer, export manifest, model card, cohort rows):

| Axis | Value | Owner |
|---|---|---|
| Release | 0.4.0 | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.1 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.2.0 | `masque.rubric.json` `lexicon.goldSet.version` |

"MASQUE v1" in the module label is display copy chosen by the user, not a version axis (Q1).
A locally edited instrument carries the `-local` pre-release tag (for example `0.2-local.3f9a1c`).

### Open questions: shipped defaults

Every question in design §10 ships with its stated default until the lead answers.

| Q | Default shipped |
|---|---|
| Q1 | Label "Dizziness and Sinusitis (MASQUE v1)" exactly as specified; display only; the footer shows the real axes. |
| Q2 | `APP_VERSION = "0.4.0"`. |
| Q3 | The five Simulator scenarios are sample buttons under "Scenarios", `why` as the tooltip. |
| Q4 | "What to notice" rails not carried. |
| Q5 | Scribe red flags use the Screener wording (AD6). |
| Q6 | The red-flag `ask` field is kept as unread data. |
| Q7 | "Instrument v0.3 candidates." kept verbatim in the Scribe note. |
| Q8 | Patient context options not realigned to the Screener bins. |
| Q9 | Patient strings that are English under es stay English (V33 warnings). |
| Q10 | `GENERIC_LOGIC` and `ENGINE_COPY_DEFAULTS` as specified. |
| Q11 | `instrumentHash` scope as specified; patient wording, lexicon, context labels and copy edits keep the instrument version. |
| Q12 | A verified derivation of MASQUE shows the root's population estimates under the "not recomputed" banner. |
| Q13 | Both bundle wordings kept verbatim per surface. |
| Q14 | Probe truncation 2. |
| Q15 | The microphone stops automatically when the Patient Companion or patient mode opens. |
| Q16 | New shell caveats English only, with `lang="en"`. |
| Q17 | The Scribe "re-asking" line shows the short label (AD5). |
| Q18 | Deployment path: the lead's decision (pages resolve module data against `appBase`, so either path works). |
| Q19 | Meter zones derived (AD7). |
| Q20 | `SITE.ALLOW_JS_UPLOAD = true`, behind the consent gate. |
| Q21 | The CDS "settled" example card is removed when an edit changes scoring. |
| Q22 | Any scoring change withholds the illustrative probability; no override. |
| Q23 | A link card replaces the embedded panel under the Screener and Scribe. |
| Q24 | `n_allo` has no Scribe short label (the id is shown). |
| Q25 | A one-line licensed-instrument reminder in the editor and the upload dialog. |
| Q26 | The panel's computed verdict is shown on the demo cohorts; the `why` text stays verbatim; mismatches go to the lead. |
| Q27 | No "copy Scribe answers into the Screener"; each clinician tab says it keeps its own answers. |
| Q28 | No transcript-only voice mode for a module without a lexicon. |
| Q29 | No name field on patient exports; they carry the generation date. |
| Q30 | Leaving patient mode takes a confirmation. |

### Verification at retirement

Run on the cloud runner (`app/tests/playwright/run.mjs`, default seed, full matrices) after the six
files were deleted: 20 of 21 test-page suites PASS, no INVALID, and all six Playwright steps PASS
(static-tree, pages, voice, print, upload, editor). The redirects were checked in Chromium: `app/`,
`index.html` and `simulator.html` land on `screenair.html` (Clinician Screener), `screener.html`
on the Clinician Screener, `scribe.html` on the Ambient Scribe and `population.html` on Research,
with `masqueReady`, a mounted workspace and a clean console; the ⓘ drawer's About section carries
the launcher's description, notice and the five axes; `patient.html` is healthy with no tabs, menu
or clinician link; `tests/population-artifact-check.html` validates a committed artifact and
refuses a malformed one. The `research` suite no longer compares the retired legacy Screener and
Scribe pages (it notes the skip); the edited panel's legacy-props behaviour is still compared.

The one failing suite, `omissions`, failed identically before the retirement: its "Hand to
patient" case clicks the button and waits for patient mode, while the shell now first asks
"Start a new patient session?" when the Patient Companion holds answers, so the wait times out
before the patient-mode checks run. It is a test/shell mismatch outside this change, recorded for
the integration triage; the refactor is not green until it passes.

## Audit fixes — research and data (4 October 2026)

Every committed estimate is unchanged: all 19 artifacts were regenerated from the same source
files (sha256 as recorded) with the edited ETL and compared field by field; no estimate, interval,
n, df or suppression flag moved. Only the artifacts whose content changed were replaced.

- **ETL 0.6.0 → 0.6.1** (`app/etl/masque_population_etl.R`). UTF-8: under a POSIX locale R wrote the
  map's "§" as the text `<U+00A7>` in the three NHANES definitions; the script now switches LC_CTYPE
  to UTF-8 or refuses to run, and writes UTF-8 bytes. A multi-item concept with one item missing and
  none positive is missing, not negative (only NHANES `dizziness_balance` has two items; no number
  changed). Optional per-concept `missingCodes` (default 7/8/9, so every map reads as before);
  `demographics.gender` takes `recode`/`missing` like sex. Cost rows: `unweightedN` counts
  non-missing cost (identical in every committed artifact), and cost rows over the whole eligible
  domain no longer carry `unweightedPositives`.
- **Artifacts replaced:** `nhanes-1999-2000`, `-2001-2002`, `-2003-2004` (definition now reads "§7.1";
  `producedBy` 0.6.1; `generatedAt`), and the four `meps-*-sinus` files (`unweightedPositives`
  dropped from the six eligible-domain cost rows each; `producedBy`; `generatedAt`). `downloadedAt`
  kept. The other twelve still say 0.6.0: regenerating them changes nothing but that label.
- **Schema:** `suppress` is now required on every estimate (all 19 artifacts and the test fixture
  carry it); `df` described correctly as PSUs minus strata.
- **Readiness panel.** An uploaded population artifact is checked with `checkArtifactMarker` +
  `checkSchema` against the gate's schema (`populationSchemaUrl`, passed by the Research tab) and
  refused with the failures listed; no schema, no rendering. Model card / manifest: an incomputable
  equity-mitigation gap is `null`, not `0`. Calibration-in-the-large and the slope are withheld below
  the reporting minimum (`minGroupN`, 30), as the function's own comment required. PPV and NPV show
  their denominators (flagged / unflagged rows). The avoidable share is Σw·avoidable / Σw·annual over
  rows carrying both costs, with that n shown (same value on the demo rows). These are intended
  changes from the baseline panel: `research` compares the five KPIs on their own and the rest of
  each tab exactly; the functions `research-parity` diffs are untouched.
- **F14 (allowed difference).** The Research tab passes `snap.floor`; the panel's attainable range,
  the lower bound of the probability range and `currentPatientOutput.attainableRange` /
  `probabilityRange` run floor–ceiling (they used the point total as the floor). A host that passes no
  floor gets the old behaviour. `research-parity` adds an "unscorable-floor" screen and normalises
  exactly `attainableRange[0]` and `probabilityRange[0]`; it also normalises the M2 `null`-for-`0`.
- **PopulationArtifact.** A row is printed only with `suppress === false` and a finite estimate and
  interval; list fields are Array-guarded; the renderer sits in an error boundary (reported in place,
  host stays up). `money()` picks the unit after rounding: $1.00 billion, never "$1000.0 million".
  The Population page's summary table uses the same suppression rule.
- **Research tab.** The section switch is a full tablist: arrow keys / Home / End, roving tabindex,
  `aria-controls` to `role="tabpanel"` sections (always present; content still mounts on first visit).
- **Docs and index text.** The index note no longer says cycles are never pooled (NAMCS 2015–2019 and
  MEPS 2019–2021 are); the NAMCS single-year counts are now adult visits (28, 26, 5, 6; sinusitis
  overlap 26, 10, 8, 10 — summing to the pooled 65 and 54), recounted with the ETL, where the old
  all-ages counts had two years at or above 30. `app/data/README.md` no longer says the folder is
  empty and notes that the NHANES fetch manifest was written on the lead's machine and that the
  provenance `directory` field is a scratch path (the provenance files are not edited).
  `README_DATA_CONNECTION.md` gives the suppression rule per map, the full eligibility and
  missing-code fields, and the Research tab in place of `population.html` (now a redirect).
