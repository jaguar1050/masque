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
| Q9 | Patient strings that are English under es stay English (V33 warnings). **Answered in release 0.4.2** (user request of 6 October 2026): translated, unreviewed; see "screenAIr 0.4.2". |
| Q10 | `GENERIC_LOGIC` and `ENGINE_COPY_DEFAULTS` as specified. |
| Q11 | `instrumentHash` scope as specified; patient wording, lexicon, context labels and copy edits keep the instrument version. |
| Q12 | A verified derivation of MASQUE shows the root's population estimates under the "not recomputed" banner. |
| Q13 | Both bundle wordings kept verbatim per surface. |
| Q14 | Probe truncation 2. |
| Q15 | The microphone stops automatically when the Patient Companion or patient mode opens. |
| Q16 | New shell caveats English only, with `lang="en"`. **Partly answered in release 0.4.2:** the patient-facing ones have unreviewed Spanish; see "screenAIr 0.4.2". |
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

## screenAIr 0.4.1 (4 October 2026)

The Ambient Scribe capture fixes. The clinical lead reported that "I'm feeling really dizzy" followed
by "as if the world is moving around me and I'm sitting still" captured nothing, and that a
dizziness duration also scored the headache-attack duration. The build specification is
`05-scribe-capture-fixes.md`; its §11 records the clinical-lead approval of 4 October 2026, which
supersedes its Appendix A. The design decisions are S1-S7 in `03-design.md` ("Decisions for
release 0.4.1").

- **F1 heard.** A cue heard without its value is shown on the transcript bubble (a dashed tag) and
  as a Heard card in Ask next, after the Safety probes and before the Re-ask probes. It never
  scores and never writes an answer: absent stays absent.
- **F2 carry-over.** For an entry that opts in, the next patient replies (MASQUE `v_vertigo`: two)
  may supply the value. The reply is refused when it names anything else the lexicon knows,
  contains the item's own cue, is a question, contains a `carryRefuse` phrase, or its value is
  negated, ambiguous, attributed to someone else or historical. A carried value is tagged
  "follow-up to “…”" on the bubble that supplied it.
- **F3 vocabulary.** The approved phrases are appended to the end of their lists (never inserted,
  reordered or reworded), with gold cases for each.
- **F4 yield.** `m_dur` yields to `v_vertigo` unless an approved anchor phrase is present and not
  negated, so a dizziness-duration sentence no longer scores the headache-attack duration.
- **Normalisation.** Typographic apostrophes are folded before matching (`lexicon.normalize`), so
  "I don’t feel unsteady" typed on iOS reads as a denial. Small numbers are spelled as words **for
  band phrase matching only** ("digits for durations only", round 2), so "it lasts 2 minutes"
  matches like "it lasts two minutes" while "dizzy for 10 days" does not meet the cue "ten days".

**Round 2 (same release, same date).** An adversarial review of the first implementation upheld 22
findings. The fixes and three clinical-lead decisions are specified in
`05-scribe-capture-fixes.md` §12 and recorded as decision S8 in `03-design.md`:
- carry negation is clause-wide;
- for `heard` entries, direct extraction takes a band value only when exactly one distinct value
  is live, and an onset phrase (`carryRefuse`) suppresses it;
- the new optional `carryExclude` keeps the `v_vertigo` day ranges from being carried (lead
  decision);
- number spelling is bands-only (lead decision), and every gate window runs on the folded text;
- the yield survives answering or skipping the heard card;
- the `lockViolations` deletion exemption is narrowed;
- AD13 rule T is narrowed;
- the records are corrected: `carryRefuse` is confirmed by the clinical lead (lead decision), the
  gold set 0.3.0 case text is not reviewed by the clinical lead, and generic strings say "approved
  lexicon configuration";
- the known risks are listed in the module CHANGELOG.

The version axes are unchanged.

**Round 3 (same release, 5 October 2026).** A verification of round 2 upheld 23 findings: round 2
could record false scored values that round 1 did not. Round 3 is specified in
`05-scribe-capture-fixes.md` §13 and recorded as decision S9 in `03-design.md`. Its principle:
every round-2 rule may withhold a value, never cause a different value, and withholding never
opens a path for a later wrong value.
- for `heard` entries, direct extraction takes no value when any band span is negated, a
  `carryRefuse` phrase occurs, or the spans disagree; when a span was present, no carry-over opens
  from that utterance, so the clinician asks;
- in a carried reply, any negated span refuses the whole reply, and the `carryExclude` phrases are
  collected again: they never supply the value but can make the reply negated or ambiguous ("For
  two days at a time." is refused);
- `carryExclude` phrases count in direct extraction only in the cue's own sentence (lead decision
  L1, now implemented at sentence scope, not line scope; corrected in round 3c, below);
- the records are true again: `carryRefuse` can only prevent a capture, never cause one; the editor
  label, contract notes, the V28 warning (only when no scale entry has `heard: true` or `carry`)
  and the known risks are updated;
- `derive.js` closes two pre-existing lock gaps (`/lexicon/multi` exemption for item deletions
  only; numeric sort in `deleteItem`);
- the tests close T1-T11.

The version axes and the lexicon content are unchanged.

**Round 3b (same release, same date).** Round 3 had a defect. A withheld duration armed no reply
window, and it closed an open window of the item. Either way `m_dur`'s yield was lost, so
"It hit me in a split second and the spinning lasted for hours" · "it lasts a couple of hours"
scored the headache-attack duration (Under 4 h), which round 2 had prevented. Round 3b
(`05-scribe-capture-fixes.md` §13.10, decision S10 in `03-design.md`) adds the **yield-only
slot**:
- a withheld duration opens a reply window that keeps the yield but never carries;
- an open window of the item turns yield-only, keeping its remaining replies, instead of closing;
- a later cue with no duration re-arms a normal window.

Against round 3 it records no new value; it can only suppress `m_dur`. The rubric change-log note
is not reworded. The version axes and the lexicon content are unchanged.

**Round 3c (same release, same date).** The final pre-deploy review found two remaining paths to a
value round 2 did not record (`05-scribe-capture-fixes.md` §13.11, decision S11 in
`03-design.md`):
- R11 is made removal-only. A `carryExclude` phrase supplies a value in direct extraction only in
  a cue sentence: any sentence holding a cue hit that is not negated, attributed or historical.
  Elsewhere it still counts for the negation and disagreement tests and as a stated band, so the
  value is withheld and only a yield-only window opens. Round 3 ignored it there, which let
  "I get these dizzy spells. They last for two days at a time." read Over 72 h and let carry-over
  open after a day range;
- a yield-only window is renewed to the full carry on each withheld line, so `m_dur` keeps
  yielding where round 2 suppressed it (gold d089).

The rubric change-log note is reworded (the day-range sentence, the renewed window, the gold set
totals). The version axes and the lexicon content are unchanged.

Instrument 0.2 and probe set 1.0.0 are unchanged: no item, weight, scale factor, cut-point, red
flag, probe or patient-facing string changed, so `instrumentHash` and `scoringHash` are unchanged
and the illustrative calibration still applies. The note, FHIR bundle, cohort rows and Patient
Companion read answers only, so heard data cannot reach them.

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.1` (was `0.4.0`) | Release 0.4.1 (design S1). `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move in one commit. |
| AD13 (new) | MASQUE lexicon: `values` `/lexicon` and `/module/versions`; `extraction` block 2 `/extract032/…` | lexicon 0.3.1 | lexicon 0.3.2 = 0.3.1 plus exactly the clinical-lead-approved delta in `app/tests/harness/lexicon-delta.js` | Clinical-lead approval of 4 October 2026 (design S2-S4). The normaliser accepts a lexicon difference only when `revertLexiconDelta` reproduces 0.3.1 exactly, and an extraction difference only when the delta explains it. For `normalize` (rule T, narrowed in round 2), apostrophe folding excuses differences only in texts holding a typographic apostrophe. Number spelling excuses only scale-entry captures, only in texts holding a token the engine spells (standalone 0-20 or a round ten, by the engine's exact token rule). Red flags and non-scale captures stay strictly compared. Detector: any raw difference. |

The other allowed differences (AD1-AD3, AD5-AD12) are unchanged. **No difference is permitted** in
extraction outside AD13; the rest of the 0.4.0 list stands.

**Parity subject change.** The `extraction` block 1 and `render-scribe` parity comparisons now run
on the 0.3.1-equivalent lexicon, `revertLexiconDelta(module.lexicon, LEXICON_DELTA)`, and so still
prove "generic engine + 0.3.1 data == baseline" with no new normalisation. This is not a widening:
the `values` suite proves the revert exact (AD13), and the 0.3.2 behaviour is proven separately by
AD13 (no collateral change), the gold set 0.3.0 and the new `capture` suite, and the
`render-scribe` behaviour blocks. `tests/harness/divergences.js`, `tests/baseline/**` and
`reference/**` are untouched, so `MANIFEST_SHA256`, the fixed-src pins and the hunk list stand.

### Lexicon delta 0.3.1 → 0.3.2

Every phrase below is appended at the end of its list in this order (approval record:
`05-scribe-capture-fixes.md` §11.3).

| Path (relative to the lexicon) | Change |
|---|---|
| `/version` | `0.3.1` → `0.3.2` |
| `/scale/1/cue` (`v_vertigo`) | 21 symptom cues appended |
| `/scale/1/bands/0/ph` (`v_vertigo` v = 1, under 5 min) | 8 phrases appended |
| `/scale/1/bands/2/ph` (`v_vertigo` v = 2, 5 min – 72 h) | 9 phrases appended |
| `/scale/1/bands/1/ph` (`v_vertigo` v = 3, over 72 h) | 3 phrases appended |
| `/bool/<i>/ph` for `v_head`, `v_motion`, `v_aural`, `v_migfeat` | 11, 6, 3 and 2 phrases appended |
| `/negation/cues` | `fewer than` appended (lead decision; extends 05 §6.2) |
| `/thirdParty/cues` | 5 phrases appended (lead decision; extends 05 §6.2) |
| `/scale/1/heard`, `/scale/1/carry` | `true`, `2` (F1, F2) |
| `/scale/1/carryExclude` (round 2) | `["about a day", "overnight", "for a day or two", "for a couple of days", "for two days", "for three days"]` (clinical-lead decision of 4 October 2026: day ranges are same-sentence only) |
| `/scale/2/yieldTo`, `/scale/2/anchor` (`m_dur`) | `["v_vertigo"]`; 8 anchors (F4) |
| `/carryRefuse` | `["ago", "since", "started", "began"]`: a carry-over guard proposed by the team and confirmed by the clinical lead on 2026-10-04. From round 2 it is also the onset guard of direct extraction for `heard` entries. |
| `/normalize` | `{"apostrophes": true, "numbers": "en"}` (from round 2, `numbers` applies to band phrase matching only) |
| `/goldSet` | `{version 0.2.0, lexiconVersion 0.3.1, file masque_extraction_goldset.json}` → `{version 0.3.0, lexiconVersion 0.3.2, file masque_extraction_goldset_0.3.0.json}` |

Drafts struck by the lead's reviewer process are listed, each with its reason, in
`app/modules/masque/CHANGELOG.md` ("Drafts considered and struck") and in §11.7 of the
specification.

### New files

| Path | What it is |
|---|---|
| `app/tests/harness/lexicon-delta.js` | The approved delta as plain data (`LEXICON_DELTA`); local-only. |
| `app/tests/suites/capture.js` | Heard, carry-over, yield and normalisation rules; gold set 0.3.0 and dialogues; Scribe engine helpers; local-only. |
| `app/tests/fixtures/goldset/masque_extraction_goldset_0.3.0.json` | Gold set 0.3.0 (lexicon 0.3.2): the 44 reference cases by SHA-pinned reference plus the added cases and dialogues; local-only, never deployed. The added case text was drafted by the team and has not been reviewed by the clinical lead. Its 0.3.0 labels are the 0.3.2 extractor's own output: a regression snapshot, not a measurement. |
| `docs/refactor/05-scribe-capture-fixes.md` | The specification and approval record. |
| `docs/refactor/design-candidates/05-candidate-minimal.md`, `05-candidate-robust.md` | The two merged candidates, moved here from `docs/refactor/` unchanged, kept for rationale. |

### Changed files

| Path (under `app/`) | Change |
|---|---|
| `src/engine/extraction.js` | `extract` options `includeHeard` and `pendingIds`; heard captures; the yield step; normalisation; `extractInContext`; `EXTRACTOR_FEATURES`. Round 2: clause-wide carry negation; `carryExclude`; band choice and the onset guard for `heard` entries; number spelling for bands only; the `{carry: false}` option. Round 3: removal-only band choice for `heard` entries (any negated span, onset phrase or disagreement withholds the value, and a withheld value with a span present opens no carry-over); `carryExclude` sentence scope in direct extraction; carry collects excluded phrases for the negation and ambiguity refusals and refuses the whole reply on any negated span. Round 3b: yield-only slots (`PendingCue.yieldOnly`): a withheld value arms a slot that keeps the yield but never carries, and an open slot of the item turns yield-only instead of closing. |
| `src/engine/scribe.js`, `src/engine/vocab.js` | `CAPTURE_KIND.HEARD`; `heardLabel`; `captureLabel` heard and carry branches; `heardPrompts`; `askNextSections`; `rankSuggestions` `exclude`. |
| `src/engine/contract.js`, `validate.js`, `derive.js` | `LEXICON_CARRY_MAX`, `LEXICON_SCALE_KEYS`; the new V28 rules; locks for the new fields; yield-aware item deletion. Round 2: the `carryExclude` key and its V28 rules; the V29 number warning limited to band phrases; the `lockViolations` deletion exemption narrowed (entries matched by id; flag deletions exempt nothing under `/lexicon/scale`); lock reasons say "approved lexicon configuration". Round 3: `contract.js` notes for `heard` and `carryRefuse`; the V28 `carryRefuse` warning only when no scale entry has `heard: true` or `carry`; the `/lexicon/multi` exemption for item deletions only; `deleteItem` sorts dependent paths by numeric index. |
| `src/engine/policy.js` | `APP_VERSION` `0.4.1` (that line only; `SITE.ALLOW_JS_UPLOAD` untouched). |
| `src/apps/Scribe.jsx`, `src/apps/RubricEditor.jsx` | The heard tag, Heard group and carry tag; the read-only lexicon rows. Round 2: once the pending item is answered or skipped, the Scribe still passes the slot, with `{carry: false}`, so the yield survives; the read-only rows say "approved lexicon configuration". Round 3: the `carryRefuse` label names both roles. |
| `modules/masque/masque.rubric.json` | Regenerated with lexicon 0.3.2 (never hand-edited). |
| `modules/masque/CHANGELOG.md`, `SOURCES.md`, `README.md` | Version axes, the dated 0.3.2 entry, struck drafts, the benchmark block, the new hand-written values. Round 2: a "Known risks" subsection with one example each; benchmark wording "regression snapshot; P/R/F1 is tautological, not a measurement"; `carryRefuse` confirmed by the clinical lead; gold 0.3.0 case text not reviewed by the clinical lead. Round 3: true `carryRefuse` wording; known risks for compound tens, another symptom's duration, unrelated negation in a carried reply and the round-3 recall costs. Round 3b: a "Round 3b" entry (yield-only slot, why, examples); known-risk rows for a refused carried reply that keeps the rest of the window and for the yield lasting only as long as the window; the R11 row says round 1 gave the same value; a note that the quoted change-log note's "closes an open one" now means "no reply is carried into it". |
| `tests/harness/diff.js`, `tests/suites/*`, `tests/fixtures/mutations/safety.js`, `tests/harness/foundations.js`, `tests/harness/runner.js`, `tests/tools/extract-rubric.js`, `tests/playwright/specs/{voice,editor}.mjs` | AD4/AD13 and the delta helpers; the suite changes of design §8.3; manual checklist (g). |

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.1** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | **0.3.2** | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | **0.3.0** (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

**Saved derivations (accepted risk, Q11).** A MASQUE derivation remembered in the browser or
downloaded on 0.4.0 records the 0.3.1 root (`lexiconVersion`, `lexiconHash`, `rubricSha256`), so
it no longer verifies against the 0.3.2 built-in: lineage classification returns row 4 with the
misleading reason that the file "was changed after it was created in screenAIr". Re-derive edits
made before 0.4.1. The lead accepted this rather than add a lineage "root updated" state; it is
announced in the module CHANGELOG and README.

### Verification

All 22 suites passed on the round-1 commit (26464c5). The review then showed that this did not
rule out wrong scored values.

**Round 2 (3700a14): green and pinned.** The lead's browser run of 2026-10-05 passed all 22 suites
and pinned `GOLD_0_3_0_SHA256` (`6e084ae3…`) and `EXPECTED_BENCHMARK` in
`app/tests/suites/capture.js`; the module CHANGELOG records the run. A verification of that commit
then upheld 23 findings, so passing again did not rule out wrong scored values.

**Rounds 3 and 3b: to be re-pinned.** Round 3 changes the engine and the gold set 0.3.0, so it sets
both pins back to `"PIN_AFTER_RUN"`; round 3b changes the engine again and keeps them there. Until
the lead re-runs the test page, re-pins and regenerates the rubric, the `capture` suite reports
INVALID with the computed values in its notes, and neither round is green. All 22 suites must pass again, and `extract-rubric.html` must report "identical" against
the committed rubric. No cloud Playwright run is recorded here.

## screenAIr 0.4.2 (6 October 2026)

The Spanish Patient Companion completed, at the user's request of 6 October 2026 ("Fix the Spanish
patient companion to make sure it is completely translated"). The design decisions are ES1-ES10 in
`03-design.md` ("Decisions for release 0.4.2"). The Spanish (82 strings) was produced by AI agents:
two independent drafts, merged, then a clinical, a language and a mechanical review, also by AI
agents. It was not produced or checked by a qualified human medical translator or by a bilingual
clinician, so `locales.es.reviewed` stays `false` and the "Traducción sin revisar" banner stays.
The row-by-row record, with each string's basis and the items awaiting the bilingual clinical
reviewer, is `app/modules/masque/SOURCES.md` ("Spanish translation delta (unreviewed)").

- **Module data.** 36 rows (48 leaves) added to the MASQUE rubric's `locales.es` by the new
  `app/tests/harness/locale-delta.js`: the context questions with their option labels (values
  unchanged), the story heading, lede and intro, the "Es para usted si" bullets, the clinician
  paragraph, and a Spanish clinician line (`clin`, a new optional locale key) for each of the 30
  items. No existing Spanish string changed.
- **Engine chrome.** The 17 `PATIENT_CHROME.es` keys that fell back to English.
- **Spanish clinician lines.** Under `es` the "Para mi médico" block reads the Spanish `clin` line
  with the Spanish option label; English keeps `patientClin`.
- **Grammar.** Spanish yes/no ask forms open with "¿" (18 items); the Spanish list joiner uses "e"
  before an /i/ sound.
- **Spanish caveats and marker.** The patient caveats, the engine cards and the patient footer line
  have Spanish. The English marker "Prototype · not for clinical use" stays on every surface; a
  Spanish patient surface adds " — Prototipo · no apto para uso clínico" after it.
- **Language tagging.** `<html lang>` follows the companion locale on `patient.html` and in patient
  mode; the print header, context buttons, progress line, step headings and clinician lines carry
  their own `lang`.
- **Patient mode.** The return button, the return dialog and the microphone toast keep their
  English and add a Spanish line while the companion is in Spanish.
- **Round 3 (rendered-Spanish review, same day).** Five Spanish values revised (`carryOn`,
  `summaryLede`, `footer`, and the two `CAVEATS.patient.*.esShort` markers, which now name
  "cuestionario"); lower-casing the "Es para usted si" bullets declined (kept parallel with the
  English source). Engine: a question whose Spanish `q` falls back to English takes the English
  question form (no "¿") and is tagged `lang="en"`; on the clinician's Patient tab the caveat strip
  keeps its English provenance lines and adds the Spanish ones after them (patient mode and
  `patient.html` show only the Spanish); the patient panel has no `aria-labelledby` in patient mode;
  V38 matches accent- and case-insensitively; AD14 requires the comparison's own `ctx.loc`. The
  rubric is unchanged by round 3. Record: `app/modules/masque/SOURCES.md` ("Revised after the
  rendered-Spanish review, round 3").
- **The static corner badge stays English (decision).** `.masque-proto` in `app/patient.html` and
  `app/screenair.html` stays the English marker only, tagged `lang="en"`: it is static pre-locale
  HTML and the required English marker, and the React caveat strip just below it already shows the
  marker with its Spanish line on a Spanish surface. No code change.

English output is unchanged (byte-identical in the comparisons the code package ran: `summaryText`
and `summaryHtml` against the abf659f engine over 400 random states each, and the `patient`
outputs against the baseline oracle over 3,000 English states).

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.2` (was `0.4.0`, then `0.4.1`) | Release 0.4.2 (design ES10). `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move together. |
| AD14 (new) | Spanish patient output: `render-patient` es parity (rendered text), `golden` es `summaryText`, `patient` (es `askForm`, `joinList`, the summary's `clin` entries, `summaryText`). The es `.html` is not compared with the baseline: `render-patient` checks the saved file against the engine's `summaryHtml` and `omissions` checks its language tags | es falls back to English for 11 rubric leaves and 17 chrome keys; es ask forms end in "?" with no "¿"; "y" before every final list element; English clinician lines; the English marker alone | the Spanish completion of release 0.4.2 | Design ES1, ES5-ES8. The normaliser excuses only: the English → Spanish pairs of `LOCALE_DELTA.added` and `LOCALE_DELTA.chrome` (longest first, and only when the result equals the new side); "¿" before the boolean ask forms; "y" → "e" in `SUM.es` list joins; `patientClin [opt]` → es `clin [es opt]`; the companion marker. Each has an `h.expect("AD14")` where it must occur. Never applies to `en`: every suite passes the comparison's own locale as `ctx.loc`, and AD14 applies only where `ctx.loc` equals its parameter object's locale (`es`), so an English or loc-less comparison is never excused whatever parameters it carries. Its self-checks (crafted pairs it must and must not excuse, each excusable pair re-run in English mode and with no `ctx.loc`, the `appliesTo` contexts, plus the `ad14Params` refusals): `selfCheckPairs` and the loop after it in `app/tests/suites/patient.js`. Detector: the baseline text holds a pair's English, a clinician line's English, an unopened question or " y " before an /i/ word; the suites account for it rule by rule with `ad14Tally` (`app/tests/harness/spanish.js`). |

The other allowed differences (AD1-AD3, AD5-AD13) are unchanged. **No difference is permitted** in
English patient output, or in Spanish patient output outside AD14; the rest of the 0.4.1 list
stands. `tests/harness/divergences.js`, `tests/baseline/**` and `reference/**` are untouched.

### Open questions answered or narrowed

| Q | 0.4.0 default | Release 0.4.2 |
|---|---|---|
| Q9 | Patient strings that are English under es stay English (V33 warnings). | **Answered: translated now** (user request of 6 October 2026), as an unreviewed team translation; `reviewed: false` stays until a bilingual clinical reviewer signs off. V33 for the built-in MASQUE `es`: 0. |
| Q16 | New shell caveats English only, with `lang="en"`. | **Partly answered.** The patient-facing caveats (uploaded, edited, patient provenance, edited wording, stale translation), the patient-mode controls and the microphone toast have unreviewed Spanish next to or in place of the English as described above; the clinician-facing caveats stay English. |
| Q2 | Release `0.4.0` (then 0.4.1, S1). | Release `0.4.2` (ES10); deployment remains the lead's decision. |

### New files

| Path | What it is |
|---|---|
| `app/tests/harness/locale-delta.js` | The Spanish completion as plain data (`LOCALE_DELTA`: provenance, 36 `added` rows, 17 `chrome` rows, the change-log entry); local-only, never deployed. |
| `app/tests/harness/spanish.js` | The shared Spanish checks of the `patient`, `golden`, `render-patient` and `omissions` suites: `ad14Context` (AD14's parameters), `ad14Tally` (per-rule `h.expect`), `englishCorpus` / `englishScan` (the es DOM scan); local-only, never deployed. |

### Changed files

| Path (under `app/`) | Change |
|---|---|
| `patient.html`, `screenair.html` | Deployed pages: the static corner badge (`.masque-proto`) and the noscript paragraph carry `lang="en"`. |
| `src/engine/patient.js` | The 17 `PATIENT_CHROME.es` keys (round 3: `carryOn`, `summaryLede`, `footer` revised); `GRAMMAR.es.openQuestion` and `andBeforeI` (the "hia/hie/hio/hiu" limitation documented); `askFormLang`, and the English question form for a `q` that falls back to English; `clin` in `ITEM_WORDING_KEYS` and in `buildPatientSummary` (per-line `lang`); locale-aware caveats and markers (`patientProvenanceFor`, `patientNotices`, `prototypeMarker`, `prototypeMarkerText`); `patientPrintHeader` and `patientPrintHeaderParts` (moved here from `PatientCompanion.jsx`, re-exported there); `summaryText`/`summaryHtml` Spanish caveats, marker and tagging. |
| `src/engine/policy.js` | `APP_VERSION` `0.4.2` (that line and its comment; `SITE.ALLOW_JS_UPLOAD` untouched); Spanish patient caveats (round 3: the two `esShort` markers name "cuestionario"); `CAVEATS.prototypeCompanion`. |
| `src/engine/contract.js`, `validate.js`, `derive.js`, `lineage.js` | The `clin` key (typedef; V32; editable and stale against `patientClin`); the `lexicon` and `translation` change-log kinds; V38 Spanish caveats, matched accent- and case-insensitively (NFD, combining marks removed, lower case); `provenanceLineParts` with a patient locale and an optional `textLocale` (the English lines for that locale). |
| `src/apps/PatientCompanion.jsx`, `src/apps/RubricEditor.jsx` | Per-line `lang` on clinician lines; option-button `lang`; fallback-title `lang`; `lang="en"` on a "not sure" question that falls back to English; `{en, es}` engine cards; the optional "Clinician line (patient summary)" editor field. |
| `src/shell/chrome.jsx`, `PatientPage.jsx`, `ScreenAIr.jsx`, `ModuleWorkspace.jsx`, `shell.css.js` | `useDocumentLang`, `LangParts`, `PATIENT_FOOTER_TEXT`; the patient page title and `lang`; `PATIENT_MODE_TEXT.es` and the bilingual patient-mode controls; the clinician Patient tab's caveat strip (English lines, then the locale's); the patient panel label in patient mode, without `aria-labelledby`; the `.sa-locale-pair` style. |
| `modules/masque/masque.rubric.json` | Regenerated (never hand-edited): `locales.es` gains the delta rows and the change log gains the `translation` entry; `en`, the instrument, scoring and lexicon hashes, and the calibration are unchanged. |
| `modules/masque/SOURCES.md`, `CHANGELOG.md`, `README.md` | The Spanish delta section and field-map rows; the dated 2026-10-06 entry; the Spanish paragraph. |
| `tests/harness/diff.js`, `tests/tools/extract-rubric.js`, and the suites (`values`, `golden`, `patient`, `render-patient`, `omissions`, `validate`, `editor`, `static`) | `NEW_RELEASE`, AD4 text, `applyLocaleDelta`/`revertLocaleDelta`, AD14 (requires the comparison's `ctx.loc`); six new extractor checks and four `src()` rows; the suite changes of design §8.3 (made by the test package and the fixers). Local-only. |
| `tests/fixtures/mutations/index.js`, `locales.js`, `provenance.js` | `ctx.CAVEATS` for the generators; V32, V38 (Spanish caveats, one typed without its accents) and V60 generators for `clin` and the Spanish caveats. Local-only. |
| `tests/dev/{editor,patient,research,screener,scribe}.html` | The corner badge and noscript paragraph tagged `lang="en"`, as on the deployed pages. Local-only. |
| `tests/playwright/specs/pages.mjs`, `print.mjs` | The Spanish-mode text and `lang` pins of D9/D10 (not run: no Node here). Local-only. |

**Deploy list for 0.4.2** (the lead deploys): `app/patient.html`, `app/screenair.html`, the
changed `app/src/**` files above and `app/modules/masque/{masque.rubric.json, SOURCES.md,
CHANGELOG.md, README.md}`. Everything under `app/tests/` (including the two new harness files, the
dev pages, the mutation fixtures and the Playwright specs) is local-only and never deployed.

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.2** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

**Saved derivations.** Derivations made under 0.4.1 still verify against the 0.4.2 built-in:
lineage compares the instrument, scoring and lexicon hashes and `logicSha256`, which do not move.
Module information adds the reason that the built-in's rubric bytes changed. A 0.4.1 download-all
zip that contains the built-in MASQUE rubric no longer matches it byte for byte, so that rubric is
offered as "Load as derived"; derived entries in such a zip still verify.

### Verification

**Final run, after round 3 (2026-10-06)**, on the uncommitted 0.4.2 tree (branch
`claude/patient-spanish` from abf659f): `app/tests/index.html?seed=1296126801`, full run (not
quick), **22/22 PASS** in 45.5 s, with no diff and no missing expected difference in any suite.
Checks per suite: `integrity` 78, `values` 2,723, `golden` 411, `sweep` 104,273, `rules` 221,619,
`patient` 303,563, `extraction` 167,936, `capture` 253,957, `probes` 100,049, `cohort-gen` 10,
`validate` 316 (MASQUE: 0 errors, V12 ×1, V33 ×0), `shape` 77,607, `render-screener` 1,191,
`render-scribe` 245, `render-patient` 8,964, `omissions` 20,477, `research` 160,
`research-parity` 436, `editor` 196, `roundtrip` 172, `upload` 87, `static` 1,006. The console
showed only the two deliberate import-cycle errors of the loader check. `extract-rubric.html`
reports "Identical" to the committed rubric: SHA-256
`6f426f60ae8ab8355e40bf589d2d2930f5a795dab80acf6f017d46d72df0d054`, 129 checks passed, 103,312
bytes (round 3 changed no module data). This supersedes the run recorded here before the test
package (16 PASS, 6 FAIL). No cloud Playwright run is recorded (no Node on this machine): the
specs read the Spanish caveats from `engine/policy.js` and pin no round-3 chrome text, but their
Spanish-mode checks are untested.

## screenAIr 0.4.3 (6 October 2026)

Release 0.4.3 adds the **EMR Friendly Template** to the Clinician Screener and the Ambient Scribe
(user request of 6 October 2026): a button labelled "EMR Friendly Template" next to the chart
write-back opens a script-free iframe with a plain-text consult-note template
(`app/src/engine/emr.js`), whose module data is the new rubric block `emrTemplate`
(`app/tests/harness/emr-delta.js`, validator V61). The clinical content was assembled by AI agents
from verified sources and, at release 0.4.3, had not been reviewed by the clinical lead (decisions
D1-D16 awaited the lead; the lead signed it off on 7 October 2026, recorded in 0.4.4 below). The
template is a prototype aid: every copy opens and closes with "Prototype · not for
clinical use". The design decisions are E1-E12 in `03-design.md` ("Decisions for release 0.4.3").
The clinical record (what the note contains in each state, where each line comes from, the
citation register, decisions D1-D16, known risks) is `app/modules/masque/CHANGELOG.md` (release
0.4.3). Every `emrTemplate` string is listed with its citation keys and basis in
`app/modules/masque/SOURCES.md` ("EMR template data (release 0.4.3, signed off by the clinical
lead in 0.4.4)").

- **Module data.** One new optional top-level rubric block, `emrTemplate`, generated from
  `app/tests/harness/emr-delta.js`. It holds:
  - 35 citation records (metadata and a link only, accessed 2026-10-06);
  - 6 empiric-treatment reference rows;
  - the 3 routing recommendations whose chips are instruments (`instrumentRecs`);
  - red-flag references for all 12 flags, and 1 red-flag workup placeholder (`rf_systemic`);
  - 14 treatment-and-workup rows (one added in review round 3);
  - 10 checklist rows;
  - 18 exam rows.

  No existing rubric value changes. The change log gains one `emr-template` entry.
- **Engine.** New `engine/emr.js`, exporting `buildEmrTemplate`, `emrFrameDoc` and `EMR_UI`. It
  reuses the bundle's gates (`referralGate`, `routingGate`, `routingRecs`, `referralFor`), so the
  note's referral text equals the FHIR referral in every state. `buildNote`, `buildBundle`,
  `divergences.js` and `masque.logic.js` are unchanged.
- **UI.** The "EMR Friendly Template" button sits in the Screener's write-back row and in the
  Scribe's Note view. Its panel holds the instruction line, the sandboxed iframe with one
  textarea, and "Copy text" and "Download .txt".
- **Contract, validator, editor.**
  - `emrTemplate` is an optional rubric key and is exposed as `module.emrTemplate`.
  - The new validator rule V61 checks it.
  - The Rubric Editor locks the block. It cascades item and flag deletions into it and reports
    any other change as a lock violation.

**Two changes from separate sessions, integrated on 7 October 2026.** Both were made on 6 October
2026 on top of release 0.4.1, before the Spanish and EMR work, and neither was deployed. They are
integrated into 0.4.3 on branch `claude/release-0.4.3` and ship with it:

- **The Patient `.txt` thin warning and not-sure lede** (AD16 below; design E11). `summaryText`
  now prints, in the locale's existing chrome, the thin block after the header and the lede under
  the not-sure heading, as the screen and the `.html` already did. Made as commit 27ce5f4, where its
  allowed difference was AD14; renumbered AD16 because AD14 is the Spanish completion and AD15 the
  EMR button.
- **Engine round 3d** (design S12 and E12; `05-scribe-capture-fixes.md` §13.12). In
  `extractInContext`, a line that withholds the value of an entry that may carry ends another
  entry's open normal slot. It needs two such entries; MASQUE has one, so its output, gold set 0.3.0,
  the benchmark and both pins are unchanged. Made as uncommitted changes in a separate worktree and
  integrated without a change to its engine logic.

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.3` (was `0.4.0`, then `0.4.1`, then `0.4.2`) | Release 0.4.3 (the EMR Friendly Template). `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move together. |
| AD15 (new) | The Screener's result card (`render-screener` `…/card/text` and `…/card/dom`, every result and captured comparison, sample and replay) and the Scribe's Note view (`render-scribe` `…/view_note`, every parity snapshot) | no such button | one added button, "EMR Friendly Template": in the Screener's write-back row right after "Write result to chart" / "Write partial screen to chart" (text ` EMR Friendly Template`; shape `button.btn.ghost`, `svg` right after the write button's `button.btn`, `svg`), and in the Scribe's Note-view row right after "Sign to chart" (text ` EMR Friendly Template`) | Release 0.4.3 (user request of 6 October 2026). The normaliser excuses only that text right after its named anchor, present exactly once, and only that shape insertion right after its anchor run, and only when removing it gives the baseline exactly; it applies only at those paths. The panel it opens is mounted only on demand and is never part of a parity comparison; its behaviour is checked on the new app alone (render-screener `/emr/…`, render-scribe `/emr/…`, the `emr` suite). Each suite expects AD15 at every result card / Note view it compares (`h.expect("AD15")`). |
| AD16 (new) | Patient Companion `.txt` (`golden` and `patient` `summaryText`) | no thin warning and no not-sure lede (Pat L1096-1125), although the screen shows both (Pat L1001-1014, L1058) | when the summary is thin, `thinTitle` in capitals and the `thin` text right after the header; the `notSureLede` line right under the not-sure heading; the existing `PATIENT_CHROME` strings, en and es (in es the existing Spanish `thinTitle`, `thin` and `notSureLede`) | Release 0.4.3 (design E11; made in a separate session on 2026-10-06 as "AD14" on top of 0.4.1, renumbered when integrated on 2026-10-07, since AD14 is the Spanish completion and AD15 the EMR button). A pre-existing omission in both locales: the `.txt` read as a finished summary when the screen and the `.html` said it was not. The normaliser inserts the baseline's own `UI[loc]` strings at exactly those two places, only when screenAIr prints them there. It runs last, after AD4, AD14 (es) and AD10; its lines hold no AD14 source, and the `patient` suite checks that without AD16 each thin comparison stays a difference, so the two never excuse the same text; crafted self-checks in `app/tests/suites/patient.js`. Detector: a thin baseline summary (Pat L1001) or a "Not sure" list. |

The Screener result card's extra button and the Scribe Note view's extra button text are new
rendered output with no baseline counterpart. AD15 registers them in
`ALLOWED_DIFFERENCES` (`tests/harness/diff.js`) with the exact rule. AD16 registers the Patient
`.txt` thin warning and not-sure lede. The other allowed differences (AD1-AD3, AD5-AD14) are
unchanged. `tests/harness/divergences.js`, `tests/baseline/**` and
`reference/**` are untouched.

### New files

| Path | What it is |
|---|---|
| `app/src/engine/emr.js` | **Deployed.** The EMR template engine: `buildEmrTemplate(module, state, {surface})` (plain text, the bundle's gates, the neutral template for a module without `emrTemplate`), `emrFrameDoc(text)` (the script-free iframe document: one textarea, every character escaped) and `EMR_UI` (panel chrome). It imports engine files only, names no module id, phenotype value or condition, and has no clock. |
| `app/tests/harness/emr-delta.js` | The EMR template data as plain data (`EMR_DELTA`: release, provenance with `reviewed: false`, `value`, one `basis` entry per row (97 since review round 3), the change-log entry); local-only, never deployed. |
| `app/tests/suites/emr.js` | The `emr` suite (registered in `tests/suites/index.json`): the gating matrix on both surfaces, each red flag and the tier lines, the note's referral equal to the bundle's in every state, the absent-versus-negative traps, the identity line, the presenting picture, the chips labels, the probe notes by kind, brackets and braces, the marker first and last, the footer axes, determinism, the neutral template, the frame document and a seeded fuzz (1,500 states per surface); since review round 3 also the probe-written checklist source, the gap and context lines, the domain denominators, the review sentence under open flags, the Scribe destination line and the one numbered source list; since review round 4 the SI1 clear-scan tick and the `r_normal` qualifier. Local-only. |
| `app/tests/fixtures/mutations/emr.js` | The V61 mutation generators (`withEmrTemplate`, a valid block on the mutation base, and `withEmrLogic`, the base logic with one exam probe), one per rule; since review round 4 one unknown-field generator per row kind. Local-only. |

### Changed files

| Path (under `app/`) | Change |
|---|---|
| `src/engine/policy.js` | `APP_VERSION` `0.4.3` (that line and its comment only; `SITE` untouched). |
| `src/engine/contract.js` | `emrTemplate` in `RUBRIC_KEYS.optional`; typedefs `EmrTemplate`, `EmrCitation`, `EmrReference`, `EmrChecklistRow`; `Rubric.emrTemplate`, `BoundModule.emrTemplate`; change-log kind `emr-template`. Round 3d: the `PendingCue` note (a withheld line ends another entry's normal slot). |
| `src/engine/patient.js` | `summaryText`: the thin block (`thinTitle` in capitals, `thin`) after the header and the unreviewed line, and `notSureLede` under the not-sure heading (AD16, E11). Integrated 2026-10-07. |
| `src/engine/extraction.js` | Round 3d: step 6 rule 3c of `extractInContext` (one condition) and the "Slots" header (rule 3c, the round 3+ claim, the disclosed effects against round 3). Integrated 2026-10-07. In review round 1 of the integration, comments only: round 3+ defined with "not withheld on that line", and the disclosure generalised (the effects chain through the pending id; F-3D-4). |
| `src/engine/bind.js` | `module.emrTemplate` (the rubric block as is, or `null`). |
| `src/engine/validate.js` | V61: `checkEmrTemplate` in the rubric checks (so also in `validateRubricShape`; since round 2 also signal polarity, history citations and qualifiers, `onlyWithSignal`; since round 4 a W for a row field the engine never reads) and `checkV61Probes` in `validateModule` (probe, routing-rule and exam-kind references, and since round 2 no computed chips under `instrumentRecs`; square brackets in the logic strings the template prints). |
| `src/engine/derive.js` | A `/emrTemplate` lock; `itemDependents` and `flagDeletePlan` cascade into the block (a flag's references and workup placeholder); `lockViolations` compares the draft's block with `expectedEmr` (what the deletions alone leave), so any other change, a reorder included, is a violation. |
| `src/apps/Screener.jsx` | The `scr-emr-toggle` button (`ClipboardList`) after "Write result to chart"; `EmrPanel` (`scr-emr-panel`, `-frame`, `-copy`, `-download`); `showEmr` state, cleared by `reset()`; `sa-scr-emr*` CSS in `LINK_CSS`. |
| `src/apps/Scribe.jsx` | The `scribe-emr-toggle` button after "Sign to chart" in the Note view; `EmrPanel` (`scribe-emr-*`); `showEmr` state, cleared by `reset()`; `sa-scribe-emr*` CSS in `SCRIBE_EXTRA_CSS`. |
| `modules/masque/masque.rubric.json` | Regenerated (never hand-edited): `emrTemplate` before `changelog`, and the `emr-template` change-log entry (`/changelog/10`). 701 lines added, none removed. |
| `modules/masque/CHANGELOG.md`, `SOURCES.md`, `README.md` | The release 0.4.3 entry; the EMR template data section, field-map row and regeneration note; one paragraph. |
| `tests/harness/diff.js`, `tests/tools/extract-rubric.js` | `NEW_RELEASE` 0.4.3, the AD4 text and the AD15 row with its normaliser; `applyEmrDelta` / `revertEmrDelta`; eight extractor checks and one `src()` row. At integration, the AD16 row and `ad16Params`. Local-only. |
| `tests/suites/patient.js`, `tests/suites/golden.js` | AD16 on every `summaryText` comparison, last (after AD4, AD14 in es, and AD10), expected on every thin summary or "Not sure" list; the thin cases en/es against the baseline, the engine chrome and `summaryHtml`; without AD16 each thin comparison stays a difference; the AD16 lines hold no AD14 source; ten crafted AD16 self-checks. Local-only. |
| `tests/suites/capture.js` | Round 3d: the rule-3c rows, eight multi-carry sequences (the eighth, F-3D-4, added in review round 1 of the integration), the recorded follow-ups F-3D-1 to F-3D-4 pinned as the engine behaves, and the seeded round 3+ property (4,000 dialogues; 1,000 with `?quick=1`). Pins unchanged. Local-only. |
| `tests/suites/index.json` | The `emr` suite registered; the `validate` description reads V1-V61. Local-only. |
| `tests/fixtures/mutations/index.js` | `CODES` 61; the `emr.js` generators; `withEmrTemplate` and `withEmrLogic` exported. Local-only. |
| `tests/harness/foundations.js`, `tests/loader-check/all-engine.js`, `tests/suites/omissions.js` | `emr.js` in `ENGINE_EXPORTS`, in the loader check, and in the patient graph's `FORBIDDEN_FILES`. Since review round 3 the omissions suite waits on the expected state after each walk (`settle`) instead of a fixed `sleep(0)`: the Companion's host reports reach the shell a task later, which a background tab delays. Local-only. |
| `tests/suites/validate.js` | The V61 control: the valid block (with `withEmrLogic`) adds no V61 finding; since review round 4 the message of each unknown-row-field warning, and no second report of a history row's citations. Local-only. |
| `tests/suites/values.js` | The `emrTemplate` pin against `EMR_DELTA.value`, revert and re-apply exactness, the change-log entry, exactly one basis per delta entry (round 2), and the provenance exemptions of exactly the delta's leaves (each one met). Local-only. |
| `tests/suites/render-screener.js`, `tests/suites/render-scribe.js` | AD15 at every parity comparison; the button, panel, iframe (`sandbox`, `title`, `srcdoc` equal to `emrFrameDoc(buildEmrTemplate(...))`), copy, copy failure, download and reset; the gates through the routing-error and shape-fixture paths; since review round 4, with the panel attached off screen, Copy and Download of the text as edited in the frame and the edit discarded on leaving the view. Local-only. |
| `tests/suites/editor.js`, `tests/suites/roundtrip.js` | The lock reason and lock violations of `/emrTemplate`; the item and flag deletion cascades (a workup placeholder included); the block preserved byte for byte on derive and round trip. Local-only. |
| `tests/suites/static.js` | t-emr: no condition word in `engine/emr.js` or `engine/generic.js`, `./<letters>.js` imports only, both apps load the engine by its explicit specifier. Local-only. |
| `tests/playwright/specs/pages.mjs` | The 375 px check with the EMR panel open on the Screener and the Scribe (not run: no Node here). Local-only. |

`docs/refactor/02-app-divergences.md`, `03-design.md` and `04-module-authoring.md` record the
release (not deployed); `05-scribe-capture-fixes.md` §13.12 specifies round 3d.

**Deploy list for 0.4.3** (the lead deploys; paths under `app/`):

- `src/engine/emr.js` (new);
- `src/engine/policy.js`, `src/engine/contract.js`, `src/engine/bind.js`, `src/engine/validate.js`,
  `src/engine/derive.js`;
- `src/engine/patient.js` (the `.txt` thin warning, AD16) and `src/engine/extraction.js` (round
  3d), both from the integration of 7 October 2026;
- `src/apps/Screener.jsx`, `src/apps/Scribe.jsx`;
- `modules/masque/masque.rubric.json`, `modules/masque/CHANGELOG.md`, `modules/masque/SOURCES.md`,
  `modules/masque/README.md`.

No page (`*.html`), import map, loader, logic file or other module changes. `lucide-react`'s
`ClipboardList` comes from the existing import. Everything under `app/tests/` (including
`emr-delta.js`) is local-only and never deployed. After upload, check the two `.jsx` files at
their plain URLs: the host has served stale `.jsx` from its cache before.

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.3** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

The new `emrTemplate` block changes only the rubric's `contentHash`; the instrument, scoring and
lexicon hashes, the calibration's `scoringHash` and every version axis but the release are
unchanged.
`logicSha256` is unchanged (`masque.logic.js` is not touched).
The two integrated changes move no axis: neither touches the rubric, so it is not regenerated and
its bytes and hashes are as above (round 3d changes no lexicon data, so `lexiconHash` holds).

### Verification

**Final run, after the integration and its review rounds 1 and 2 (7 October 2026),** on branch
`claude/release-0.4.3`: the EMR release (6ad68ff), then the Patient `.txt` thin change (AD16) and
round 3d, then the fixes of the integration's review rounds 1 and 2. Those fixes change no engine
logic. Round 1: comments in `extraction.js` and `contract.js` (the round 3+ definition and the
generalised round-3d disclosure), one capture sequence (F-3D-4) and records. Round 2: a comment in
`contract.js` (rules 1 and 2 decide before rule 3c), two capture rows, the round 3+ property's
counts and records. The code is that of the release's last commit; only these records changed
after the run.

- The full suite at `app/tests/index.html?seed=1296126801` (not quick), in a background tab:
  **23/23 PASS**, 0 fail, 0 invalid, no diff and no missing expected difference. Checks per suite:

  | Suite | Checks | Suite | Checks |
  |---|---|---|---|
  | integrity | 78 | shape | 77,607 |
  | values | 3,114 | emr | 102,783 |
  | golden | 411 | render-screener | 1,289 |
  | sweep | 104,273 | render-scribe | 292 |
  | rules | 221,619 | render-patient | 8,964 |
  | patient | 303,615 | omissions | 20,480 |
  | extraction | 167,936 | research | 160 |
  | capture | 269,966 | research-parity | 436 |
  | probes | 100,049 | editor | 230 |
  | cohort-gen | 10 | roundtrip | 183 |
  | validate | 394 | upload | 87 |
  | | | static | 1,024 |

  Only two suites moved from review round 4's run below:
  - `patient` +52: the thin cases, the no-double-excuse and disjointness checks, and the AD16
    self-checks. AD16 was seen 19,176/19,176 times, 4 of them the thin cases. On the es
    `summaryText`, each AD14 rule acted wherever its source occurred (C 10,158, Q 8,661, J 538,
    M 10,158).
  - `capture` +16,009: the round-3d rule-3c rows and sequences (eight multi-carry sequences; the
    eighth, F-3D-4, added in the integration's review round 1, +1 from the first integrated run's
    269,961), two `YIELD_ONLY_CASES` rows of review round 2 (+4 from review round 1's 269,962), and
    the round 3+ property. The property ran 4,000 dialogues and 15,990 steps: 3,650 normal slots,
    each round 3+'s; 2,619 yield-only slots; 456 normal slots ended by rule 3c and replaced by the
    withheld entry's yield-only slot; 280 normal slots closed on the line itself (expired, answered
    or carried) and followed by another entry's yield-only slot under rule 3d, as in round 3c; 29
    steps with a yielding entry suppressed. Review round 1's run printed 456 and 280 as one figure,
    736, labelled rule 3c.

  `golden` reports AD16 4/4 (all four thin), and its check count is unchanged. `GOLD_0_3_0_SHA256`
  and `EXPECTED_BENCHMARK` are unchanged. The console showed only the loader check's deliberate
  import-cycle errors.
- `app/tests/tools/extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `02c534810582927d8272a924aabc15d65d976f41ba162f6f01d2b4bf02f02004`, 137 checks passed, 131,172
  bytes. These are the same bytes as review round 4: neither change touches the rubric.
- `screenair.html` after the run: ready, the marker shown, the console clean.
- **Round 3d, checked independently at integration.** It was made in a separate session and had
  not been verified independently.
  - The MASQUE lexicon has exactly one scale entry with `heard` and `carry` (`v_vertigo`; `m_dur`
    yields to it).
  - The engine before round 3d (its one changed condition restored) and the engine after it gave
    identical results on 12,000 seeded dialogues (48,318 steps). The dialogues were built from the
    gold set 0.3.0 texts and this lexicon's phrases, with `{carry: false}` on 15% of the lines.
  - On a two-carry fixture, "alpha" · "a zeta, not a long span" · "a long span": round 3c carried
    `s_alpha` = 2, and round 3d gives `s_zeta` a yield-only slot and carries nothing (05 §13.12,
    first trace).
  - Review round 1 of the integration found that the disclosure named one effect where the effects
    chain (05 §13.12, "Effects against round 3"; F-3D-4). The eighth trace was re-run through the
    round-2 (3700a14), round-3 (0552a38), round-3c (abf659f) and integrated engines: the first three
    arm `s_eps` on the third line and carry `s_eps` = 2 on the fourth; the integrated engine clears
    the slot on the third line and records `s_eta` = 2. The definition of round 3+ was corrected to
    match the engine when the slot's own entry is withheld too (carry off). Comments, records and
    one capture sequence changed; the engine logic did not.
  - Review round 2 of the integration found two step-6 mutants that passed the whole capture
    suite: `held[0] === next.id` for `held.includes(next.id)`, and taking a refreshed slot's cue
    from `held[0]`. Each differs only for a slot of the second withheld entry in scale order. Two
    `YIELD_ONLY_CASES` rows with an `s_zeta` slot now fail each (7 and 5 differences; the engine
    was restored byte for byte after each run). With round 3c's step-6 condition restored, the
    property note gives 0 rule-3c endings and 283 other replacements; an instrumented engine
    counted the same 456 rule-3c endings as the note at HEAD, none of them a clearing (05 §13.12,
    Evidence).
- **Thin `.txt` (AD16).** The `patient` suite checks that, without AD16, each thin comparison stays
  a difference in en and es: AD14 in es does not excuse the thin block or the lede. The AD16 lines
  hold no AD14 source. A negative control with the engine change reverted was not run here; the
  originating session recorded that the old engine fails `patient` and `golden` with "expected
  difference missing".

**Review round 4's run (7 October 2026), before the integration,** on the uncommitted 0.4.3
tree (branch `claude/emr-template` from 47d970e), after the fixes of review rounds 1-4
(`CHANGELOG.md`, release 0.4.3, R1-R47). Round 4 changed `src/engine/validate.js` (V61 unknown row fields),
`src/engine/emr.js` (`EMR_UI`'s rebuild sentences), the `EmrPanel` comments of
`src/apps/Screener.jsx` and `src/apps/Scribe.jsx`, the delta and the regenerated rubric (SI1), the
records, the V61 mutation fixtures and the `validate`, `emr`, `render-screener` and
`render-scribe` suites; round 4 did not change the deploy list (the integration later added two
engine files to it).

- The full suite at `app/tests/index.html?seed=1296126801`, in a background tab: **23/23 PASS**,
  0 fail, 0 invalid. Checks per suite (superseded for `patient` and `capture` by the run above):

  | Suite | Checks | Suite | Checks |
  |---|---|---|---|
  | integrity | 78 | shape | 77,607 |
  | values | 3,114 | emr | 102,783 |
  | golden | 411 | render-screener | 1,289 |
  | sweep | 104,273 | render-scribe | 292 |
  | rules | 221,619 | render-patient | 8,964 |
  | patient | 303,563 | omissions | 20,480 |
  | extraction | 167,936 | research | 160 |
  | capture | 253,957 | research-parity | 436 |
  | probes | 100,049 | editor | 230 |
  | cohort-gen | 10 | roundtrip | 183 |
  | validate | 394 | upload | 87 |
  | | | static | 1,024 |

- **The omissions flake (round 3).** In round 2's verification a first full run failed `omissions`
  (24 diffs, all under the derived module's Spanish walk: the strip, the print header, the hand
  dialog, `<html lang>` and the title still in English); `?suite=omissions` alone and a full rerun
  passed, and only the passing run was recorded. Round 3 reproduced it with `?suite=omissions`
  alone in a background tab (24 diffs again) and traced it: a walk clicks synchronously, but the
  Companion's locale and dirty reports reach the shell in a later task, which a hidden tab delays
  by about a second, and the suite checked after a fixed `sleep(0)`. The suite now drains the
  scheduler's posted-message queue and waits for the expected state (up to 10 s, never throwing)
  after each walk. With the change, `?suite=omissions` alone in a background tab passed (20,480
  checks, the same count), as did the full run above, also in a background tab.
- The `emr` suite's fuzz built 3,000 templates (1,500 seeded states per surface). It drew flag,
  unscorable, closed and open on both surfaces, and on the Scribe also unreviewed (Screener:
  closed 260, flag 426, open 287, unscorable 527; Scribe: closed 195, flag 462, open 226,
  unreviewed 241, unscorable 376): no throw, deterministic, inputs untouched, the marker first and
  last, no braces, square brackets only as placeholders and boxes, no criterion ref, and the
  referral text and reason equal to the bundle's in every state. The fuzz uses the unmodified
  module, so it cannot reach a rule error; its named matrix (18 states) adds the rule-error states.
  Round 3 added 22,632 checks to the suite (the oracle now covers the gap and context lines, the
  domain denominators, the review-of-systems heading, the shared source list, the probe-written
  checklist source, the review sentence under open flags and the Scribe destination line in every
  verified template; the computed-listed fixture runs through the whole oracle; and the round-3
  traps). `values` gained three checks (the three new `/emrTemplate` leaves).
- Round 4 added 19 `validate` checks (one unknown-field generator per row kind, each message with a
  generator-found check, and a history row's citations reported once), 133 `emr` checks (the SI1
  clear-scan and qualifier traps, and those states through the whole oracle), 8 `render-screener`
  and 6 `render-scribe` checks (with the panel attached off screen: the frame's live textarea,
  Copy and Download of the edited text, and the edit discarded on leaving the view) and 3 `values`
  checks (the three new string leaves under `/emrTemplate`: the probe id, its render and the
  qualifier). Both render suites ran in a background tab: the frame
  wait wakes on the frame's load event as well as a timer, so throttled timers cannot stall it.
- `app/tests/tools/extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `02c534810582927d8272a924aabc15d65d976f41ba162f6f01d2b4bf02f02004`, 137 checks passed, 131,172
  bytes.
- The built-in MASQUE validates with 0 errors and the V12 warning only.
- `screenair.html` after the run: ready, the Scribe's EMR panel mounts with the round-4 instruction
  line, the console is clean.
- No cloud Playwright run is recorded (no Node on this machine).

Review round 3's run (rubric `ee9ae228ac95193af011ecf3785054451974b45e910e8eae0ed3cef766e63dd0`,
131,004 bytes) was 23/23 PASS, with values 3,111, validate 375, emr 102,650, render-screener 1,281
and render-scribe 286 (the other suites as above).

Review round 2's run (rubric `e9449e393b27c311cfe2079fd3c9b4de2fb1beab4b110e7b8554ef9c8d879f9b`,
130,890 bytes) was 23/23 PASS on its recorded run, with values 3,108 and emr 80,018 (the other
suites as above); a first full run of that tree had failed `omissions` intermittently (above).

Review round 1's run (rubric `e0b929c117254df931ad108b7e3ae56dfecfae79c6dbbebba152580d2bfbe08b`,
130,815 bytes) was also 23/23 PASS, with values 3,106, validate 365 and emr 73,909 (the other
suites as above).

Recorded earlier by the code package, before the test package and round 1 (the rubric then hashed
`64f7e2c5e79b2dd95e15935c08021f4821ab1ca253c29355f9ff03fe6d3771f7`, 130,536 bytes):

- States checked by hand:
  - high and moderate (otologic and both), low band;
  - a red flag on each surface;
  - Scribe not reviewed, unscorable, a simulated rule error;
  - the shape fixture with no `emrTemplate`, which gets the neutral template.
- `screenair.html`, checked through the DOM:
  - both tabs show the button, and the panel and iframe mount with `sandbox="allow-same-origin"`
    and no script;
  - the textarea equals `buildEmrTemplate`;
  - Copy and Download use the edited text, and the copy-failure toast shows;
  - reset closes the panel, the other tabs load, and the console is clean.

  It was not checked by eye, and the 375 px no-horizontal-scroll check was not run.
- The pre-test-package run (22 suites, no `emr` suite yet) was 19/22 PASS; the three failures
  were the test package's to fix (`values` exemptions, the Screener button, the Scribe Note view
  text). It is superseded by the final run above.

## screenAIr 0.4.4 (7 October 2026)

Release 0.4.4 records the **clinical-lead sign-off of the EMR template content**. On 7 October 2026
the user, who is the project's clinical lead, wrote in chat: "yes I am Clinically signed off on
the EMR template content, please upload the changes". The sign-off covers the
`emrTemplate` content and the note it generates, as implemented in release 0.4.3 (decisions
D1-D16, review rounds 1-4). It does not cover the Spanish Patient Companion translation
(`locales.es.reviewed` stays `false`, and its banner stays). The recorded follow-ups stay known
limitations, accepted at sign-off unless the lead asks for changes. The clinical record is
`app/modules/masque/CHANGELOG.md` (release 0.4.4); the design decisions are SO1-SO3 in
`03-design.md`.

No clinical content changes, and no behaviour other than the printed release string (AD4) and the
Rubric Editor's lock reason for `/emrTemplate`; the `emrTemplate` block is byte for byte release
0.4.3's. What changes:

- **Module data.** The rubric gains one change-log entry (kind `sign-off`, `/changelog/11`), right
  after the `emr-template` entry, which stays as it was. Only `contentHash` and the rubric's bytes
  change.
- **Engine.** The Rubric Editor's lock reason for `/emrTemplate` (`engine/derive.js`) no longer
  says the data awaits review. `APP_VERSION` is 0.4.4. The `ChangelogEntry` typedef in
  `contract.js` gains the kind `sign-off` (a comment).
- **Provenance.** `tests/harness/emr-delta.js` records `signOff` with `drafted.reviewed: true`;
  `applyEmrDelta` refuses one without the other.

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` (`APP_VERSION`, brand rows, footers, `modelVersion`, `app_version`, `summaryText` footer) | `0.4.4` (was `0.4.0`, then `0.4.1`, `0.4.2` and `0.4.3`) | Release 0.4.4 (the sign-off record). `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move together. |

The other allowed differences (AD1-AD3, AD5-AD16) are unchanged. `tests/harness/divergences.js`,
`tests/baseline/**` and `reference/**` are untouched.

### Changed files

| Path (under `app/`) | Change |
|---|---|
| `src/engine/policy.js` | `APP_VERSION` `0.4.4` (that line and its comment only; `SITE` untouched). |
| `src/engine/derive.js` | The `/emrTemplate` lock reason (that string only): "The EMR template data is cited clinical content (the built-in module's was signed off by the clinical lead on 2026-10-07); not editable in the Rubric Editor." It was "…awaiting clinical-lead review; …". The lock applies to the block of any module the editor opens, so the reason names the built-in module's sign-off. |
| `src/engine/contract.js` | The `ChangelogEntry` typedef's kinds gain `sign-off` (comment only). |
| `modules/masque/masque.rubric.json` | Regenerated (never hand-edited): the `sign-off` change-log entry, appended as `/changelog/11`. 8 lines added, none removed. |
| `modules/masque/CHANGELOG.md`, `SOURCES.md`, `README.md` | The 0.4.4 entry: the sign-off with its scope and date, the user's words, what it does not cover, and the release. Also the D1-D16 Status column, the review rounds and known risks 12, 14 and 15, the sign-off status of every `emrTemplate` string, the field map's `changelog[10]` and `changelog[11]` rows, the nine extractor checks, and one README paragraph. |
| `tests/harness/emr-delta.js` | `drafted.reviewed: true` with `signOff {by, date, scope, channel}`, `signOffChangelog`, and the header. The drafting provenance and the 0.4.3 `changelog` entry are kept; `value` and `basis` are unchanged. Local-only. |
| `tests/harness/diff.js` | `NEW_RELEASE` 0.4.4 and the AD4 text. `checkEmrDelta` refuses `drafted.reviewed: true` without a complete sign-off record, and a sign-off record on an unreviewed delta (`emrSignOffComplete`; since fix round 1 the date must be a real calendar date that round-trips through `Date`). Local-only. |
| `tests/tools/extract-rubric.js` | The first EMR check asserts `reviewed: true` only together with a complete `signOff` (through `emrSignOffComplete` of `diff.js`, not a copy of it). A new check places the sign-off entry (138 checks). The changelog gains the entry; the `src()` rows and the header follow. Local-only. |
| `tests/suites/values.js` | Pins the `signOff` record and both change-log entries, verbatim: `emr-template` second last, the sign-off entry last, with its kind and date. Also pins the SHA-256 of the signed-off `emrTemplate` (`fb63a2b9…`, the block release 0.4.3 shipped), so a later change to the block fails until a new sign-off is recorded. Two checks (fix round 1) pin `emrSignOffComplete`: the committed record passes, incomplete records and impossible dates (2026-13-45, 2026-02-30) do not, and `applyEmrDelta` refuses a delta carrying one. Local-only. |
| `tests/suites/editor.js` | The new lock reason, pinned at eight pointers. Local-only. |
| `tests/suites/emr.js` | The suite's closing note (not a check) names the sign-off. Local-only. |

`docs/refactor/02-app-divergences.md`, `03-design.md` and `04-module-authoring.md` record the
release (not deployed).

**Deploy list for 0.4.4.** The lead deploys. Paths are under `app/`, and the list is every deployed
file whose bytes differ from release 0.4.3 (commit bafb576):

- `src/engine/policy.js`, `src/engine/derive.js`, `src/engine/contract.js`;
- `modules/masque/masque.rubric.json`, `modules/masque/CHANGELOG.md`, `modules/masque/SOURCES.md`,
  `modules/masque/README.md`.

No `.jsx`, page (`*.html`), import map, loader, logic file or other module changes. Everything
under `app/tests/` (including `emr-delta.js`) is local-only and never deployed. After upload, check
the changed files at their plain URLs (`masque.rubric.json` should hash `03d5e5bc…`) and that the
footer reads release 0.4.4: the host has served stale files from its cache before.

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.4** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

The sign-off entry changes only the rubric's `contentHash`. The instrument, scoring and lexicon
hashes, the calibration's `scoringHash` and every version axis but the release are unchanged.
`logicSha256` is unchanged (`masque.logic.js` is not touched).

### Verification

**Run of 7 October 2026,** on branch `claude/release-0.4.4` (from bafb576), on the release's code
after fix round 1 (the calendar-date check of `emrSignOffComplete`, the extractor reusing it, and
record wording). Afterwards only the records changed.

- The full suite at `app/tests/index.html?seed=1296126801` (not quick), in a background tab:
  **23/23 PASS**, 0 fail, 0 invalid, 1,385,006 checks. Checks per suite:

  | Suite | Checks | Suite | Checks |
  |---|---|---|---|
  | integrity | 78 | emr | 102,783 |
  | values | 3,120 | render-screener | 1,289 |
  | golden | 411 | render-scribe | 292 |
  | sweep | 104,273 | render-patient | 8,964 |
  | rules | 221,619 | omissions | 20,480 |
  | patient | 303,615 | research | 160 |
  | extraction | 167,936 | research-parity | 436 |
  | capture | 269,966 | editor | 230 |
  | probes | 100,049 | roundtrip | 183 |
  | cohort-gen | 10 | upload | 87 |
  | validate | 394 | static | 1,024 |
  | shape | 77,607 |  |  |

  Only `values` moved from release 0.4.3's final run: 3,114 → 3,120 (the `signOff` pin,
  the sign-off entry verbatim, its kind and date, the signed-off block's SHA-256, and the two
  `emrSignOffComplete` checks of fix round 1). Every other
  suite has the same count. `GOLD_0_3_0_SHA256` and `EXPECTED_BENCHMARK` are unchanged.
- `app/tests/tools/extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `03d5e5bc566dd922dc9d960bc622f703170175c848aba8c02c1f98d644642ab7`, 138 checks passed, 132,397
  bytes (release 0.4.3: `02c534810582927d8272a924aabc15d65d976f41ba162f6f01d2b4bf02f02004`, 137
  checks, 131,172 bytes).
  `scoringHash` is unchanged (`32cc4f44…`).
- `applyEmrDelta`'s negative cases, run by hand in the page: `reviewed: true` with no sign-off, an
  empty `channel` or a date not in YYYY-MM-DD form throws; a sign-off record on an unreviewed delta
  throws; an unreviewed delta without one applies; `revertEmrDelta` gives null for a refused delta.
- `screenair.html` after the run: ready, `#root` mounted, and the footer lists release 0.4.4,
  module masque, instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0, with the
  marker. The console shows no error from the page (only the loader check's deliberate
  import-cycle errors from the suite run).
- No cloud Playwright run (no Node on this machine).

## screenAIr 0.4.5 (7 to 10 October 2026)

Release 0.4.5 records the **clinical lead's decisions** of 7, 9 and 10 October 2026 and implements
the referral rule for dizziness cases. In chat the user, who is the project's clinical lead, wrote:

- 2026-10-07: "Yes, checklist showing even when red flag is open is okay to proceed" and "Yes,
  dizziness cases should be referred to neurology, and neuro-otology if there is a true vertiginous
  component or a history of ear or brain surgeries". Asked directly how true vertigo is to be
  recognised, the lead gave, in the lead's own words, a definition of internal vertigo (a false
  sensation of self-motion) and external vertigo (a false sensation that the surroundings move),
  and chose that the rule applies to the EMR note and the FHIR referral alike, that the routing
  recommendation text of `masque.logic.js` stays unchanged, and that the note states the rule
  above the recommendations.
- 2026-10-09: "both cases should follow the dizziness rule"; three minutes later, in one message,
  "Vertigo episodes that last between 30 min and 12 hours should count as vertigo for
  purposes of ruling out meniere's disease, transient vertigo (true room spinning for a few seconds
  can count as vertigo which can be consistent with migrainous vertigo). A rocking or bobbing
  sensation is not true vertigo but a dizziness morphology that can be consistent with migrainous
  symptoms. Also some people describe "the floor falling out from underneath them"." and "The
  checklist can be shown regardless if the safety screen is done, the user should be able to see
  progress and alerted if red flags pop up."
- 2026-10-10, in two messages answering the two questions this release had recorded for the lead:
  "classify rocking or bobbing as dizziness and not true vertigo, it counts toward the vestibular
  score still as it is imbalance" and "Swaying is imbalance also".

Each date is the local calendar date (UTC-7) of the chat message. The clinical record is
`app/modules/masque/CHANGELOG.md` (release 0.4.5); the design decisions are RR1-RR6 in
`03-design.md`. The first implementation of this release (commits `9dac9b7` and `c175c03`,
7 October: automatic escalation to Neuro-otology on a Scribe probe answer, `both` unchanged) was
never deployed; this section describes the release as corrected after the lead's decisions of
9 October and amended on 10 October.

What changes:

- **Checklist.** Nothing: 0.4.3 already shows the checklist in every state (I3, D7), with red
  flags leading the plan and, on the Scribe before the review with no flag open, the "Safety
  review not recorded" line. The 0.4.4 pending-confirmation list marks the checklist CONFIRMED in
  every state (under an open red flag 2026-10-07; before the Scribe's safety review and on an
  unscorable screen 2026-10-09, "regardless … the user should be able to see progress") and the
  otologic destination REPLACED; the rest of I1-I8, the DZ4 clause and the reading of "also" stay
  pending.
- **Referral (module data).** `phenotypes.referral.byPhenotype.otologic.specialty` is "Neurology"
  (was "Neuro-otology"); the new `byPhenotype.both` is "Neurology" with the reason `both` had
  through the default ("mid-facial / migrainous cause"); the new `phenotypes.referral.clinicianRules`
  holds the lead's rule and clarification, verbatim, and the lead's definition as the lead amended
  it on 10 October (the internal-vertigo line without "swaying, bobbing, "; source "clinical lead,
  2026-10-07; definition amended 2026-10-10"), with two placeholders, for `otologic` and `both`.
  The sinonasal phenotype and the default are unchanged. **Nothing escalates**: the lead's
  clarification says a rocking or bobbing sensation is not true vertigo (and the lead's amendment
  of 10 October that swaying is imbalance too), so the probe `pr_internal_vertigo` does not record
  true vertigo, and no other app data reliably does; Neuro-otology is the clinician's decision
  through the printed rule. The rubric gains one
  change-log entry (kind `referral`, dated as the last decision, 2026-10-10, `/changelog/12`).
- **Engine.** `emr.js` prints the clinician rules of the picture above the recommendations
  (`clinicianRuleLines`). `validate.js` checks `clinicianRules` (V27). `contract.js`: the
  `ClinicianRule` typedef and the change-log kind `referral` (comments). `policy.js`: `APP_VERSION`
  0.4.5. `rules.js` and `fhir.js` are byte for byte release 0.4.4's (the first implementation's
  escalation helpers and `probeAns` plumbing are removed).
- **App.** No change: `Scribe.jsx` is byte for byte release 0.4.4's again (the first implementation
  passed `probeAns` to the bundle), and the Screener is unchanged.

**Answered by the lead on 10 October** (`CHANGELOG.md`, release 0.4.5, Decision 3; RR6): the two
questions this release had recorded for the lead. The definition's internal-vertigo line of
2026-10-07 is amended: "swaying, bobbing, " is removed and nothing else, so it no longer
contradicts the clarification of 2026-10-09 (printed unchanged); the 2026-10-07 text stays
verbatim in `referral-delta.js` (`quotes.definition`) and the removal is recorded in
`amendments`. No versioned instrument, probe or lexicon change is wanted: a rocking, bobbing or
swaying sensation still counts toward the vestibular score as imbalance, through the item
`v_vertigo` ("Episodic vertigo or imbalance"), the probe `pr_internal_vertigo` ("Yes — rocking or
bobbing" as "5 min – 72 h", "Yes, but only seconds at a time" as "Under 5 min") and the cues the
lead approved on 2026-10-04 (F3: "rocking feeling", "rocking sensation", "like i'm on a boat" and
its three variants, "swaying side to side") when a duration phrase is heard. **Still for the
lead:** the known limitation that a ticked placeholder does not change the referral (changed by
hand), and, from the 0.4.4 list, the rest of I1-I8, the DZ4 clause and the reading of "also". The
questions of the first implementation (does `both` count, the definition as stored, escalation on
a seconds-long answer, the order of the placeholder and the evidence line) are answered or moot.

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` | `0.4.5` (was `0.4.0`, then `0.4.1`, `0.4.2`, `0.4.3` and `0.4.4`) | Release 0.4.5. `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move together. |
| AD17 (new) | The referral ServiceRequest's code text of a dizziness case: `golden` (Screener and Scribe bundles), `rules` (referralFor vs both baseline bundles), `render-screener` (the bundle shown for the sample "otologic") | `Referral: Neuro-otology — evaluate for vestibular migraine` (otologic); `Referral: Headache medicine / Neurology — evaluate for mid-facial / migrainous cause` (both) | `Referral: Neurology — evaluate for vestibular migraine`; `Referral: Neurology — evaluate for mid-facial / migrainous cause` | The clinical lead's referral rule (RR2). Exactly these two rows of the delta's `destinations`, each for its own phenotype and with its own reason, at `…/code/text` (`ctx.AD17 = {delta, complaint}`); never another phenotype (sinonasal, the default), specialty, reason, direction or place, or a malformed or missing delta (self-checks and an exhaustive sweep in `rules`). Expected wherever a baseline bundle refers one of the two phenotypes. |

The other allowed differences (AD1-AD3, AD5-AD16) are unchanged. The CDS preview and CDS Hooks
name no specialty and stay byte-equal to the baseline. `tests/harness/divergences.js`,
`tests/baseline/**`, `reference/**`, `masque.logic.js` and the signed-off `emrTemplate` block
are untouched.

### New files

| Path (under `app/`) | Purpose |
|---|---|
| `tests/harness/referral-delta.js` | `REFERRAL_DELTA`: the changed and added destinations, the clinician rule, `destinations` (what AD17 excuses), the decision record, the lead's words verbatim with their dates, the lead's amendment of the definition (`amendments`, 10 October), one basis per entry and the change-log entry. Plain data. Local-only. |

### Changed files (from release 0.4.4, commit 20165ba)

| Path (under `app/`) | Change |
|---|---|
| `src/engine/emr.js` | The clinician-rule block (rule, definition, clarification, `confirm` placeholders) between the consultant placeholders and the recommendations, with a referral line or the clinician placeholder (`clinicianRuleLines`, three structural labels). Names no phenotype or condition (t-emr). |
| `src/engine/validate.js` | V27: `referral.clinicianRules` (`checkClinicianRules`). |
| `src/engine/contract.js` | `PhenotypeData.referral.clinicianRules`, the `ClinicianRule` typedef, the change-log kind `referral` (comments only). |
| `src/engine/policy.js` | `APP_VERSION` `0.4.5` (that line and its comment; `SITE` untouched). |
| `modules/masque/masque.rubric.json` | Regenerated (never hand-edited): the otologic destination, `byPhenotype.both`, `clinicianRules`, and the `referral` change-log entry. |
| `modules/masque/CHANGELOG.md`, `SOURCES.md`, `README.md` | The 0.4.5 entry (the decisions verbatim with dates, the removal of automatic escalation and why, the Bárány / referral-rule distinction, AD17, the questions for the lead and the lead's answers of 10 October, Decision 3); the 0.4.4 pending list, the D3 and D7 Status cells; the source map, the ten extractor checks and the field rows; one README paragraph. |
| `tests/harness/diff.js` | `applyReferralDelta`, `revertReferralDelta`; AD17 (`ad17Change`, reading `destinations`); `NEW_RELEASE` 0.4.5 and the AD4 text. Local-only. |
| `tests/tools/extract-rubric.js` | Applies the referral delta last; ten checks (148 in all; since 10 October the definition is checked as the lead's with only the recorded amendments applied, the source names the amendment's date, and a new check proves each amendment a single removal of words the lead's amendment names); the sign-off check places the sign-off entry right after the emr-template entry and before the referral entry; the `src()` rows. Local-only. |
| `tests/suites/rules.js` | referralFor vs the baseline bundles under AD17 (expected on both bundles of otologic and of both); referralFor for every phenotype with every kind of probe answer (no escalation); the bundle in every sample state that issues a referral, and none in the withheld states; the table and the engine carry no escalation; AD17 self-checks and sweep. Local-only. |
| `tests/suites/emr.js` | The oracle computes the destination from the module data (no escalation) and builds the bundle with the state's probe answers on both surfaces; no evidence line or escalation words in any state; the rule block between the consultant lines and the recommendations, nowhere else; matrix states for otologic and both with `pr_internal_vertigo` 0, 1, 2 and the lowest band; line-exact checks of the rule, the definition (as amended on 10 October: no printed definition line names swaying or bobbing, and the 7 October internal-vertigo line prints nowhere), the clarification and the placeholders, for otologic and both, both derived Scribe pictures and the gates; the fuzz must draw referrals of otologic and both on both surfaces, derived both on the Scribe and the probe answered. Local-only. |
| `tests/suites/golden.js`, `render-screener.js` | AD17 allowed and expected on the bundle comparisons. Local-only. |
| `tests/suites/render-scribe.js` | On a fixture copy whose clinician rule names every phenotype: the Scribe's EMR panel prints the block once, right after the consultant placeholders, the referral equals the bundle's and the module data's destination although a probe was answered, and no line names an escalation. Local-only. |
| `tests/suites/values.js` | The referral delta: revert and re-apply exact, `destinations` exactly the differences from the baseline, the record, the rule and the lead's words pinned (the 7 October definition kept verbatim in `quotes.definition`, the amendment and `amendments`; the amended definition pinned line by line and equal to the 7 October one with exactly the recorded removal, no line naming swaying or bobbing; the clarification pinned unchanged), the probe and recommendation text unchanged, one basis per entry, the change-log entry last (the emr-template and sign-off entries move to third and second last), the delta's leaves exempt from the sweep (pointer and value). Local-only. |
| `tests/suites/validate.js`, `tests/fixtures/mutations/safety.js`, `index.js` | 20 V27 generators for `clinicianRules` (escalation fields are warnings), a valid-rule control (no V27 finding) and a check that the rule reads no probe. Local-only. |
| `tests/suites/editor.js` | `phenotypes.referral` stays locked: nine pointers read-only, eight edits lock violations, a derivation keeps it byte for byte. Local-only. |
| `tests/suites/index.json` | The suite descriptions. Local-only. |

`docs/refactor/02-app-divergences.md`, `03-design.md` and `04-module-authoring.md` record the
release (not deployed).

**Deploy list for 0.4.5.** The lead deploys. Paths are under `app/`, and the list is every deployed
file whose bytes differ from release 0.4.4 (commit 20165ba):

- `src/engine/emr.js`, `src/engine/validate.js`, `src/engine/contract.js`, `src/engine/policy.js`;
- `modules/masque/masque.rubric.json`, `modules/masque/CHANGELOG.md`, `modules/masque/SOURCES.md`,
  `modules/masque/README.md`.

No page (`*.html`), `.jsx`, import map, loader, logic file or other module changes (`rules.js`,
`fhir.js` and `Scribe.jsx`, changed by the first implementation, are back to release 0.4.4's
bytes and are not deployed). Everything under `app/tests/` (including `referral-delta.js`) is
local-only and never deployed. After upload, check the changed files at their plain URLs
(`masque.rubric.json` should hash `068f37c3…`; it hashed `bd6e2bd8…` before the amendment of 10
October) and that the footer reads release 0.4.5.

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.5** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

The referral change moves only the rubric's `contentHash`. The instrument, scoring and lexicon
hashes, the calibration's `scoringHash` (`32cc4f44…`) and every version axis but the release are
unchanged. `logicSha256` is unchanged (`masque.logic.js` is not touched).

### Verification

**Run of 10 October 2026, after the lead's amendment of the definition,** on branch
`claude/release-0.4.5`, after the last change (the amendment of 10 October: `referral-delta.js`,
the regenerated rubric, the extractor's amendment checks, the `values` and `emr` pins, and these
records).

- The full suite at `app/tests/index.html?seed=1296126801` (not quick), in a background tab:
  **23/23 PASS**, 0 fail, 0 invalid, 1,393,037 checks. Checks per suite:

  | Suite | Checks | Suite | Checks |
  |---|---|---|---|
  | integrity | 78 | emr | 110,490 |
  | values | 3,164 | render-screener | 1,290 |
  | golden | 412 | render-scribe | 300 |
  | sweep | 104,273 | render-patient | 8,964 |
  | rules | 221,845 | omissions | 20,480 |
  | patient | 303,615 | research | 160 |
  | extraction | 167,936 | research-parity | 436 |
  | capture | 269,966 | editor | 251 |
  | probes | 100,049 | roundtrip | 183 |
  | cohort-gen | 10 | upload | 87 |
  | validate | 416 | static | 1,025 |
  | shape | 77,607 |  |  |

  Moved from the run before the amendment (`dcff4d2`, 1,393,003 checks): values (+5: the
  2026-10-07 definition kept verbatim, the amended definition equal to it with exactly the
  recorded removal, the amendment naming swaying and bobbing, no printed definition line naming
  either, the clarification pinned unchanged) and emr (+29: the block written out in the suite,
  and the amended-definition check in each of the 28 states that print the rule block). Moved
  from release 0.4.4: values (+44), golden (+1), rules (+226), validate (+22), emr (+7,707),
  render-screener (+1), render-scribe (+8), editor (+21), static (+1, the new file). AD17 was
  observed wherever its precondition held (golden 10/10, render-screener 1/1, rules 4/4).
  `GOLD_0_3_0_SHA256`, `EXPECTED_BENCHMARK` and `SIGNED_OFF_EMR_SHA256` are unchanged. The
  built-in module validates with 0 errors and the one V12 warning it had before.
- `app/tests/tools/extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `068f37c3e49a3df152bda500cba9f93846041a979051cab26f90e279adf1982e`, 148 checks passed, 136,256
  bytes (before the amendment, `dcff4d2`: `bd6e2bd8…`, 147 checks, 135,674 bytes; release 0.4.4:
  `03d5e5bc…`, 138 checks, 132,397 bytes; the corrections as first committed, `f985f74`, with the
  date 2026-10-08 in the change-log entry: `f226112b…`, 135,689 bytes). `scoringHash` is
  unchanged (`32cc4f44…`).
- `screenair.html` after the run: ready, `#root` mounted, the footer lists release 0.4.5, module
  masque, instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0, with the marker; the
  engine in the page prints the rule block, with the amended definition and the source "clinical
  lead, 2026-10-07; definition amended 2026-10-10", for `otologic` and `both` on both surfaces
  ("Neurology", also with `pr_internal_vertigo` answered on the Scribe) and none for
  `sinonasal`; through the lexicon's `extract`, "i feel like i'm swaying side to side for hours"
  still captures `v_vertigo` = 2, as the rocking examples do; no console error from the page
  (only the loader check's deliberate import-cycle errors).
- No cloud Playwright run (no Node on this machine).

**History: release 0.4.5 before the amendment (`dcff4d2`, 10 October 2026).** It passed the same
suite (1,393,003 checks: values 3,159, emr 110,461, every other suite as above) and its extractor
run (147 checks, `bd6e2bd8…`, 135,674 bytes), after fix round 2 of the corrections (records only:
the rocking-or-bobbing question for the lead widened to every route, the AD17 row of
`03-design.md` rejoined to its table, three CHANGELOG paragraphs re-wrapped; fix round 1 changed
dates and records, the rubric's change-log note and the `values` date pins).

**History: the first implementation (7 October 2026, commits `9dac9b7` and `c175c03`).** It passed
the same suite (1,389,464 checks) and its extractor run (146 checks, `aa93907f…`). Its review round
1 found that on the Scribe the rule almost never applied (any `m_head` answer derives `both`) and
that one record overstated the checklist confirmation; both are now settled by the lead's
decisions of 9 October (`both` is a dizziness case; the checklist is confirmed in both
states). Its automatic escalation, its evidence line and its "as relayed" qualifiers are removed.

## screenAIr 0.4.6 (10 October 2026)

Release 0.4.6 records the **clinical lead's answers of 10 October 2026** on four items the EMR
template sign-off had left open, and implements them (design 03, ED1-ED6; the questions, options
and answers verbatim in `tests/harness/emr-decisions-delta.js`):

- the reading of "also": "Workup + referral + references". Under an open red flag the EMR note
  now also prints the screen-based referral block and the empiric-treatment references, under the
  heading "Screen-based referral and references (the FHIR bundle withholds the referral while a
  red flag is open):". The FHIR bundle is unchanged and still withholds the referral, so under an open flag
  the note and the bundle differ, as the option the lead chose said;
- DZ4: "Keep the clause (Recommended)". No change;
- I5: "Modifying conditions,Family history of migraine,Assessment 'Considerations'". The past
  history gains the modifying-conditions row and the family-history-of-migraine line (the item
  leaves the review of systems), and the assessment lists the recommendations' headings;
- D6: "Add a clinician line (Recommended)". "[clinician interpretation of HINTS and any imaging
  decision]" under the HINTS exam row when the Scribe records "Normal impulse (points central)".

On 2026-10-11 the lead confirmed the six implementation choices still open from the 0.4.4 list
(I1, I2, I4, I6, I7, I8) as implemented ("Confirm changes, upload 0.4.6 and update the version in
github on the cloud session"); records only, nothing in the note or the data changes. Nothing from
the 0.4.4 list is pending.

### Allowed differences from the baseline (design §8.4), as amended

| Id | Where | Baseline | screenAIr | Why |
|---|---|---|---|---|
| AD4 (amended) | Every printed release string | `0.3.0` | `0.4.6` (was `0.4.0`, then `0.4.1`, `0.4.2`, `0.4.3`, `0.4.4` and `0.4.5`) | Release 0.4.6. `policy.js APP_VERSION` and `diff.js NEW_RELEASE` move together. |

No other allowed difference changes. The EMR template is never compared with the baseline (it has
none); the FHIR bundles, the CDS preview and the CDS Hooks document are byte for byte release
0.4.5's. `tests/harness/divergences.js`, `tests/baseline/**`, `reference/**`, `masque.logic.js`,
`tests/harness/emr-delta.js` (the signed-off 0.4.3 data) and `tests/harness/referral-delta.js` are
untouched.

### New files

| Path (under `app/`) | Purpose |
|---|---|
| `tests/harness/emr-decisions-delta.js` | `EMR_DECISIONS_DELTA`: the decision record, the four questions with every option and the answers verbatim, the two added keys (`/emrTemplate/pastHistory`, `/emrTemplate/examRows/14/optionPlaceholders`), one basis per entry and the change-log entry. Plain data. Local-only. |

### Changed files (from release 0.4.5, commit a490922)

| Path (under `app/`) | Change |
|---|---|
| `src/engine/emr.js` | Under open flags, the heading and the referral and references blocks as without the flags (the gates re-run with no active flag; `referralBlock` and `referenceBlock`, shared with the unflagged plan); the "Considerations:" line; the past-history rows of `emrTemplate.pastHistory` (and "Other family history: [ ]" after a family row; a listed item leaves the review of systems); an exam row's `optionPlaceholders`. Names no item, probe, option or condition (t-emr). |
| `src/engine/derive.js` | Review round 1: `itemDependents` and the EMR lock's expected block include `emrTemplate.pastHistory` (deleting an item a past-history row names removes the row); the `/emrTemplate` lock reason names the lead's additions of 2026-10-10. |
| `src/engine/validate.js` | V61: `pastHistory` rows (item or label, group, no repeat of a history item) and exam rows' `optionPlaceholders` (on a row with a probe, one per option, an option the probe has). |
| `src/engine/contract.js` | `EmrTemplate.pastHistory`, the exam row's `optionPlaceholders`, the change-log kind `emr-decisions` (comments only). |
| `src/engine/policy.js` | `APP_VERSION` `0.4.6` (that line and its comment; `SITE` untouched). |
| `modules/masque/masque.rubric.json` | Regenerated (never hand-edited): `emrTemplate.pastHistory`, `emrTemplate.examRows[14].optionPlaceholders` and the `emr-decisions` change-log entry. |
| `modules/masque/CHANGELOG.md`, `SOURCES.md`, `README.md` | The 0.4.6 entry (the answers verbatim, what changes in the note, where it lives); the Status cells of D1, the red-flag row, D6 and D13, the I5 list, known risk 15, the 0.4.4 pending list and the 0.4.5 "For the lead" list; the source map (157 checks), the rows with their basis, the nine extractor checks, `changelog[13]` and the field row; one README paragraph. |
| `tests/harness/diff.js` | `applyEmrDecisionsDelta`, `revertEmrDecisionsDelta` (keys added under `/emrTemplate`, lists entered by index); `NEW_RELEASE` 0.4.6 and the AD4 text. Local-only. |
| `tests/tools/extract-rubric.js` | Applies the decisions delta last; nine checks (157 in all); the sign-off and referral checks place their entries before the new last entry; the `src()` rows. Local-only. |
| `tests/suites/emr.js` | The oracle builds, under open flags, the routing and the bundle without them (`plainState`): the referral equals that bundle's while the bundle itself has none, the heading and the plan under it line for line, no recommendation under it, references right after it where the gate would open; the "Considerations:" line in every state; the past-history section; the HINTS placeholder in the exam rows; a release 0.4.6 section (flag against no flag, line for line, for otologic, both and sinonasal on both surfaces; the unreviewed, unscorable and lowest-band cases under a flag; the past history for each state of `m_fhx`; the HINTS placeholder for each option; seven V61 mutations); the 0.4.5 flag case now expects the rule block under the heading. Local-only. |
| `tests/suites/values.js` | The decisions delta: revert and re-apply exact, the record and answers, the added data and the HINTS probe's options pinned, the approved wording equal to the strings the chosen options quote, one basis per entry, the shipped block's SHA-256, the change-log entry last; the signed-off block's checks run on the rubric without the delta (its SHA-256 still `fb63a2b9…`); the emr-template, sign-off and referral entries move to fourth, third and second last; the delta's leaves exempt from the sweep (pointer and value). Local-only. |
| `tests/suites/editor.js` | Review round 1: the `/emrTemplate` lock reason; the past-history item's dependents, delete cascade and lock. Local-only. |
| `tests/suites/render-screener.js`, `render-scribe.js` | Under an open flag: no referral in the bundle, and a referral line or the references in the note only under the 0.4.6 heading. Local-only. |
| `tests/suites/index.json` | The emr suite's description. Local-only. |

`docs/refactor/02-app-divergences.md`, `03-design.md` and `04-module-authoring.md` record the
release (not deployed).

**Deploy list for 0.4.6.** The lead deploys. Paths are under `app/`, and the list is every deployed
file whose bytes differ from release 0.4.5 (commit a490922):

- `src/engine/emr.js`, `src/engine/validate.js`, `src/engine/contract.js`, `src/engine/policy.js`,
  `src/engine/derive.js` (review round 1);
- `modules/masque/masque.rubric.json`, `modules/masque/CHANGELOG.md`, `modules/masque/SOURCES.md`,
  `modules/masque/README.md`.

No page (`*.html`), `.jsx`, import map, loader, logic file or other module changes. Everything
under `app/tests/` (including `emr-decisions-delta.js`) is local-only and never deployed. After
upload, check the changed files at their plain URLs (`masque.rubric.json` should hash
`173f28b9…`) and that the footer reads release 0.4.6.

### Version label

| Axis | Value | Owner |
|---|---|---|
| Release | **0.4.6** | `app/src/engine/policy.js` |
| Instrument | 0.2 | `masque.rubric.json` `instrumentVersion` |
| Lexicon | 0.3.2 | `masque.rubric.json` `lexicon.version` |
| Probe set | 1.0.0 | `masque.logic.js` `probes.version` |
| Gold set | 0.3.0 (lexicon 0.3.2) | `masque.rubric.json` `lexicon.goldSet.version` |

The change moves only the rubric's `contentHash`. The instrument, scoring and lexicon hashes, the
calibration's `scoringHash` (`32cc4f44…`) and every version axis but the release are unchanged.
`logicSha256` is unchanged (`masque.logic.js` is not touched).

### Verification

Review round 1 (2026-10-11) and its fixes: `CHANGELOG.md` (release 0.4.6, "Review round 1").

- `extract-rubric.html` reports "Identical" to the committed rubric: SHA-256
  `173f28b9110d773a6afe970681f0e43a3e4e83317d2aff402f8280f47d2278d9`, 157 checks passed (nine
  for the decisions delta), 138,226 bytes (before review round 1: `ed436707…`, 138,218 bytes, the
  change-log note's "withholds them"; release 0.4.5: `068f37c3…`, 148 checks, 136,256 bytes). `scoringHash` (`32cc4f44…`) and `instrumentHash` are unchanged. The shipped
  `emrTemplate` hashes `0152cfd8…`; without the two additions it hashes `fb63a2b9…`, the
  signed-off block.
- The full suite at `?seed=1296126801`, run in a background tab after review round 1:
  **23/23 PASS**, 0 fail, 0 invalid, 1,407,588 checks (before review round 1: 1,407,090; emr
  124,521 → 125,013 for the closed-gate assertions under a flag, editor 251 → 257 for the
  past-history delete cascade). Four suites moved from release 0.4.5 (1,393,037 checks), editor
  251 → 257 as just said, and these three (counts before review round 1): values 3,164 → 3,185 (the decisions delta: revert and re-apply,
  the record, the added data, the approved wording, the HINTS probe's options, the shipped block's
  SHA-256, one basis per entry, the change-log entry, and the signed-off block still `fb63a2b9…`
  under it), emr 110,490 → 124,521 (under every open flag in the matrix, the flags and the 3,000
  fuzz notes, the heading and the plan under it equal to the unflagged plan without its
  recommendations, the referral equal to the bundle's without the flags while the bundle carries
  none; the Considerations line, the past-history section and the exam rows in every state; the
  release 0.4.6 section and its seven V61 mutations) and static 1,025 → 1,026. Every other suite
  has the same count. The `emr` fuzz drew 455 Screener and 437 Scribe notes under open flags.
- `screenair.html` after the run: ready, `#root` mounted, the footer lists release 0.4.6. In the
  page, the Screener's EMR panel for the sample "red flag" prints the red-flag action with its
  Ref lines, the workup placeholder, "Screening routing withheld — red flag present", the 0.4.6
  heading, "Referral: Neurology — evaluate for vestibular migraine" with its reason, the
  consultant lines, the lead's rule block, the empiric-treatment references and the checklist; its
  assessment has no band headline and no Considerations line. The sample "otologic" prints
  "Considerations: Consider vestibular migraine; Characterise the tinnitus before attributing it".
  Both print the modifying-conditions row, "Personal or family history of migraine: yes" and
  "Other family history: [ ]". The console shows no error from the page (only the loader check's
  deliberate import-cycle errors from the suite run).
- The files, the deploy list and the AD4 row: `docs/refactor/02-app-divergences.md` ("screenAIr
  0.4.6").
