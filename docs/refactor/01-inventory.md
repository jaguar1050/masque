# 01 — Module-system inventory: content vs engine across the MASQUE v0.3.1 prototype

Reference document for the designers and implementers of the module system. Synthesised from the per-file inventories of `reference/fixed-src/`, the constraints extract from the docs (VERSIONS.md, README, fix changelogs, re-audit), and the duplication audit. Line numbers refer to `C:\Users\User\Documents\MASQUE\reference\fixed-src\` as of release 0.3.1 (APP_VERSION constants still say 0.3.0 — see §4).

Contents

1. Overview: module content vs generic engine
2. Content-category table (copies, canonical source, divergences to reconcile)
3. Per-file inventories (line ranges, shapes, consumers, hardcoded dependencies)
4. Constraints / invariants with refactor implications; versioning-ownership table
5. Appendix: every hardcoded branch on a domain key / item id / flag id, by file
6. Verdict on the Simulator
7. Top refactor risks and mitigations

---

## 1. Overview — what is module content and what is generic engine

The prototype is four single-file React apps (Clinician Screener, Ambient Scribe, Patient Companion, Simulator), one shared React panel (ResearchReadinessPanel), and two plain ES modules (MASQUE_Extraction.js, MASQUE_Probes.js). Every app closes over its own module-level copies of the instrument; nothing is imported from a common content source except the lexicon and probe set (Scribe only). The refactor's target is one **module definition** (the first one labelled "Dizziness" in the dropdown, carrying the MASQUE instrument 0.2) from which every app, every published artifact, the CSV template, the probe validator, the lexicon ids and the patient/Spanish wording maps derive — and a **generic engine + shell** that contains no branch on any domain key, item id, flag id, complaint value or brand string.

### 1.1 Module content (travels with "Dizziness"/MASQUE; a second module supplies its own)

| Group | What it is today | Where it lives (canonical copy) |
|---|---|---|
| Identity | module id/slug (`masque`), display name, dropdown label ("Dizziness"), index name ("MASQUE index"), icon (Stethoscope), app titles/subtitles per app, header/about/footer prose | Screener L1003-1006, Scribe L876-877, Patient UI.sub L381/L403, Simulator L443 |
| Instrument | ITEMS (6 domains, 30 items, weights, `{label,f}` scales, `ref` criteria), DOMAIN_ORDER, per-domain label/max/negative, item `ask` (physician phrasing), item `short` label, item `text`, VM-PATHI tags and info prompts | Screener L172-258; Scribe ASK L239-270, shortLabel L1168-1178, VMPATHI_TAG/INFO L272-282 |
| Scoring constants | BAND_CUTS {moderate 34, high 67}; scale assumptions (positive maxima sum 100, discriminators −29) | Screener L334 |
| Red flags | RED_FLAGS (12; tier emergent/urgent; group; text; points; action; `ask`; patient-safe `q`/`say`; Spanish overrides) | Screener L110-147 + Scribe `ask` + Patient L225-262/ES_RF L350-375 |
| Context items | c_clin / c_dur / c_dismiss with option vocabularies; §3.2 gap rule (3 markers, threshold 2) and its copy | Screener ContextQ L1190-1194 + gapFlags L872-878; Patient CONTEXT_Q L522-529 |
| Complaint / phenotype | vocabulary sinonasal / otologic / both; picker copy; Scribe derivation rules from items; domain activation rules; specialty and referral-reason per complaint | Screener L1072-1076, L1456, L1577; Scribe L770-783, L1259, L1311 |
| Routing / recommendations | ordered rule list (condition on band, complaint, domain pct/pts, item answer) with heading, body, instrument chips | Screener recs L891-952; Scribe buildRecs L1182-1193 |
| Steps | step list (keys, eyebrows, titles, subtitles, intros, which domain(s), extras such as complaint picker or context questions) | Screener STEPS L82-92 + JSX L1021-1117; Patient SECTIONS L531-541 + UI.sections; Simulator STEPS/STEP_DOMAIN L466-467 |
| Samples / demo | SAMPLE_CASES (4), DEMO_PATIENT, demo transcript(s), Simulator SCENARIOS and FULL_HIGH, research demo rows, synthetic cohort kinds | Screener L261-317; Scribe SCRIPT L566-581; Simulator L308-330, L677-681; RRP PROJECTS.MASQUE.demo L41-55 |
| FHIR identity | QUESTIONNAIRE_URL, Questionnaire name/title/publisher/description, code system `http://masque.example/codes`, answer system, criteria system, index code `masque-index` + display, CDS service id/title/description/prefetch/example cards/source, filename prefixes, screen_id prefix | Screener L80, L421-438, L447, L467, L476-517, L574, L1537 |
| Versions | INSTRUMENT_VERSION 0.2, LEXICON_VERSION 0.3.1 (+ NEGATION.window 14), PROBE_SET_VERSION 1.0.0, gold-set version 0.2.0 | Screener L45; Extraction L24/L45; Probes L290; goldset `_meta` |
| Lexicon | NEGATION / THIRD_PARTY / HISTORICAL cue sets and windows, BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES | Extraction L38-166 |
| Probes | PROBES + VM_PROBES (35), their `when` closures, targets, rescues, options | Probes L56-289 |
| Patient copy + locale | P (per-item q/opts/ask/help), BLURB per domain, SUM summary templates + rules, TIER-independent flag wording, Intro "for you if" bullets, pattern name; Spanish ES_P, ES_RF, BLURB_ES, UI.es, SUM.es; REVIEWED per locale | Patient L137-188, L297-502, L761-774 |
| Research config | PROJECTS.MASQUE (title, target, threshold, calibration midpoint/slope, sources, expected fields, demo rows), score-column aliases (`masque_score`), artifact key (`masqueArtifact`), ETL script name, proposal § citations; optional per-module fairness tolerance overrides (with attribution) | RRP L25-56, L197/L216, L864, L991 |
| Documentation | header comments, clinical rationale (Bárány/ICHD, VM-PATHI), confirmatory-instrument names (never their text) | all files |

### 1.2 Generic engine and shell (written once; parameterised by the module)

| Group | What it is today | Where it lives |
|---|---|---|
| Scoring arithmetic | scoreItem (factor-table), itemBounds (two-sided), useScore/computeScore (per-domain sums, clamp, floor/ceiling, coverage, scorable = same band at both ends, open items by \|w\|), bandFor given cuts | Screener L321-408 ≡ Scribe L284-333 |
| Gates | coverage gate (band only if range settles), safety gate (canContinue on safety step), scribe routing gate (!override && safetyReviewed), REQUIRE_SAFETY_REVIEW_TO_SIGN (site setting), ABSTAIN_FLOOR 0.55, §11 fairness deployment gate | Screener L880-888; Scribe L168, L847; RRP L115, L831-850 |
| FHIR builders | Questionnaire (groups from red flags + domains, answerOption codings, weight extension, criterion code), CDS discovery + three-state examples (notScorable → `{cards: []}`), data dictionary, QuestionnaireResponse/Observation/Flag/ServiceRequest/DocumentReference bundle with preliminary/final and dataAbsentReason semantics; standard HL7/UCUM systems | Screener L424-558, L1448-1591; Scribe L349-480, L1254-1316 |
| Cohort capture | canonical (non-item) column set, screenToCohortRow, rowsToCsv, downloadText/downloadJsonFile, subjectPseudonym + SITE_SALT/SALT_IS_DEFAULT (site config) | Screener L66-79, L572-625 |
| Extraction matcher | firstHit, allHits, cueBefore, negatedNear/thirdPartyNear/historicalNear (given a spec), extract pipeline (redflag pass ungated; bool via allHits; ctx/scale/multi via firstHit), faersToUtterances, EXTRACTOR_KIND | Extraction L25, L172-300 |
| Probe engine | PROBE_KIND (six tiers, ranks, colours, labels), liveProbes, validateProbes (structural + referential + phenotype-never-writes) | Probes L47-54, L301-345 |
| Research panel | normalizeRows (minus brand aliases), metrics, calibration, repeatMeasures, wilson/newcombe, fairness + verdicts, equityAdjustment, internalConsistency, fingerprint, dataQuality, FAIRNESS_POLICY defaults, all six tabs and sub-components | RRP L117-778, L780-1071 |
| Scribe ingestion | ingest (first-write-wins for items, overwrite ctx, raise-only red flags), suggestion ranking skeleton, probe answering, note skeleton (safety / subjective / screen / plan) | Scribe L728-831, L1195-1252 |
| Patient shell | locale accessor pattern (pFor/rfFor generalised), assertCoverage/assertLocales as validateModule, generic buildSummary core (clin list, unsureList, gap line from flagged options), askForm/list with locale-supplied transforms, summaryText, download, TIER colour table, LOCALE_NAMES, chrome copy | Patient L193-211, L509-520, L902-994, L1096-1133 |
| Layout / CSS / components | all four CSS blocks, band/tier colour maps, StepCard/QGroup/ContextQ/ResultView, Safety/QBlock/Summary/Intro, tabs, KPI tiles, toasts, footer prototype banner | all files |
| Answer conventions | boolean = `'yes'|'no'` strings, scale = numeric option index, undefined = unanswered (never imputed), Patient adds `'unsure'` (= unanswered); red flags `{id: true}` (screener) / `{id: 'nlp'|'md'|'probe'}` (scribe); band vocabulary low/moderate/high/indeterminate; tier vocabulary emergent/urgent (patient displays as now/soon) | everywhere |
| App version | APP_VERSION / RELEASE (single shell constant; currently 0.3.0 in code, 0.3.1 in README) | Screener L46, Scribe L151, Patient L55, Simulator L28 |

### 1.3 The three things that make the split non-trivial

1. **Copy and logic are fused.** The routing rules (Screener recs, Scribe buildRecs), the patient summary decision tree (Patient buildSummary L910-953 with SUM), the CDS examples and the referral strings are module *behaviour* written as inline JavaScript over literal item ids. They must become data-driven rule lists (predicates over `{band, complaint, domains[k].pct|pts, answers[id], ctx[id]}` plus templates) that a generic evaluator runs.
2. **Step ↔ domain coupling is implicit.** In every app the step key doubles as a domain key and the mapping lives in JSX (Screener L1086-1101; Patient L720/L726; Simulator STEP_DOMAIN + literal indices). The module must declare steps explicitly: `{kind: 'safety'|'domain'|'result'|'story', domainKeys[], extras[], eyebrow, title, sub, intro}` with safety first and mandatory.
3. **Vocabularies leak into the engine as literals.** Band names (`band !== 'low'`, interp map L/N/H, meter zones 33/33/34, ticks 0/34/67/100, dictionary text "< 34"), tier names (`tier === 'emergent'`, CSS `.tier.emergent`), complaint values (`complaint === 'otologic'`), the `'yes'` string, and the `c_`/`rf_` id prefixes (Scribe capLabel, Simulator heard). Keep band/tier/answer vocabularies fixed app-wide and derive every literal from BAND_CUTS; replace prefix parsing with `capture.kind`; move complaint branching into module rule data.

---

## 2. Content-category table

Canonical = the copy the module file should be extracted from (per the duplication audit). "Divergences" are every difference that must be reconciled before or during extraction; unresolved ones are decisions for the clinical lead, not the implementer.

| Category | Files holding a copy | Canonical | Divergences to reconcile |
|---|---|---|---|
| **Items** (ids, weights, scales, domains, text) | Screener L172-255; Scribe L48-131; Patient L63-124 (+P L137-188, ES_P L297-348); Simulator L31-74 | **Screener L172-255** (byte-identical to Scribe). Only form with `{label,f}` scale tables and `ref` citations. Lift Patient P/ES_P alongside as per-item patient wording; lift Scribe ASK (L239-270) and shortLabel (L1168-1178) as `ask`/`short` fields; VMPATHI_TAG (L272-277) as optional `tag`. | (a) Simulator: field `t` not `text`; scales are bare label arrays with **no `f` factors**; no `ref`; `discriminators.max` = 0 not −29; scale labels differ (m_head Never/Sometimes/Often vs None/Occasional/Frequent; m_dur "None/<4 h/4–72 h/>72 h/Varies" vs "No attacks/Under 4 h/4–72 h/Over 72 h/Varies"; v_vertigo "<5 min" vs "Under 5 min"; i_days "None" vs "0"). (b) Patient: field `c` (clinical text, same abbreviations as Simulator `t`), `scale` is an integer option count, no per-domain `max`, two domain labels (`label` patient-facing, `clinical`) — both currently unread. (c) Three parallel per-item maps in Scribe (text / ASK / shortLabel) must be folded into item fields. (d) Item `text` in Screener vs `t`/`c` abbreviations: pick Screener `text` as `text`, keep abbreviation as `short`. |
| **Domains** (order, label, max, negative) | Screener L257; Scribe L171; Patient L125; Simulator L75 | **Screener L257** — all four identical (six keys, same order). Become the ordered key list of `module.domains`. | Cosmetic only (spacing; Simulator names it ORDER). Simulator domain object uses `neg` in score output vs `negative`. Patient domain object carries `label` (patient) + `clinical`; Screener/Scribe carry `label` (clinical) only — module needs `label` and `patientLabel`. |
| **Scoring / bands** | BAND_CUTS: Screener L334, Scribe L292, Simulator CUTS L77; scoreItem/itemBounds/useScore: Screener L321-408, Scribe L284-333, Simulator L78-114; literals: Screener L528, L1216-1218, L1264; Scribe L453; Simulator L583, L589, L620 | **Screener L321-408** (cuts {34, 67} identical everywhere; Screener and Scribe scoring equivalent). Engine takes cuts + items from module; keep Screener itemBounds. | (a) **Simulator scoreItem is wrong**: linear `idx/(len-1)*w` instead of `w*scale[idx].f` — m_dur idx3 "Over 72 h" scores 3.0 vs 0.8, v_vertigo idx3 ">72 h" scores 6.0 vs 1.2 (awards full Bárány criterion-B points to an excluded duration). Do not carry forward. (b) Simulator has no itemBounds (uses raw w; equivalent only because every v0.2 scale has min f=0/max f=1). (c) Simulator band = bandFor(floor) vs bandFor(total) — equivalent when scorable. (d) Band range text "< 34 / 34–66 / ≥ 67", meter zones 33/33/34 and ticks 0/34/67/100 are re-typed literals in Screener, Scribe, Simulator — derive from cuts. (e) Screener useScore returns `count`, coverage from count; Scribe from ALL_ITEMS.length; Screener open items carry domainLabel. |
| **Red flags** | Screener L110-147; Scribe L186-235; Patient L225-262 (+TIER L263-272, ES_RF L350-375); Simulator L117-130; RF_PHRASES Extraction L153-166 | **Screener L110-147** (fullest text/points/action; ids, tiers, groups identical in Screener/Scribe/Simulator). Merge Scribe `ask`, Patient `q`/`say` + ES_RF, keep tier values emergent/urgent, map to now/soon for patient display. | (a) Scribe shortens text/points/action for 11 of 12 flags (rf_asym identical): e.g. rf_vision drops "or known papilloedema" and "/ IIH", rf_gca action drops "do not wait for biopsy", rf_orbital drops "or periorbital", rf_pulsatile points drops "dural AV fistula", rf_mass drops "nasal"/"cross-sectional", rf_systemic drops "unintended"/"known malignancy". (b) Simulator third variant with fields t/p/act: rf_focal "speech change, persistent diplopia", rf_gca drops "visual symptoms"/"rheumatology", rf_orbital drops "eye pain", rf_progressive drops "straining". (c) Patient renames tiers now/soon and deliberately omits group/points/action — module must carry two copy sets per flag (clinician points-to; patient-safe q/say) and the patient app must never render the clinician set. (d) Scribe `ask` field is never read in Scribe (probes supply phrasing) — decide keep or drop. (e) Screener RF_BY_ID unused. |
| **Samples / demo patients** | Screener SAMPLE_CASES L261-312, DEMO_PATIENT L314-317; Scribe PATIENT L584, SCRIPT L566-581; Simulator FULL_HIGH L308-312, SCENARIOS L314-330, COHORTS L677-681 + makeCohort L285-305, LINES L1019-1027; RRP PROJECTS.MASQUE.demo L41-55 | **Screener L261-317** for sample cases + demo patient (DEMO_PATIENT ≡ Scribe PATIENT, keeps "no DOB" comment); **Scribe SCRIPT** for the demo transcript; **RRP L41-55** for research demo rows; Simulator SCENARIOS/COHORTS are candidates to fold in as extra samples. | (a) Sample button labels ("Sample: sinus/dizziness/red flag/competing") and case keys are hardcoded in Screener JSX L994-997, not in SAMPLE_CASES — add `buttonLabel`. (b) Two different demo transcripts (Scribe 14 turns md/pt; Simulator 7 turns Patient/Doctor). (c) SCENARIOS hardcode `step: 6` and reference lucide icon components — module data must reference icons by name. (d) Only rf_asym is exercised by any sample/scenario. (e) Simulator has no demo patient. (f) RRP demo rows deliberately diverge sex vs gender and include a gender-only row (L54) — preserve. |
| **FHIR identifiers** | Screener L80, L421-422, L429-438, L447, L467, L476-517, L1468-1537; Scribe L169, L346-347, L354-363, L372, L392, L401-442, L1264-1304 | **Screener** for questionnaire URL / systems / CDS (byte-identical to Scribe); **Scribe buildBundle L1254-1316** as the bundle base (reports `floor` correctly) with the Screener's `!override` referral guard restored. | (a) `http://masque.example/codes` appears 8× as raw literal in Screener (447, 486, 1468, 1509, 1513, 1518, 1524, 1537) and 5× in Scribe; `/criteria` once each; buildBundle re-types `/answer` (Screener L1500, Scribe L1277) instead of ANSWER_SYSTEM — introduce `module.fhir.{codeSystem, criteriaSystem, answerSystem, indexCode, indexDisplay}`; WEIGHT_EXT may stay engine-stable. (b) Screener buildBundle omits `floor` (attainable-range low = total, L1526/L1549) — Scribe correct. (c) Referral gate: Screener `!override && scorable && band !== 'low'`; Scribe `routingCleared && …` with routingCleared defaulting true. (d) Scribe adds DocumentReference; reasonCode text differs ("(band)" vs "(band likelihood)"). (e) buildCdsHooks is 100% literal in both (L499 hand-copies rf_asym.action; example index 78) — violates the "generated from ITEMS" invariant; generate from module. (f) Data dictionary: Screener canonicalCohortFields include subject_id, visit_label, gender; Scribe lacks them; neither lists `complaint` though screenToCohortRow emits it. |
| **Versions** | INSTRUMENT_VERSION: Screener L45, Scribe L150, Patient L54, Simulator L27; APP_VERSION/RELEASE: Screener L46, Scribe L151, Patient L55, Simulator L28 (+ literal "0.3.0" L458); LEXICON_VERSION Extraction L24; PROBE_SET_VERSION Probes L290; RRP default modelVersion L792 | **Screener L45** (instrument, module-owned); APP_VERSION becomes one shell constant; lexicon/probe/gold-set versions stay in their module sub-objects. | (a) All APP_VERSION constants say 0.3.0; README/VERSIONS header say 0.3.1; VERSIONS table says 0.3.0; filenames say v0_3 — reconcile to one label. (b) Simulator footer hardcodes "0.3.0" instead of RELEASE. (c) RRP default modelVersion 'prototype-0.2' is stale. (d) Scribe buildNote L1236 hardcodes "Instrument v0.3 candidates" (a version literal outside the two constants; also in Simulator rail L1496/L1543 and Probes comments). (e) modelVersion strings 'masque-prototype-…' / 'masque-scribe-prototype-…' need a module id component. |
| **Lexicon** | Extraction L38-166 (NEGATION, THIRD_PARTY, HISTORICAL, BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES); Simulator CUES L1028-1040, NEG L1041; Scribe capLabel ctx map L1160 | **Extraction L38-166** (versioned 0.3.1, benchmarked, 24 items + 2 ctx + 12 flags, third-party/historical suppression). | (a) Simulator NEG has 6 of 14 cues, no THIRD_PARTY/HISTORICAL. (b) Simulator CUES covers 11 ids (none for 18 items, none for MULTI_EX r_dur/c_dur/c_clin), shorter phrase lists, and different scale mappings (m_head fixed v:1 vs bands→2 fallback 1; "couple of hours" mapped to v_vertigo v:2 in Simulator but to m_dur v=1 in Extraction L128). (c) Simulator has only rf_asym with 2 phrases. (d) NEGATION.window 14 was swept against this lexicon — travels with the module. (e) BOOL_EX phrases must be lowercase; band order in SCALE_EX is significant. |
| **Probes** | Probes L47-291; Simulator L1069-1312; Scribe kind-order list L1027 | **Probes L47-291** (exported, versioned 1.0.0, has validateProbes; Simulator comment names it source of truth). PROBE_KIND stays engine. | (a) PROBE_KIND + PROBES byte-identical; VM_PROBES identical code, comment differences only. (b) Simulator lacks PROBE_SET_VERSION, validateProbes, and liveProbes (re-implements selection inline L1350-1358). (c) Both Scribe (L1027) and Simulator (L1409) re-hardcode the kind order and per-kind captions/truncation rules — add `caption`, `truncate:false` to PROBE_KIND and export an ordered list. (d) Both display raw item id in "re-asking {rescues}" (Scribe L1044, Simulator L1432). (e) Truncation: Scribe slices non-safety/rescue to 2, Simulator to 3. (f) validateProbes does not check "rescue must have `rescues` and no `target`". |
| **Patient copy + locale** | Patient P L137-188, ES_P L297-348, ES_RF L350-375, UI L379-424, SUM L427-502, CONTEXT_Q L522-529, BLURB/BLURB_ES L761-774, REVIEWED L294, Intro/Safety/Summary JSX literals; Simulator PQ L879-890, PITEMS L891-921, ask rules L931-945 | **Patient file** throughout (complete 30-item, 12-flag bilingual coverage with load-time assertions). Simulator PITEMS is a 7-item subset with its own en/es fields. | (a) Not localised despite the locale system: Intro (declared without props, ignores t/loc), story heading/lede and recalcitrance intro (L705-721), Safety headings/buttons, CONTEXT_Q (English only), Summary thin text L1010, lede L1017, "Get seen today/this week" L1025, "Worth checking…" L1058, clinician paragraph L1067, disclaimer L1087, hardcoded Spanish "Traducción sin revisar" L685. (b) UI.thin and UI.notSureLede exist in both locales but are unused. (c) UI.sub and UI.sections mix shell chrome with module content — split. (d) Patient CONTEXT_Q option values differ from Screener/Scribe: c_clin "1/2/3+" vs "0-1/2/3+"; c_dur "<6mo/6-12mo/>12mo" vs "<3mo/3-12mo/>12mo" — align (gap rule matches on "3+" and ">12mo" in all three). (e) SUM keys are hand-wired to item ids; must become a rule table. (f) askForm English regex and list() conjunction branch on literal 'es'. (g) Clinician block appends localised `[opt]` despite the comment saying it stays English. (h) Simulator PQ.open unused. |
| **Research / fairness config** | RRP PROJECTS L24-107 (MASQUE L25-56, BREATHE L57-81, VOICED L82-106), FAIRNESS_POLICY L463-482, ABSTAIN_FLOOR L115, aliases L197/L216, artifact key L864, ETL name L991; Simulator POLICY L134, CFG L135 | **RRP L25-56** (module research config) and **RRP L463-482** (engine fairness defaults). PROJECTS is already a registry keyed by project and is the natural seed of the dropdown. | (a) Numbers match (minGroupN 30, minCellN 10, tol 0.10, z; midpoint 48, slope 0.075, threshold 0.5). (b) Simulator collapses three tolerances to one `tol`, lacks `confidence`, lacks toleranceSetBy/Rationale/SetOn provenance — replace with engine constant. (c) BREATHE/VOICED entries are sibling module configs for the panel only — keep as registry entries but do not claim they run on the shared engine. (d) Score aliases `masque_score|breathe_score|voiced_score` are brand-derived and duplicated at L197 and L216. (e) `parsed.masqueArtifact === 'population-estimates'` and `etl/masque_population_etl.R` are brand-named. (f) Fairness axes sex/gender hardcoded at L775, L823, L967 (VOICED's device/language never offered). (g) Proposal § citations (L425, L874, L893, L895, L925, L1003, L1050) cite one document. |
| **Scenarios / cohorts** | Simulator SCENARIOS L314-330, COHORTS L677-681, makeCohort L285-305; RRP demo rows L41-55; Screener SAMPLE_CASES | **RRP demo rows** for panel demo; **Screener SAMPLE_CASES** for screener; Simulator SCENARIOS/COHORTS have no counterpart elsewhere — see §6. | (a) COHORTS ids must match makeCohort branches; copy cites §3.2/§11. (b) makeCohort score ranges tuned to CFG.midpoint 48. (c) The gate-rehearsal set the docs require (full score, red-flag-same-index, competing, unlabeled cohort, single-positive-group cohort, sex/gender-divergent + sub-minimum stratum) is only fully present when Screener samples + RRP demo rows + Simulator cohorts are combined. |
| **Titles / brand strings** | Screener L1003-1006, L1137, L1243, L1005; Scribe L876-877, L922, L1141, L1210; Patient L381/L403, L463/L500, L753, L1067, L1123; Simulator L443-444, L458, L570; RRP L26, L798, L874, L895; console prefixes Screener/Scribe L557/Patient L209, L517/Probes L343 | No canonical — each is per-app copy; consolidate as `module.copy.{screenerTitle, screenerSubtitle, scribeSubtitle, patientSub, indexName, patternName, noteTitle, …}` plus shell-level "PROTOTYPE · not for clinical use" banner. | (a) RRP falls back to PROJECTS.MASQUE silently for any unknown `project` (L798). (b) RRP filenames derive from `project.toLowerCase()`. (c) Patient clinNote embeds "MASQUE" in both locales. (d) The prototype/illustrative caveat strings must move to the shell, not the module, so no module can drop them. |

---

## 3. Per-file inventories

Each section reproduces the inventory for one file: content blocks (module content or shell data), engine functions, UI components, and the hardcoded-dependency list. "MS" = module-specific.

### 3.1 `MASQUE_Screener_v0_3.jsx` (1591 lines)

**Imports:** React (useState, useMemo, useEffect); lucide-react (Stethoscope, Activity, ArrowRight, ArrowLeft, RotateCcw, ShieldCheck, TriangleAlert, ChevronDown, Copy, Check, Send, User, FileJson, Info, Plus, Download); `./ResearchReadinessPanel.jsx`.
**Exports:** `export default function MasqueScreener()` (L824) — only export; takes no props; owns all state. ITEMS, RED_FLAGS, builders, useScore are module-private.
**CSS:** root wrapper `.mq`/`.mq-wrap`; every other class unprefixed and global (.card, .btn, .opt, .rf, .pill, .meter, .dbar, .rec, .chip, .alert, .override, .capture, .safetybar, .code, .cds, .note, .toast, .disc, .foot, .about, .abgrid, .banner, .avatar, .badge, .gbtn, .brandrow, .mark, .rail, .seg, .eyebrow, .steptitle, .stepsub, .q, .qtext, .opts, .pick, .nav, .readout, .score, .scorecap, .scorerange, .openlist, .dtrack, .dfill, .dpts, .rfgroup, .tier, .num, .spacer, .chev); global `*{box-sizing}` L638, `:focus-visible` L801, reduced-motion L809. Injected via `<style>{CSS}</style>` at L978.

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| Header comment | 8-26 | doc | expands MASQUE acronym; names ENT/migraine/neuropathy; lists VM-PATHI, SNOT-22, DHI, HIT-6, ID Migraine; open-data sources | — | yes | move to module README |
| INSTRUMENT_VERSION | 45 | version | `"0.2"` | QUESTIONNAIRE_URL, buildQuestionnaire, buildDataDictionary, screenToCohortRow, L1141, ResultView L1407/L1413 | yes | comment L30-44: distinct from APP_VERSION; moves only when items/weights change |
| APP_VERSION | 46 | version | `"0.3.0"` | buildDataDictionary, screenToCohortRow, L1005, L1142 | no | README says 0.3.1 |
| SITE_SALT / SALT_IS_DEFAULT | 66-67 | site config | `"CHANGE-ME-PER-SITE"`; boolean | subjectPseudonym, ResultView L1381 | no | deliberately prototype-grade FNV-1a (L48-65) |
| QUESTIONNAIRE_URL | 80 | fhir | `` `http://masque.example/Questionnaire/masque-screener-v${INSTRUMENT_VERSION}` `` | buildQuestionnaire, buildDataDictionary, buildBundle | yes | |
| STEPS / LAST_STEP | 82-92 | steps | `Array<{key, title, eyebrow}>`: safety, intake, migraine, vestibular, neuro, impact, discriminators, result | rail L1012, stepKey L887, canContinue L888, step switch L1021-1117, nav L1127-1133, loadSample L856 | yes | step→domain mapping implicit in JSX; eyebrow numbers duplicated as JSX literals |
| RED_FLAGS | 110-147 | redFlags | `Array<{id 'rf_*', tier 'emergent'\|'urgent', group, text, points, action}>` ×12 | RF_BY_ID, RF_GROUPS, buildQuestionnaire, buildDataDictionary, activeFlags L880, safety step L1029-1045, buildBundle | yes | never scored (L94-109); tier drives CSS + branches L882/897/1230/1332/1561 |
| RF_BY_ID / RF_GROUPS | 148-149 | derived | Record by id; distinct groups in order | RF_GROUPS→L1029; RF_BY_ID unused | no | RF_BY_ID dead |
| ITEMS | 172-255 | items | `Record<domainKey,{label,max,negative?,items:[{id,w,text,scale?:[{label,f}],ref?}]}>`; recalcitrance 15/5 r_*, migraine 30/8 m_*, vestibular 25/6 v_*, neuro 15/5 n_*, impact 15/2 i_*, discriminators −29/4 x_* | ALL_ITEM_IDS, useScore, builders, screenToCohortRow, QGroup, recs L944, buildBundle | yes | positive maxima sum 100; weights within domain sum to max; `ref` emitted as FHIR criteria codes |
| DOMAIN_ORDER / ALL_ITEM_IDS | 257-258 | domains | six keys; flatMap of ids | useScore, builders, recs L909, ResultView L1289, buildBundle L1492/1508, panel itemIds L1140 | yes | |
| SAMPLE_CASES | 261-312 | samples | `Record<'sinonasal'\|'otologic'\|'redflag'\|'competing',{label, complaint, ctx:{c_clin,c_dur,c_dismiss}, rf?, a}>` | loadSample L848-858; buttons L994-997 | yes | button labels + keys hardcoded in JSX; only rf_asym used (L290) |
| DEMO_PATIENT | 314-317 | demoPatient | `{id 'masque-demo-1042', given, family, sex, gender, age, mrn, synthetic}` | useState L829, loadSample L853, banner L986-988, buildBundle, screenToCohortRow, panel | yes | no DOB by design; no SMART launch wiring |
| BAND_CUTS | 334 | bands | `{moderate: 34, high: 67}` | bandFor | yes | re-typed as literals L528, L1216-1218, L1264 |
| ANSWER_SYSTEM / WEIGHT_EXT | 421-422 | fhir | `http://masque.example/answer`; `…/StructureDefinition/item-weight` | buildQuestionnaire | yes | L1500 re-types answer URL; `/codes` (8×) and `/criteria` (L467) have no constant |
| buildQuestionnaire metadata | 429-438 | fhir | name 'MASQUEScreener'; title; publisher 'Project MASQUE — TOPx prototype'; description listing instruments; safety text L443 | buildQuestionnaire | yes | |
| buildCdsHooks body | 476-517 | fhir | discovery service id 'masque-screen', prefetch priorScreens with `masque-index`; example cards uuid 'masque-safety'/'masque-index', source {label 'Project MASQUE', url 'http://masque.example'}; notScorable `{cards: []}` | ResultView L1410 | yes | 100% literal; L499 duplicates rf_asym.action by hand |
| buildDataDictionary scoring + canonicalCohortFields | 525-547 | research | scoring {positiveMax 100, discriminatorMin: ITEMS.discriminators.max, bands text, rule}; 16 canonical fields incl. subject_id, visit_label, sex, gender | buildDataDictionary | partly | `complaint` column omitted; band type enumerates vocabulary |
| CSS | 629-810 | css | tokens --ink --petrol --petrol2 --surface --panel --line --muted --amber --amberbg --coral --coralbg --green --greenbg --slate --mono --sans | L978 | no | band/tier colours chosen in JS too |
| bandMeta | 865-870 | bands | `{low, moderate, high, indeterminate: {c, bg, label}}` | ResultView | no | labels generic; condition phrase appended L1255 |
| gapFlags / gapAlert | 872-878 | rule | three markers from ctx.c_clin==='3+', c_dur==='>12mo', c_dismiss==='yes'; alert ≥ 2 | ResultView L1299-1311 | yes | threshold literal |
| recs | 891-952 | rule+copy | override → incomplete → (sinus && strong) mid-facial migraine [SNOT-22, ID Migraine, HIT-6, MIDAS] → (oto && (strong \|\| vestibular.pct≥50)) vestibular migraine [VM-PATHI, DHI, MIDAS] → neuro.pct≥50 neuropathic [SFN-SIQ, COMPASS-31, Neurology] → v_aural==='yes' tinnitus [THI, TFI] → discriminators.pts<0 competing → default | ResultView L1316; buildBundle (unused) | yes | most module-coupled logic in file |
| Complaint picker | 1072-1076 | vocab+copy | `[{k:'sinonasal'\|'otologic'\|'both', h, d}]` inline JSX | intake step | yes | drives recs, CDS preview, buildBundle, samples, cohort column, panel phenotype |
| Step titles/subtitles/eyebrows | 1023-1027, 1068-1070, 1086, 1090-1094, 1098-1100 | uiCopy | per-step eyebrow/h2/sub/intro | step body | yes | move into STEPS |
| ContextQ rows | 1190-1194 | items | `[{id c_clin\|c_dur\|c_dismiss, t, opts:[[value,label]]}]`; values "0-1/2/3+", "<3mo/3-12mo/>12mo", "no/yes" | ContextQ, gapFlags, SAMPLE_CASES.ctx | yes | not scored, not in Questionnaire or cohort |
| zones | 1216-1218 | bands | `[{w:33},{w:33},{w:34}]` | meter L1259 | yes | derive from cuts |
| Meter ticks | 1264 | bands | 0/34/67/100 literals | ResultView | yes | |
| Result prose | 1226-1231, 1243, 1255, 1303-1308, 1331-1350, 1373-1391, 1404-1405, 1424-1430, 1432-1441 | uiCopy | override banner, "MASQUE index", band suffix, gap alert, CDS preview, pilot capture, salt warning, published spec, disclaimer, EMR details | ResultView | yes | pilot/salt/spec/EMR blocks generic apart from "MASQUE index" L1437 |
| Banner / brand / footer | 986-998, 1002-1008, 1144 | uiCopy | patient banner, sandbox badge, four sample buttons + Clear, "MASQUE Screener v…", subtitle, footer | root | yes | |
| Toasts | 857, 862, 963, 972, 1357 | uiCopy | "Sample case loaded", "Screen cleared", "Screen appended — N…", "FHIR bundle copied", "Written to chart (simulated)" | root, ResultView | no | |

#### Engine functions

| Function | Lines | Purpose | Reads content | Portable | Notes |
|---|---|---|---|---|---|
| subjectPseudonym | 69-79 | FNV-1a pseudonym `'s-'+16 hex` of salt::MRN | SITE_SALT | yes (salt param) | upgrade path HMAC-SHA-256 |
| scoreItem | 321-327 | scale → w·scale[v].f; bool → w if 'yes' | — | yes | encodes answer conventions |
| bandFor | 336-340 | 0-100 → high/moderate/low | BAND_CUTS | yes (cuts param) | band names baked in |
| itemBounds | 360-367 | min/max contribution incl. negative weights, non-monotone scales | — | yes | |
| useScore | 369-408 | per-domain {pts,max,pct,label,openPts,negative}; total clamp 0-100; floor/ceiling; coverage; scorable = same band; band or 'indeterminate'; open sorted by \|w\| | DOMAIN_ORDER, ITEMS, BAND_CUTS | yes | assumes positive maxima sum 100 |
| buildQuestionnaire | 424-472 | FHIR Questionnaire from RED_FLAGS + ITEMS | URL, versions, flags, items, systems | no | literal metadata and systems; `initialSelected:false` no-op L461 |
| buildCdsHooks | 474-519 | discovery + 3 examples | none | no | entirely literal |
| buildDataDictionary | 521-558 | JSON dictionary | URL, versions, ITEMS.discriminators.max, items, flags | no | L527 domain key; L528 band literals; L532 "MASQUE index" |
| screenToCohortRow | 572-606 | one canonical row + item columns | versions, salt, items | no | **BUG L585 `ctx` undefined → ReferenceError on capture**; screen_id prefix 'masque-' |
| rowsToCsv | 608-616 | union-of-keys CSV | — | yes | |
| downloadText / downloadJsonFile | 618-625 | blob download | — | yes | |
| fhirHtml | 813-820 | JSON → highlighted HTML | — | yes | dangerouslySetInnerHTML |
| loadSample | 848-858 | load SAMPLE_CASES entry, jump to LAST_STEP | samples, patient, LAST_STEP | yes | |
| reset | 859-863 | clear state | — | yes | |
| gapFlags/gapAlert | 872-878 | see content | ctx ids/values | no | |
| activeFlags/override/emergent/safetyDone/canContinue | 880-888 | red-flag state; gate safety on review, intake on complaint | RED_FLAGS, step keys | no | branches on 'safety','intake','emergent' |
| recs | 891-952 | routing rules | domains.vestibular/neuro/discriminators, ITEMS.discriminators.items, answers.v_aural, complaint, band | no | make data-driven |
| captureScreen/downloadCohort/copyBundle | 960-974 | append row; CSV 'masque-pilot-cohort-<date>.csv'; clipboard | — | mostly | ctx bug propagates |
| buildBundle | 1448-1591 | Flag ×n; QuestionnaireResponse; Observation (valueQuantity+interp or dataAbsentReason); ServiceRequest workup / referral | URL, DOMAIN_ORDER, ITEMS, complaint | no | specialty/referral branch on 'otologic' L1456/L1577; `/codes` literals; `recs` unused, `floor` not destructured (L1526 uses total) |

#### UI components

| Component | Lines | Purpose | Reads | Hardcoded text (selection) |
|---|---|---|---|---|
| MasqueScreener | 824-1150 | root; owns step, cohort, rf, safetyReviewed, patient, complaint, answers, ctx, showJson, toast, copied; renders banner, brand row, rail, step body, nav, panel, footer | STEPS, RED_FLAGS, RF_GROUPS, SAMPLE_CASES, DEMO_PATIENT, ITEMS, ALL_ITEM_IDS, versions, CSS | L866-869 band labels; L874-876 gap markers; L897-899 override rec; L906-910 incomplete rec; L918-948 six routing recs with chips; L966 filename; L988 banner; L993 badge; L994-998 sample buttons; L1005-1006 title/subtitle; L1023-1027 safety step; L1049-1059 safety copy; L1068-1075 intake + complaint options; L1086 recalcitrance intro; L1090-1094 four StepCards; L1098-1100 impact step; L1123-1133 nav; L1137 `project="MASQUE"`; L1142 modelVersion; L1144 footer |
| StepCard | 1154-1163 | eyebrow + h2 + sub + QGroup(dk) | ITEMS via QGroup | — |
| QGroup | 1165-1187 | render ITEMS[domainKey]; scale → option buttons (index); bool → No/Yes ('no'/'yes') | ITEMS | L1178 values; L1181 labels |
| ContextQ | 1189-1209 | three unscored context rows into ctx | inline rows | L1191-1193 questions/options |
| ResultView | 1211-1444 | override banner, readout + meter, outstanding list, domain bars, gap alert, recs, CDS preview, write-back, pilot capture (+salt), spec downloads, bundle view, disclaimer, EMR details; props incl. unused safetyReviewed, patient | DOMAIN_ORDER, SALT_IS_DEFAULT, INSTRUMENT_VERSION, builders, fhirHtml | L1221 eyebrow; L1226-1231 override; L1243 "MASQUE index"; L1247 "SCORE / 100"; L1255 band suffix; L1264 ticks; L1271-1281 outstanding; L1288; L1303-1307 gap alert (women with migraine); L1315; L1332-1348 CDS cards; L1355-1365 write-back; L1373-1396 pilot capture + salt; L1402-1413 spec filenames; L1426-1429 disclaimer (NHANES…); L1433-1439 EMR |

#### Hardcoded dependencies (Screener)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 45 | `INSTRUMENT_VERSION = "0.2"` | version | module.instrumentVersion |
| 46 | `APP_VERSION = "0.3.0"` | version | shell constant; README says 0.3.1 |
| 80 | questionnaire URL template | url | module.fhir.questionnaireUrl |
| 83 | STEPS keys safety/intake/migraine/vestibular/neuro/impact/discriminators/result | domain-key | module.steps with explicit kind/domainKey/extras |
| 315 | `id: "masque-demo-1042"` | brand | module.demoPatient |
| 334 | BAND_CUTS | other | module.bands.cuts; derive all literals |
| 337 | bandFor returns "high"/"moderate"/"low" | other | fixed app-wide vocabulary |
| 395 | clamp 0..100 | other | compute scale max from module domains |
| 421-422 | ANSWER_SYSTEM, WEIGHT_EXT | url | module.fhir.* |
| 429-436 | name/title/publisher/description | brand/condition | module.fhir.questionnaire* |
| 443 | safety group text | copy | generic copy table |
| 447, 467 | `/codes`, `/criteria` systems | url | module.fhir.codeSystem / criteriaSystem |
| 479-510 | CDS id, title, description, prefetch code, uuids, summaries, detail (rf_asym), source | brand/condition/url/flag-id | module.cds.*; generate examples from module |
| 527 | `ITEMS.discriminators.max` | domain-key | sum of negative domains |
| 528 | band text literals | other | derive from cuts |
| 532 | "MASQUE index at time of capture" | brand | `${indexName}` |
| 545 | band type enumeration | other | derive |
| 574 | screen_id `masque-` | brand | `${module.id}-` |
| 576 | version stamps | version | pass in |
| 585 | `ctx.visit_label` | **bug** | add ctx param; pass from captureScreen L961 |
| 602 | `v === "yes" ? 1 : 0` | other | app-wide convention |
| 830, 832 | complaint / ctx comments | condition/item-id | module.complaints, module.contextItems |
| 866 | bandMeta table | other | keyed by band vocabulary |
| 874-878 | gap markers + threshold | item-id | module.gapRule |
| 882 | `tier === "emergent"` (also 897, 1230, 1332, 1561, CSS) | other | app-wide tier vocabulary |
| 888 | `stepKey === "safety"` / `"intake"` | domain-key | step.kind / step.requires |
| 898 | override rec body | brand | module copy |
| 915-916 | `complaint === "sinonasal"\|"otologic"\|"both"` | condition | rule predicates |
| 918-948 | six rec headings/bodies/chips | condition | module.routingRules |
| 922, 927 | `domains.vestibular.pct >= 50`, `domains.neuro.pct >= 50` | domain-key | rule predicates |
| 934 | `answers.v_aural === "yes"` | item-id | rule predicate |
| 941-944 | `domains.discriminators.pts < 0`, `ITEMS.discriminators.items` | domain-key | iterate negative domains |
| 966 | cohort filename | brand | `${module.id}-pilot-cohort-` |
| 994-997 | loadSample keys + labels | other | render from module.sampleCases |
| 1003-1006 | Stethoscope icon, title, subtitle | brand/condition | module.icon, module.copy |
| 1023-1027, 1068-1070, 1098-1100 | step copy | condition/copy | module.steps |
| 1073-1075 | complaint options | condition | module.complaints |
| 1086, 1090-1094, 1101 | QGroup/StepCard domain keys + intros | domain-key | loop over module.steps |
| 1137, 1141 | `project="MASQUE"`, modelVersion | brand/version | module.name; `${module.id}-prototype-` |
| 1178 | Yes/No | copy | app copy table |
| 1191-1193 | ContextQ rows | item-id | module.contextItems |
| 1217, 1264 | zones, ticks | other | derive from cuts |
| 1231, 1243, 1437 | "MASQUE index" | brand | indexName |
| 1255, 1305 | band suffix, gap-alert body | condition | module.copy |
| 1334, 1344 | CDS preview summaries (1344 branches on complaint; 'both' → 'sinonasal') | brand/condition | module.cds |
| 1407-1413 | spec filenames | brand | `${module.id}-…` |
| 1428 | proposal sources list | brand | module.copy.disclaimer |
| 1450 | interp map L/N/H | other | band → v3 map |
| 1455 | `band !== "low"` (also 914, 1340) | other | lowest band |
| 1456, 1577 | specialty / referral reason by complaint | condition | module.referral |
| 1468-1537 | `/codes` literals; L1500 `/answer` literal; L1537 `masque-index` + display | url/brand | module.fhir.* |
| 1545, 1549 | `${band} likelihood`; note uses total not floor, "/100" | other | band label table; fix floor |
| 1580 | reasonCode "MASQUE index …" | brand | indexName |

**File notes.** Contract: no props; patient always DEMO_PATIENT. Refactored component needs a `module` prop and must reset answers/ctx/rf/complaint/step/cohort on module change (answer keys are item ids). Panel props: project, score, ceiling, scorable, band, domains, coverage, sex, gender, phenotype, redFlags (points strings), itemIds, capturedRows, instrumentVersion, modelVersion. Nothing parses id prefixes; membership resolved through ITEMS. Deliberate design to preserve: two version constants (L30-44); flags never scored, always override (L94-109); negative discriminators + two-sided range (L153-171, L342-359); no band while range straddles (L329-333, L1482-1491, L1540-1541); label/reference_diagnosis empty (L561-571); empty cards for not-scorable (L514-516); sex/gender separate (L537-538, L587); salt warning (L48-65, L1381); no DOB (L316); artifacts from same ITEMS (L411-419 — buildCdsHooks violates this). Bugs/dead code: ctx ReferenceError L585; RF_BY_ID unused; buildBundle ignores recs/floor; ResultView unused props; APP_VERSION drift; `initialSelected` no-op. English only; inline CSS with global class names.

### 3.2 `MASQUE_Scribe_v0_3.jsx` (1316 lines)

**Imports:** React (useState, useMemo, useEffect, useRef); lucide-react (Mic, Square, Play, Pause, RotateCcw, ArrowRight, ArrowLeft, Stethoscope, Activity, ShieldCheck, TriangleAlert, HelpCircle, Check, Copy, FileJson, FileText, Sparkles, User, MessageSquare, ChevronDown, Info, Plus, Download — Mic, Square, ArrowLeft, Stethoscope unused); `./ResearchReadinessPanel.jsx`; `{ extract, LEXICON_VERSION, RF_PHRASES }` from `./MASQUE_Extraction.js` (L8); `{ liveProbes, validateProbes, PROBE_KIND, PROBE_SET_VERSION }` from `./MASQUE_Probes.js` (L9).
**Exports:** `export default function MasqueScribe()` (L703) — only export; no props. ITEMS, RED_FLAGS, computeScore, builders are private copies ("shared with the screener" L27 means duplicated).
**CSS:** no prefix; root `.mq`; flat global classes (wrap banner avatar name meta badge(.live) dot spacer gbtn brandrow mark t1 t2 grid card chdr ct ce transport tbtn(.ghost) tsc row(.pt/.md) bub who cap captag rf(.on) box rt rm tier(.emergent/.urgent/.heard) override ot os oitem oact entry mini score readout pill covrow covtrack covfill dbar dl dtrack dfill dpts prompt qtag qq prow pbtn(.y/.n/.skip) alert at ap rec chips chip note code(.k/.s/.n) btnrow act(.ghost) notew toast empty foot details.about abgrid chev num); light theme only; breakpoint 820px; injected L857.

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| ITEMS | 48-131 | items | identical to Screener L172-255 (30 items; scaled: m_head, m_dur, v_vertigo, i_days, i_role) | ALL_ITEMS L172-174, computeScore L311/319, buildQuestionnaire L377, buildDataDictionary L452/471, screenToCohortRow L515, suggestions L796, buildNote L1200/1231, buildBundle L1272 | yes | header L29-47 rationale; positive-sum-100 relied on L323-325, L451 |
| INSTRUMENT_VERSION | 150 | version | `"0.2"` | URL L169, L353, L449, L498, filenames L1114/1116, panel L1145, footer L1148 | yes | L135-149 explains split; buildNote L1236 hardcodes "v0.3 candidates" |
| APP_VERSION | 151 | version | `"0.3.0"` | L449, L499, L876, L1146, L1148 | no | |
| REQUIRE_SAFETY_REVIEW_TO_SIGN | 168 | site policy | `true` | Sign button L1101-1105 | no | documented L153-167; shell setting |
| QUESTIONNAIRE_URL | 169 | fhir | same template as Screener | L352, L449, L1268 | yes | |
| DOMAIN_ORDER | 171 | domains | six keys | L172, L309, L375, L470, L514, L942, L1198/1231, L1271/1293 | yes | |
| ALL_ITEMS / ALL_ITEM_IDS / ITEM_BY_ID | 172-174 | derived | items with `domain`; ids; by-id map | L326, L562, L784, L1144, L1163, L1196 | no | loader helper |
| RED_FLAGS | 186-235 | redFlags | Screener shape + `ask` field; 12 flags | RF_BY_ID, L370, L478, L556, L562, L842, L993 | yes | `ask` never read; every id must have RF_PHRASES (L555-558) |
| RF_BY_ID | 236 | derived | | capLabel L1158 | no | |
| ASK | 239-270 | items | `Record<itemId, string>` physician question ×30 | suggestions L796 | yes | fold into item.ask |
| VMPATHI_TAG | 272-277 | items | `{v_motion, v_vertigo, v_head, m_photo}` → 'VM-PATHI · <domain>' | suggestions L790-791, L796 | yes | optional item.tag + boost rule |
| VMPATHI_INFO | 279-282 | items | `[{id 'vmp_cog'\|'vmp_affect', tag, ask}]` unscored | suggestions L800-801; buildNote L1202 | yes | answers in `vmp` state ('yes'/'no'/'skip'); gated on vestibular active |
| BAND_CUTS | 292 | bands | `{moderate 34, high 67}` | bandFor L293 | yes | duplicated as prose L453 |
| ANSWER_SYSTEM / WEIGHT_EXT | 346-347 | fhir | as Screener | L385, L391 | yes | L1277 re-types answer URL |
| buildQuestionnaire metadata | 354-363 | fhir | as Screener; `/codes` L372, `/criteria` L392 | | yes | |
| buildCdsHooks literal | 401-442 | fhir | byte-identical to Screener | L1115 | yes | notScorable `{cards: []}` invariant L439-440 |
| buildDataDictionary scoring + fields | 450-469 | research | scoring as Screener; canonical fields lack subject_id/visit_label/gender | | partly | omits complaint and item columns |
| SCRIPT | 566-581 | samples | `Array<['md'\|'pt', text]>` 14 turns | playback L743-744, stepOnce L751-752, buttons L887/889 | yes | tuned to lexicon + ctx cues |
| PATIENT | 584 | demoPatient | identical values to Screener DEMO_PATIENT | L755, L864-865, L850/1211, L851, L1142 | yes | buildNote uses `patient.sex[0]` |
| CSS | 588-692 | css | same token set as Screener | L857 | no | |
| complaint / pathway rules | 770-783 | rules | sin = r_abx\|r_surg==='yes' \|\| m_head answered; oto = any of v_vertigo/v_motion/v_aural/v_head answered && !== 'no'; base active {migraine, impact, recalcitrance, discriminators}; +vestibular if oto/both; +neuro if n_burn !== 'no' \|\| n_viral==='yes' | suggestions, buildRecs L849, cohort L755, buildBundle L1259/1311, panel L1142 | yes | default 'sinonasal'; make declarative phenotypes |
| bandMeta | 833 | bands | `{low 'Low', moderate 'Moderate', high 'High', indeterminate 'Not scorable'}` + colours | L925-932 | no | |
| gapFlags | 835-840 | rule | c_clin==='3+', c_dur==='>12mo', c_dismiss==='yes'; ≥2 | L951-956; buildNote L1232 | yes | same ids re-labelled at L1160 and L1204-1206 |
| probe kind order | 1027 | probes | `["safety","rescue","criteria","ruleout","phenotype","exam"]`; safety/rescue untruncated, others slice(0,2) | L1027-1064 | no | derive from PROBE_KIND |
| capLabel ctx map | 1160 | lexicon | `{c_dismiss 'prior dismissal', c_dur 'duration >12 mo', c_clin '3+ clinicians'}` | L903 | yes | |
| shortLabel map | 1168-1178 | lexicon | `Record<itemId, string>` ×30 | capLabel, buildNote | yes | third parallel map |
| buildRecs rules | 1182-1193 | rules+copy | same five rules as Screener (no override/incomplete/default) | L849, L1083-1092, L1246-1247 | yes | |
| buildNote template | 1209-1251 | uiCopy | "ENT ENCOUNTER — MASQUE ambient screen (DRAFT)", SAFETY REVIEW, SUBJECTIVE, Context, VM-PATHI domains, MASQUE SCREEN, SUPPORTING FEATURES AND EXAM, ASSESSMENT & PLAN | L850, L1098, L1100 | yes | skeleton generic |
| buildBundle literals | 1262-1313 | fhir | `/codes` L1264/1283/1294/1296/1299; `/answer` L1277; 'masque-index' + display; DocumentReference type/title; specialty map; referral text; interp map | | yes | |
| Header / banner / about / footer | 861-879, 1127, 1131-1148 | uiCopy | 'Ambient scribe · on-device', 'MASQUE Scribe v…', subtitle, VM-PATHI disclaimer, about paragraphs, footer version line | | yes | |

#### Engine functions

| Function | Lines | Purpose | Reads | Portable | Notes |
|---|---|---|---|---|---|
| scoreItem | 284-287 | as Screener | — | yes | |
| bandFor | 293 | as Screener | BAND_CUTS | yes (param) | |
| itemBounds | 298-305 | identical to Screener | — | yes | |
| computeScore | 306-333 | plain-function twin of useScore | DOMAIN_ORDER, ITEMS, ALL_ITEMS, cuts | yes | |
| buildQuestionnaire | 349-397 | as Screener | | no | literal metadata/systems |
| buildCdsHooks | 399-444 | as Screener | none | no | |
| buildDataDictionary | 446-480 | as Screener minus fields | ITEMS.discriminators L452 | no | |
| screenToCohortRow | 494-522 | row without subject_id/visit_label/gender | versions, items | no | 'masque-' prefix L496; complaint column L508 |
| rowsToCsv / downloadText / downloadJsonFile | 524-541 | identical | — | yes | |
| assertRedFlagCues IIFE | 555-558 | drift guard: every RED_FLAGS id has RF_PHRASES | RED_FLAGS, RF_PHRASES | yes | '[MASQUE scribe]' prefix; runs at import |
| validateProbes call | 562 | at import with ALL_ITEMS/RED_FLAGS | | yes | must run per module |
| fhirHtml | 694-699 | as Screener | — | yes | |
| ingest | 728-738 | extract on 'pt' turns; item first-write-wins; ctx overwrite; redflag → 'nlp' never downgrading 'md'/'probe'; drops capture.kind at L737 | extract | yes | |
| stepOnce/reset/submitInput/captureScreen | 750-768 | transport; captureScreen references activeFlags/complaint declared later | SCRIPT, PATIENT | yes | ordering caveat |
| complaint memo | 770-774 | phenotype from item answers | r_abx, r_surg, m_head, v_vertigo, v_motion, v_aural, v_head | no | |
| suggestions memo | 780-803 | rank unanswered: active pathway → VM-PATHI tag → weight; top 4; +2 info prompts when vestibular; pool widens when unscorable | ALL_ITEMS, ASK, VMPATHI_*, n_burn, n_viral | no | output {id, ask, tag, scale?, kind 'scored'\|'info'} |
| probes memo | 813 | liveProbes(answers, rf, probeAns) | import | yes | |
| answerProbe | 815-822 | option may raise rf ('probe'), merge answers, mark asked, append note | — | yes | |
| answerPrompt / skipPrompt | 824-831 | info → vmp; scored → answers; **skip writes 'no'** | — | yes | contradicts unanswered ≠ denial |
| capLabel | 1157-1166 | tag label; branches on `startsWith('rf_')` / `startsWith('c_')` | RF_BY_ID, ITEM_BY_ID, shortLabel | no | use capture.kind |
| shortLabel | 1167-1180 | | inline map | no | |
| buildRecs | 1182-1193 | | vestibular, neuro, discriminators, v_aural | no | |
| buildNote | 1195-1252 | draft note | ALL_ITEMS, DOMAIN_ORDER, ITEMS, VMPATHI_INFO, shortLabel, ctx ids | no | |
| buildBundle | 1254-1316 | as Screener + DocumentReference; uses floor; routingCleared gate | URL, DOMAIN_ORDER, ITEMS, complaint | no | |

#### UI

`MasqueScribe` (L703-1153): single page; left transcript card (play/step/reset, typed input, capture tags); right live readout, coverage, domain bars, gap alert, override, safety-outstanding alert, four tabs (safety / prompts / note / fhir), disclaimer; About details; panel; footer; toast. State: transcript, cursor, playing, answers, ctx, vmp, asked (written, never read), cohort, rf (id → 'nlp'|'md'|'probe'), safetyReviewed, probeAns, probeNotes, input, view, toast. Hardcoded text: L865 banner; L869-870 badges; L876-877 title/subtitle; L884-894 transport; L899 roles; L913 placeholder; L917; L922 "MASQUE index"; L931-935 band/coverage; L954 gap alert; L960-962 override; L974-975 safety outstanding; L982-986 tab labels; L992; L1000-1001; L1009; L1020-1021; L1035-1037 kind suffixes; L1044 raw item id "re-asking {id}"; L1058-1059; L1069; L1075-1078 Yes/No/Skip; L1100-1105 note buttons + sign gate copy; L1112-1116 cohort/spec buttons; L1121-1122; L1127 VM-PATHI disclaimer; L1132-1137 about; L1148 footer with four versions; toasts L756, L763, L1100, L1103, L1121, L1122.

#### Hardcoded dependencies (Scribe)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 8-9 | imports from MASQUE_Extraction.js / MASQUE_Probes.js | brand | import generic engine; module supplies lexicon + probes |
| 150-151 | versions | version | module.instrumentVersion; shell APP_VERSION |
| 169 | questionnaire URL | url | module.fhir |
| 171 | DOMAIN_ORDER | domain-key | module.domainOrder |
| 346-347, 372, 392 | systems | url | module.fhir.* |
| 354-361 | Questionnaire metadata | brand/condition | module.fhir |
| 404-436 | CDS literals | brand/condition/url | module.cds |
| 452 | `ITEMS.discriminators.max` | domain-key | negative domains |
| 453, 457 | band text; "MASQUE index" | other/brand | derive; indexName |
| 496, 508 | 'masque-' prefix; complaint column | brand/condition | module.slug; rename `phenotype` |
| 557 | console prefix | brand | generic |
| 566 | SCRIPT | condition | module.demo.transcript |
| 584 | PATIENT id | brand | module.demo.patient |
| 703 | MasqueScribe name | brand | Scribe({module}) |
| 771-773 | complaint rules on r_abx/r_surg/m_head/v_* | item-id/condition | module.phenotypes[].triggerItems |
| 781-783 | base active set; 'vestibular'; n_burn/n_viral → 'neuro' | domain-key/item-id | module.alwaysActiveDomains; activation rules |
| 786, 790, 796, 800 | vestActive; VMPATHI_TAG boost; `it.domain === "vestibular"` special-case; info prompts gate | domain-key | item.tag + gate config; per-domain shortTag |
| 836-840 | gap markers + threshold | item-id | module.contextFlags |
| 844 | `tier === "emergent"` (also 1000, 637 CSS, 1215, 1306) | flag-id | app-wide tier vocab |
| 876-877, 922 | title, subtitle, "MASQUE index" | brand/condition | module.copy |
| 954 | gap alert copy | copy | module.copy |
| 1027, 1035-1037 | kind order + suffix copy | other | PROBE_KIND |
| 1044 | raw `pr.rescues` | item-id | shortLabel lookup |
| 1113-1116 | filenames | brand | module.slug |
| 1127, 1134-1136 | VM-PATHI / MASQUE prose | condition/brand | module.copy |
| 1141-1142, 1146 | project, phenotype, modelVersion | brand/condition | module.name; module.slug |
| 1148 | footer four versions | version | read from module |
| 1158-1160 | `startsWith('rf_')`, `startsWith('c_')`, ctx label map | flag-id/item-id | branch on capture.kind; module.contextFlags |
| 1168-1178 | shortLabel ×30 | item-id | item.short |
| 1185-1191 | buildRecs predicates + copy (complaint, vestibular.pct, neuro.pct, v_aural, discriminators.pts) | condition/domain-key/item-id | module.recommendationRules |
| 1202 | `.replace("VM-PATHI · ","")` | condition | store tag prefix separately |
| 1204-1206 | ctx note labels | item-id | module.contextFlags[].noteLabel |
| 1210, 1224, 1226, 1228, 1236, 1240, 1248 | note headings/phrases (incl. "v0.3 candidates" version literal) | condition/brand/version | module.copy |
| 1211 | `patient.sex[0]` | other | guard empty |
| 1256 | interp map | other | engine band map |
| 1259, 1311 | specialty / referral reason by complaint | condition | module.phenotypes[].referral* |
| 1264-1299 | `/codes`, `/answer` literals; 'masque-index' + display | url/brand | module.fhir |
| 1303-1304 | DocumentReference type/title | condition/brand | module.copy |
| 1313 | reasonCode | brand | indexName |

**File notes.** Two import-time side effects (L555-558, L562) must re-run per selected module. Answer convention: `'yes'|'no'` strings, numeric scale index, undefined never imputed — except skipPrompt writes 'no' (L830) and `answers[id] !== 0` at L1196 treats scale index 0 as negative. rf state is provenance ('nlp'|'md'|'probe'; comment L712 lists only two); clicking a flag in the Safety tab toggles it including deleting an 'nlp' one (L996) — "raise only" applies to capture/probes, not the clinician. routingCleared = !override && safetyReviewed (L847) gates recs, referral and the rec block; REQUIRE_SAFETY_REVIEW_TO_SIGN gates Sign only. Deliberate design markers: version split L135-149; sign gate L153-167; flags raise-only L176-185/L733-735/L818; band withheld L288-297; empty cards L439-441; empty labels L483-493; no FHIR answer element for never-asked L1269-1270; dataAbsentReason L1285-1286; no DOB L583; safety/rescue never truncated L1030/L1059. Sibling contracts: extract(text) → [{kind, id, value}]; liveProbes(answers, rf, probeAns) → probes {id, kind, say, why, rescues?, opts:[{l, rf?, a?, note?}]}; PROBE_KIND[kind] = {label, c}; panel props as Screener.

### 3.3 `MASQUE_Patient_v0_3.jsx` (1133 lines)

**Imports:** React (useMemo, useState); lucide-react (ArrowLeft, ArrowRight, Check, Printer, Download, TriangleAlert, ShieldCheck, HelpCircle, MessageSquareQuote, Stethoscope, Info, RotateCcw, ClipboardList — all used).
**Exports:** `export default function MasquePatient()` (L644) — only export; no props.
**CSS:** prefix `.mp` (every rule scoped); tokens --ink --muted --line --panel --bg --petrol --petrol2 --coral --coralbg --amber --amberbg --green --greenbg --mono; classes wrap top logo tt ts prog stepof card lede q qt qh opts o(.sel .no .unsure .wide) flag(.on) box ft tier call ct say sl nav btn(.ghost) sum ask unsure clin disc foot noprint; print, 520px and reduced-motion media queries; injected L668. No URLs, no FHIR, no score/band/probability, no research capture (deliberate, header L23-41).

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| INSTRUMENT_VERSION | 54 | version | `"0.2"` | footer L753, Summary L1067, summaryText L1119 | yes | |
| APP_VERSION | 55 | version | `"0.3.0"` | L753, L1123 | no | |
| ITEMS | 63-124 | items | `Record<domainKey,{label (patient), clinical, negative?, items:[{id, w, c, scale?: number}]}>` 30 items; scale counts m_head 3, m_dur 5, v_vertigo 4, i_days 4, i_role 4 | assertCoverage L201, QBlock L864, buildSummary L964 | yes | label/clinical never read; weights only for sort/sign; no score |
| DOMAIN_ORDER | 125 | domains | six keys | L200, L963 | yes | |
| P | 137-188 | patientCopy | `Record<itemId,{q, opts?, ask?, help?}>` ×30; ask on r_normal, m_dur, v_migfeat, n_auto, x_*; help on x_purulent/x_objective/x_lowfreq | pFor, assertCoverage, assertLocales, buildSummary L960 (key order = unsure-list order), askForm, QBlock | yes | English is structural source of truth (L190-192) |
| RED_FLAGS | 225-262 | redFlags | `[{id, tier 'now'\|'soon', q, say}]` ×12; no points/differential by design (L217-220) | assertLocales L513, L654, Safety L821 | yes | |
| TIER | 263-272 | shell | `{now, soon: {label, color 'var(--coral)', bg, what}}` | Safety L828/837-838, Summary L1023-1024 | no | label/what dead (UI supersedes); consumers branch on literal "now" |
| REVIEWED | 294 | locale | `{en: true, es: false}` | L685 glyph only | yes | banner gated by UI[loc].reviewBanner non-null |
| LOCALE_NAMES | 295 | locale | `{en 'English', es 'Español'}` | L679 | no | buttons from Object.keys(UI) |
| ES_P | 297-348 | locale | P shape in Spanish ×30 | pFor, assertLocales | yes | |
| ES_RF | 350-375 | locale | `Record<rfId,{q, say}>` ×12 | rfFor, assertLocales | yes | |
| UI | 379-424 | uiCopy | per locale: title, sub, step, of, back, next, start, seeSummary, sections[9], yes, no, unsure, tierNow, tierSoon, tierNowWhat, tierSoonWhat, sayThis, print, download, startOver, reviewBanner\|null, summaryTitle, openWith, describe, askAbout, notSure, notSureLede, forClinician, thinTitle, thin, txtSeenToday, txtSeenWeek, txtSay, txtClinNote, txtFooter, txtUnreviewed, fileName | assertLocales, L651, L677, sub-components, summaryText | mixed | `sub` and `sections` are module content; thin/notSureLede unused |
| SUM | 427-502 | patientCopy | per locale: dur, abx, surg, normal, lesion; headFreq(n); durTypical; migWith(l); migWords{m_photo,m_nausea,m_disable,m_aura,m_trig,m_fhx}; vertigo(t); vertigoT[4]; vCount; vMig; vAlso(l); vWords{v_motion,v_aural,v_head}; neuro(l); nWords{n_*}; days(t); daysT[4]; role(t); roleT[4]; disc(l); dWords{x_*}; askMig, askBoth, askVest, askRefer, askNeuro, askNormal; askDisc(l); dShort{x_*}; askTried, askNext; gap(many,longTime,dismissed); clinNote(v) | buildSummary L903, summaryText L1097/1119 | yes | hand-wired to ids; clinNote embeds "MASQUE" |
| CONTEXT_Q | 522-529 | items | `[{id, q (English), opts:[[value,label]]}]`: c_clin "1/2/3+", c_dur "<6mo/6-12mo/>12mo", c_dismiss "no/yes" | L709, buildSummary L955-957 | yes | **not localised**; values differ from Screener/Scribe |
| SECTIONS / LAST | 531-542 | steps | `[{key,title}]` ×9: intro, safety, story, migraine, vestibular, neuro, impact, discriminators, summary | L653, L542, L692-693, L738, L747 | yes | title dead; UI.sections index-aligned; recalcitrance folded into story L720 |
| CSS | 546-640 | css | | L668 | no | |
| BLURB_ES / BLURB | 761-774 | patientCopy | per domain (migraine, vestibular, neuro, impact, discriminators) lede | L729 | yes | declared after export (no TDZ); no recalcitrance entry |

#### Engine functions

| Function | Lines | Purpose | Reads | Portable | Notes |
|---|---|---|---|---|---|
| pFor | 193 | `locale==='es' ? {...P[id], ...ES_P[id]} : P[id]` | P, ES_P | no | literal 'es' |
| rfFor | 194 | merge ES_RF over flag | ES_RF | no | |
| assertCoverage IIFE | 198-211 | every item has P entry; scale opts length === scale; non-scale has no opts; '[MASQUE patient]' | DOMAIN_ORDER, ITEMS, P | yes | → validateModule |
| assertLocales IIFE | 509-520 | per `[['es', ES_P, ES_RF]]`: ids, opts lengths, flags, UI keys, SUM keys | P, ES_P, ES_RF, RED_FLAGS, UI, SUM | yes | tuple list hardcoded L510 |
| buildSummary | 902-975 | said / ask / gapLine / unsureList / clin; L910-953 decision tree over literal ids with magic indices (mDur===2, vDur===2, mHead>0) and thresholds (mig≥2, neu≥2, gap≥2) | SUM, P, DOMAIN_ORDER, ITEMS, pFor, list | no | only clin loop L962-972 and unsureList L960 generic |
| askForm | 981-986 | unsure → question; es: '.'→'?'; en regex I've→Have I, I→Do I | pFor | no | locale transform |
| list | 988-994 | joiner 'y' (no Oxford) / 'and' (Oxford) | — | no | locale property |
| summaryText | 1096-1125 | plain-text export; footer `MASQUE v${APP_VERSION}` | SUM, UI, versions | no | default `t = UI.en` |
| download | 1127-1133 | blob download | — | yes | |

#### UI

| Component | Lines | Purpose | Hardcoded text |
|---|---|---|---|
| MasquePatient | 644-759 | state sec, a (id → 'yes'\|'no'\|'unsure'\|number), ctx, rf, safetyDone, loc; header + locale toggle, review banner, progress, section switch, nav, footer | L685 "Traducción sin revisar"; L705-707 story heading/lede; L721 recalcitrance intro; L753-754 footer "MASQUE patient companion v… · instrument v…" |
| Intro | 776-809 | landing card; declared with no props though called with t/loc | L779-804 all English incl. condition names L787-788 |
| Safety | 811-861 | checklist, tier call-out, "None of these apply to me" | L815-818, L839, L849, L855 |
| QBlock | 863-893 | items of ITEMS[domain]; scale → opts buttons; else Yes/No/Not sure | — |
| Summary | 996-1094 | thin warning, red-flag call-out, gap line, describe/ask/unsure lists, clinician list, print/download/reset, disclaimer | L1010-1012 (dup of unused t.thin); L1017-1018; L1025 "Get seen today/this week"; L1058 (dup of unused t.notSureLede); L1067-1069 "MASQUE instrument v… migrainous/neuropathic pattern"; L1087-1089 disclaimer |

#### Hardcoded dependencies (Patient)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 7 | header comment | brand | rewrite |
| 54-55 | versions | version | module / shell |
| 193-194 | `locale === "es"` merges | locale | module.locales[locale] |
| 209, 517 | console prefixes | brand | neutral |
| 265, 269 | TIER colours → CSS vars | other | shell tier config with CSS |
| 381, 403 | UI.sub names MASQUE + condition | brand | module.ui[loc].sub |
| 383, 405 | UI.sections index-aligned domain titles | domain-key | derive from domain patientLabel + shell titles |
| 437-457 | migWords, vWords, nWords, dWords, dShort | item-id | summary-rules data |
| 463, 500 | clinNote "MASQUE instrument v…" | brand | template with module name |
| 510 | `[["es", ES_P, ES_RF]]` | locale | iterate module.locales |
| 523 | CONTEXT_Q ids/values | item-id | data-driven gap rule; align values |
| 532-535 | SECTIONS keys | domain-key | build from module.steps |
| 644 | MasquePatient | brand | PatientCompanion({module}) |
| 650 | default 'en' | locale | config |
| 655, 829, 837-841, 1023-1025 | `tier === "now"` / ternaries | flag-id | tier rank / urgent flag |
| 656 | `key === "safety"` gate | other | shell step kind |
| 685 | Spanish heading literal | locale | UI[loc].reviewBannerTitle |
| 697 | Intro ignores props | other | wire t/loc |
| 705-706, 779, 815-817, 849, 855, 1017, 1087 | English chrome | locale | UI copy |
| 720 | `<QBlock domain="recalcitrance" intro="…">` | domain-key | module.storyDomain + intro per locale |
| 726 | `["migraine","vestibular","neuro","impact","discriminators"].includes(key)` | domain-key | `key in ITEMS` |
| 729 | `(loc === "es" ? BLURB_ES : BLURB)[key]` | locale | module.locales[loc].blurbs |
| 753 | footer | brand | module.name |
| 787-788 | "for you if" bullets | condition | module bullets |
| 910-914 | r_dur/r_abx/r_surg/r_normal/r_lesion → SUM | item-id | rule table |
| 916-918 | m_head, m_dur; `mHead > 0`, `mDur === 2` | item-id | rule table (index semantics) |
| 919-920 | mig group [m_photo, m_nausea, m_disable, m_aura, m_trig, m_fhx], ≥2 | item-id | feature group |
| 922-926 | v_vertigo (vertigoT index; `vDur === 2`), v_count, v_migfeat, [v_motion, v_aural, v_head] | item-id | rule table |
| 929 | neu group [n_*], ≥2 | item-id | feature group |
| 932-934 | i_days, i_role → daysT/roleT | item-id | rule table |
| 936 | disc group [x_*] | item-id | negative-domain items |
| 940-941 | migPattern, vestPattern | item-id | module rules |
| 945-953 | ask tree (askBoth/askMig/askVest/askRefer/askNeuro/askNormal/askDisc/askTried/askNext) | condition/item-id | module rules |
| 955-957 | gapCount on c_clin '3+', c_dur '>12mo', c_dismiss 'yes' | item-id | option `signal: true` |
| 960 | unsureList order = P key order | other | use domain/item order |
| 984-985, 989-992 | askForm / list locale branches | locale | locale-supplied transforms |
| 1010, 1058 | duplicate English of unused t.thin / t.notSureLede | locale | use t keys |
| 1067 | clinician paragraph | brand/condition | module pattern name; localise |
| 1096 | `t = UI.en` default | locale | require t |
| 1119, 1123 | versions / "MASQUE v…" footer | version/brand | module + app |

**File notes.** Answer model: scale index 0 = "none" (skipped in clinician list L967, `> 0` checks); SUM.vertigoT/daysT/roleT keep "" at index 0; m_dur===2 and v_vertigo===2 are criterion-positive. Domain key === step key === ITEMS key. Locale buttons from Object.keys(UI); adding a locale means UI, SUM, LOCALE_NAMES, REVIEWED and the L510 tuple. Suggested split (from inventory): module = { id, name, instrumentVersion, items, domainOrder, storyDomain + storyIntro, redFlags, contextQuestions, patientCopy (P), blurbs, summaryRules (data replacing SUM + L910-953), ui overrides {sub, domain titles, patternName, forYouIf}, locales: { es: { items, redFlags, blurbs, ui, sum, reviewed: false } } }; shell = { APP_VERSION, TIER with localised labels, CSS, LOCALE_NAMES, chrome strings, pFor/rfFor generalised, validateModule, generic buildSummary core, askForm/list with locale transforms, summaryText, download, components }.

### 3.4 `ResearchReadinessPanel.jsx` (1071 lines)

**Imports:** React (useMemo, useRef, useState); lucide-react (Activity, BarChart3, Check, ChevronDown, ClipboardCheck, Copy, Database, Download, FileJson, Gauge, Info, Scale, ShieldCheck, TriangleAlert, Upload — Check, ChevronDown, Info, TriangleAlert unused).
**Exports:** `export default function ResearchReadinessPanel({...})` (L780) — only export. Shared by six prototypes (MASQUE, VOICED, BREATHE …).
**CSS:** prefix `rrp-` (L109-112); fixed light palette #0C2B2F #0F5C61 #137A80 #D7E1DF #5C6E6C #B26C1F #A93124 #2C7A57; one 650px breakpoint; injected L882.
**Already domain-agnostic:** no ITEMS/DOMAIN_ORDER; never branches on a domain key, item id or flag id; domains arrive pre-shaped via `domains` prop, item ids via `itemIds`, reverse-scored exclusion delegated to host.

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| PROJECTS | 24-107 | research | `Record<'MASQUE'\|'BREATHE'\|'VOICED', {title, target, threshold, calibration:{midpoint, slope}, sources:[[name,purpose]], expected:string[], demo:[rows]}>` | L798 `PROJECTS[project] \|\| PROJECTS.MASQUE`; cfg used at L808-809, 855, 874, 883, 893, 909-913 and by metrics/calibration/population/fairness/equityAdjustment/dataQuality | yes | already a partial module registry; lacks id/label, score alias, artifact key, ETL name, versions, citations, policy overrides |
| PROJECTS.MASQUE | 25-56 | research | title 'MASQUE research & deployment readiness'; target 'masked migrainous / neuropathic driver'; threshold 0.5; calibration {48, 0.075}; 8 sources (NHANES, NHIS, MEPS, CMS PUF / DE-SynPUF, HCUPnet, openFDA / FAERS, CDC WONDER / BRFSS, All of Us); expected [score, label, sex, gender, age, weight, annual_cost, avoidable_cost]; 9 demo rows | | yes | demo rows diverge sex vs gender; L54 gender-only row (L48-51) |
| PROJECTS.BREATHE / VOICED | 57-81 / 82-106 | research | same shape; VOICED expected adds device/language/accent | | yes | sibling module configs (panel only) |
| CSS | 109-112 | css | | L882 | no | |
| ABSTAIN_FLOOR | 115 | policy | 0.55 | L819, L879, L898 | no | engine constant |
| Alias table (normalizeRows) | 194-226 | mapping | score ← score\|masque_score\|breathe_score\|voiced_score\|index (L197, L216); label ← label\|reference_label\|outcome\|target; weight ← weight\|survey_weight; annual_cost ← annual_cost\|total_cost\|expenditure; avoidable_cost ← avoidable_cost\|misdirected_cost; sex ← sex\|sex_at_birth\|birth_sex; gender ← gender\|gender_identity; subject_id ← subject_id\|subjectId\|participant_id; captured_at ← captured_at\|capturedAt\|timestamp; + [SRC] presence map | L800, L868, L913, L914 | score aliases only | take `scoreAliases` from module |
| SRC | 164 | sentinel | `'__srcPresent'` | normalizeRows, fingerprint, dataQuality | no | |
| Bin edges | 322 | policy | [0, .2, .4, .6, .8, 1.0001] | calibration | no | |
| FAIRNESS_POLICY | 463-482 | policy | {minGroupN 30, minCellN 10, selectionGapTolerance .10, sensitivityGapTolerance .10, specificityGapTolerance .10, confidence .95, z 1.959963985, toleranceStatus 'placeholder — requires clinical sign-off and citation', toleranceSetBy null, toleranceRationale null, toleranceSetOn null} | metrics L248, calibration, repeatMeasures, equityAdjustment, wRate, fairness, L828/873/874, L958/961/983 | no (per-module override allowed with attribution) | L471-481 |
| TOLERANCE_ATTRIBUTED | 483 | policy | `!!(setBy && rationale)` | L987 | no | |
| Confidence blend | 814-816 | policy | coverage 0.72 + signalQuality 0.28 only when non-null | L814 | no | L810-813 |
| Default props | 780-797 | contract | score 0, band 'low', domains {}, coverage 0, sex null, gender null, signalQuality null, scorable true, ceiling null, phenotype '', modelVersion 'prototype-0.2', redFlags [], itemIds [], capturedRows [], instrumentVersion null | | partly | band 'low' assumption; stale version |
| Manifest literal | 874 | artifact | project, modelVersion, instrumentVersion, generatedAt, provenance{fingerprint, deterministic:true}, target, calibration{…status 'illustrative—replace after validation'}, requiredCanonicalFields, acceptedFormats, sourceAdapters, missingDataPolicy, fairnessPolicy{…prespecified:true, passRule, suppressionRule}, equityMitigation{status 'not implemented'…}, deploymentGate{rule (§11), scope 'The rule-based MASQUE index is not gated.', …}, fairnessAudit, cohortState | L913, L879, L993 | one brand string + § citations | |
| Model card literal | 879 | artifact | intendedUse, currentPatientOutput{…abstainFloor, abstain…}, knownLimitations[7], fairnessAxis, safety{redFlags, decisionRule} | L993 | no | presumes per-module proposal |
| Tab list | 885 | uiCopy | risk, data, validation, fairness, population, model | | no | |
| Stratification axes | 775-776, 823, 827, 967 | policy | 'sex' / 'gender' literals; default axis 'sex' L533/L648/L824 | dataQuality, fairness, equityAdjustment, tab | no (could be module-declared) | |
| Artifact discriminator + ETL | 864, 991, 804 | brand | `parsed.masqueArtifact === 'population-estimates'`; `etl/masque_population_etl.R` | loadFile, population tab | yes | module.research.artifactKey / etlScript |
| Proposal citations | 425, 874, 893, 895, 925, 1003, 1050 | uiCopy | §7.1, §7.2, §8, §11 | | yes | module-supplied or dropped |

#### Engine functions (all portable unless noted)

logistic 117-119 (cfg.calibration param); clamp 120; pct 121; money 122 (en-US/USD literal); num 123; downloadJson 124-128; parseCsv 129-145; coerce 146-151; isAbsent/anyPresent 165-166; numOrNull 167-174 (never 0); binaryOrNull 175-178; weightOf 179 (default 1 at compute time only); isLabeled 180; strOrNull 182-192; **normalizeRows 194-226 (not portable only for brand score aliases)**; auc 227-233; metrics 234-256 (reads FAIRNESS_POLICY global — pass policy in); ciText 257; calibration 284-342 (CITL, Newton slope 60 iters, 5-bin reliability with suppression); repeatMeasures 357-389; weightedMean 391-401; population 433-441; wilson 487-493; splitKey 526-531 (FNV-1a subject hash); equityAdjustment 533-598 (level up to best group, dev/holdout split, never applied); newcombeDiff 600-607; wRate 616-625 (Kish n); gapOf 626-635; verdictOf 636-641 (PASS/FAIL/INCONCLUSIVE/NOT ASSESSABLE); fairness 648-690; variance 705-709; pearson 710-716; internalConsistency 717-742 (caller excludes reverse-scored items, L701-703); fingerprint 752-758 (accepts cfg, ignores it); dataQuality 760-778 (axes sex/gender literal).

#### UI

| Component | Lines | Purpose | Hardcoded text |
|---|---|---|---|
| ResearchReadinessPanel | 780-997 | six tabs; owns tab, rows, sourceName, error, popArtifact, axis | cfg.title L883; 'model {modelVersion}' badge; 'Model rejected on this cohort (§11)' L893; 'The MASQUE index above is unaffected…' + 'Proposal §11 commits…' L895; 'Screen positive/negative for {cfg.target}' L855; 'Not scorable — attainable range spans a band cutpoint' L854; `${project}-ingestion-manifest.json` L913; 'reference_diagnosis column' L915; 'Internal consistency (proposal §8)' L925; '…specified in the {project} proposal' L943; 'run etl/masque_population_etl.R…' + 'Final NHANES/NHIS/MEPS estimates…' L991; `${project}-model-card.json` / `-provenance.json` L993; manifest scope/rule L874; Stratify buttons 'sex'/'gender' L967-972 |
| PopulationArtifact | 409-431 | render-only offline estimates artifact | 'Narrower than proposal §7.1.' L425; labels; clear button |
| MitigationBlock | 998-1027 | equityAdjustment display | '…(§7.2)' L1003; 'Equal sensitivity' L1008 |
| CalibrationBlock | 1029-1052 | calibration display | '§7.2 promises a calibrated classifier…' L1050 |
| RepeatBlock | 1054-1069 | repeat measures display | 'No row carries a subject_id… Screens captured by the screener carry one' L1055 |
| K | 1071 | KPI tile | — |

#### Hardcoded dependencies (Panel)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 8 | comment "for MASQUE, VOICED, and BREATHE" | brand | reword |
| 25-27, 29, 31, 40, 41 | PROJECTS.MASQUE key, title, target, calibration, sources, expected, demo | brand/condition/other | module.research.* |
| 57, 82 | BREATHE / VOICED entries | brand | own descriptors |
| 122 | Intl en-US/USD | locale | from module/app locale |
| 197, 216 | `masque_score`, `breathe_score`, `voiced_score` (duplicated) | brand | module.research.scoreAliases; single array |
| 264, 349, 696, 804, 845 | comments citing §7.2/§5.1/VM-PATHI/ETL/"MASQUE index" | condition/brand | comments only |
| 533, 648 | default axis 'sex' | other | module-declared axes |
| 775, 967 | axes literals | other | module.research.fairnessAxes |
| 783 | `band = "low"` default | other | module bands or null |
| 792 | `modelVersion = "prototype-0.2"` | version | from module/app |
| 798 | fallback to PROJECTS.MASQUE | brand | require module; fail loudly |
| 855 | `Screen positive for ${cfg.target}` | condition | already content-driven; keep |
| 864 | `parsed.masqueArtifact` | brand | module.research.artifactKey |
| 874 | manifest scope 'rule-based MASQUE index'; §11 rule text | brand | interpolate module.name |
| 879 | "proposal-specified validated instruments" | other | optional module limitations |
| 893, 925, 1003, 1050, 425 | § citations | other | module or drop |
| 895 | "The MASQUE index above is unaffected…" | brand | `${module.name} index` |
| 913, 993 | filenames from `project` | brand | module.id |
| 915, 1055 | reference_diagnosis / subject_id contract prose | other | keep consistent with capture schema |
| 943 | "{project} proposal" | brand | module.name |
| 991 | ETL script path; NHANES/NHIS/MEPS | url | module.research.etlScript; sources |

**File notes.** Prop contract: project (string key; unknown → MASQUE), score 0-100, band, domains `Record<key,{label?,pct?,pts?,max?}>` (pct computed pts/max·100 when absent, L820), coverage, sex/gender (echoed only), signalQuality (null = questionnaire-only; must stay null for MASQUE), scorable (false forces abstention L817-819), ceiling, phenotype, modelVersion, redFlags (any → Decision 'OVERRIDE', joined ' · ' L899), itemIds (Cronbach columns), capturedRows (via normalizeRows; need score, optional subject_id/captured_at, item columns, reference_diagnosis), instrumentVersion. No callbacks. Ordering: FAIRNESS_POLICY (L463) read at module-eval by TOLERANCE_ATTRIBUTED (L483) and as default params — keep defined before any eval-time reader if moved. Deliberate behaviours to preserve: absent never zero (L152-163); sex/gender independent, never `sex ?? gender` (L202-207); subject_id pseudonym + captured_at ordering (L208-211, L352-355); [SRC] map distinguishes absent column from unparsable (L212-224, L763-768); PASS requires whole CI under tolerance, small groups suppressed with n shown (L442-461); §11 gate withholds probability/decision only, never the index (L831-850); equity adjustment is threshold adjustment, levelled UP, deterministic split, never applied (L496-524); PopulationArtifact render-only (L402-408, L862-867); demo rows exercise suppression (L48-51); no signal-quality credit when null (L810-816). English only; no i18n.

### 3.5 `MASQUE_Simulator.jsx` (1550 lines)

**Imports:** React (useMemo, useState); lucide-react (Activity, TriangleAlert, ShieldCheck, Check, ArrowLeft, ArrowRight, Stethoscope, FlaskConical, Users, FileText, Info, RotateCcw, Play, Zap, Ban, ScanLine).
**Exports:** `export default function MasqueSim()` (L434) — only export; owns `app` state ('screener'|'panel'|'patient'|'scribe'); sub-components take no props (Items {domain,a,set}; K {label,value,detail,color}).
**CSS:** root scope `.mq`, every rule `.mq .x`; inner names unprefixed (wrap head logo vers tabs tab grid card eyebrow sub q qt opts o(.no .sel) btn(.ghost) nav readout cap score range sp meter z needle rband ticks pill call(.warn .bad) rf(.on) box rft rfm tier(.emergent .urgent) gname kpis k kl kv kd table small rail probe(.on) pl pw verdict steps st(.on .done) foot code); tokens on .mq; 880px and reduced-motion queries; light only. Injected L438.
**Role (header L7-25):** single-file standalone demo of all four apps + panel with inline copies of instrument, red flags, probes, a condensed lexicon and synthetic cohorts. Header says release 0.3.0 and "three MASQUE apps" while rendering four tabs; states "The probe rail is not in the real apps"; omits FHIR bundle/questionnaire construction, full lexicon, cohort CSV export, model card JSON, population artifact renderer (no masque.example URLs anywhere).

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| Header comment | 7-25 | doc | FAITHFUL vs CONDENSED vs simulator-only | — | yes | |
| INSTRUMENT_VERSION | 27 | version | `"0.2"` | L444 | yes | prose "v0.2" at L1183/1198/1204 comments, L1496/L1543 JSX |
| RELEASE | 28 | version | `"0.3.0"` | L444 | no | footer L458 hardcodes "0.3.0" |
| ITEMS | 31-74 | items | `Record<domainKey,{label,max,negative?,items:[{id,w,t,scale?: string[]}]}>`; 30 items; **no `f` factors, no `ref`; discriminators.max 0** | ALL L76, useScore L95-102, Screener L543-544, Items L662, Scribe via ALL | yes | max declared, not computed |
| ORDER | 75 | domains | six keys | ALL, useScore L93, table L625 | yes | |
| ALL | 76 | derived | items with `domain` | L108, L1469, L1479, L1483 | no | |
| CUTS | 77 | bands | `{moderate 34, high 67}` | bandFor L78 | yes | literals at L583 (33/33/34), L589 (0/34/67/100), L620 ("below 34") |
| RED_FLAGS | 117-130 | redFlags | `[{id, tier, group, t, p, act}]` ×12 | RF_GROUPS, Screener L477-516/566-567/613, Scribe L1343/1478/1487/1501, CUES L1039, PROBES, SCENARIOS L326 | yes | third wording variant |
| RF_GROUPS | 131 | derived | | L505 | no | |
| POLICY | 134 | fairness | `{minGroupN 30, minCellN 10, tol .10, z}` | wilson, fairness, calibration, equityAdjust, Panel | shared default | single `tol`; no provenance |
| CFG | 135 | research | `{midpoint 48, slope .075, threshold .5}` | logistic, fairness, equityAdjust | yes | |
| FULL_HIGH | 308-312 | samples | answers ×30 | SCENARIOS | yes | |
| SCENARIOS | 314-330 | scenarios | `[{id, icon (lucide component), label, why, apply: () => {answers, rf, safety, step}}]` ×5: empty, partial (v_* only), high, redflag (rf_asym), ruleout (x_objective/x_purulent/x_anosmia) | rail L649-654, runProbe L483 | yes | simulator-only; `step: 6` hardcoded |
| CSS | 333-424 | css | | L438 | no | |
| STEPS | 466 | steps | `["Safety","Intake","Migrainous","Vestibular","Neuropathic","Impact","Result"]` | L496 | yes | labels don't read ITEMS |
| STEP_DOMAIN | 467 | steps | `{2: migraine, 3: vestibular, 4: neuro, 5: impact}` | L541-549 | yes | steps 0/1/6 literal; discriminators appended to 5 (L550-552) |
| Screener band meta | 487-490 | bands | `{low, moderate, high, indeterminate: {c, bg, l}}` | L575-580 | no | |
| COHORTS | 677-681 | samples | `[{id 'balanced'\|'unlabeled'\|'disparate', label, why}]` | Panel L717, L863-868 | yes | ids match makeCohort; cites §3.2/§11 |
| PQ | 879-890 | locale | `{en, es: {title, lede, yes, no, unsure, summary, open, describe, ask, notsure, thin, banner}}` | Patient L926-981 | no | `open` unused; es.banner = unreviewed warning |
| PITEMS | 891-921 | patientCopy | `[{id, en, es, sEn, sEs, askEn?, askEs?}]` ×7: r_dur, r_abx, r_normal, m_photo, m_nausea, m_trig, x_objective | Patient L929-983 | yes | |
| Patient ask rules | 931-945 | patientCopy | mig = yes count of [m_photo, m_nausea, m_trig]; disc = x_objective; conditional en/es questions on r_normal, r_abx | L979-980 | yes | rules + copy interleaved |
| LINES | 1019-1027 | demo | `[{s 'Patient'\|'Doctor', t}]` ×7 | Scribe L1325-1326, L1383-1390 | yes | |
| CUES | 1028-1040 | lexicon | `[{id, v, rf?, ph[]}]` ×11 incl. c_dismiss and rf_asym | advance L1328-1334, heard L1340 | yes | condensed subset |
| NEG | 1041 | lexicon | 6 English cues | L1333 | no (language) | 14-char window literal L1332 |
| PROBE_KIND | 1069-1076 | probes | identical to Probes.js | L1357, L1411-1427, L1431, L1456 | no | kind list re-hardcoded L1409 |
| PROBES | 1078-1165 | probes | identical to Probes.js (18) | ALL_PROBES | yes | |
| VM_PROBES | 1214-1310 | probes | identical code (14 here per inventory count; comment differences) | ALL_PROBES | yes | L1169-1172 names Probes.js as source of truth |
| ALL_PROBES | 1312 | derived | | Scribe L1350 | no | |
| Screener step copy | 501-504, 534-536, 545-551 | uiCopy | masked migraine/neuropathy, §7.1, Bárány, ICHD-3, "Recalcitrance", "Discriminators — negative weight" | | yes | |
| Screener result / CDS copy | 570, 573, 610-621 | uiCopy | "MASQUE index", CDS card text, referral "Headache medicine / Neuro-otology", "standard ENT management", "below 34" | | yes | |
| App header/footer | 443-444, 448-449, 458 | uiCopy | "Project MASQUE — working simulation"; tab tuples; "Condensed from the 0.3.0 release" | | yes | |
| Panel copy | 706-712, 735-736, 743-746, 754-755, 771-773, 788-789, 798, 807-815, 821-824, 844-849 | uiCopy | generic audit prose + §7.2/§11/§3.2 | | no | |
| Patient rail | 992-1013 | uiCopy | three "What to notice" cards | | yes | L1003-1004 name migraine/rule-out |
| Scribe kind captions | 1413-1420 | uiCopy | per kind | | no | |
| Scribe notes/flags/rail | 1399-1401, 1493-1497, 1500-1505, 1511-1547 | uiCopy | five rail cards naming ringing, vestibular migraine, Bárány, v0.2/v0.3, Dix–Hallpike, osmophobia, carsickness, "Episode count is worth 4 points" | | yes | |

#### Engine functions

| Function | Lines | Purpose | Reads | Portable | Notes |
|---|---|---|---|---|---|
| bandFor | 78 | | CUTS | yes | |
| scoreItem | 80-84 | **linear** idx/(len−1)·w | — | yes but wrong | do not carry forward |
| useScore | 89-114 | as Screener; domains {pts,max,label,openPts,neg}; band = bandFor(floor) | ORDER, ITEMS, ALL, CUTS | yes | no itemBounds (raw w at L97) |
| logistic | 136 | | CFG | yes | |
| isLabeled | 137 | | — | yes | |
| normalize | 141-150 | no-imputation canonical row; drops item columns | — | yes | schema/axes literal |
| wilson | 151-156 | | POLICY.z | yes | |
| newcombe | 165-172 | signed bounds (L157-164 deliberate) | — | yes | |
| fairness | 174-208 | as panel, verdict literals | POLICY, CFG | yes | |
| calibration | 210-239 | | POLICY, CFG | yes | |
| equityAdjust | 241-271 | level UP (L257) | POLICY, CFG | yes | |
| makeCohort | 285-305 | deterministic LCG cohorts balanced/unlabeled/disparate | — | yes | simulator-only; ranges tuned to midpoint 48; L274-284 rationale |
| pct | 426 | | — | yes | |
| Screener.set/runProbe/reset | 481-485 | toggle; scenario loader | SCENARIOS | yes | |
| Scribe.advance | 1324-1337 | next line; earliest phrase hit per cue; rf ungated; 14-char look-behind; first hit wins | LINES, CUES, NEG | yes | |
| Scribe.heard/answers/live | 1339-1358 | captures → answers excluding rf and `startsWith("c_")`; manual overlay; live probes sorted by rank | ALL_PROBES, PROBE_KIND | no | prefix convention L1340; rescue probes stay live (L1353-1355) |
| Scribe.answerProbe/reset | 1360-1369 | | — | yes | |

#### UI

MasqueSim 434-463 (title L443, version line L444, four tabs L448-449, footer L458). Screener 469-659 (7 steps; safety L502-504; Recalcitrance L535-537; domain intros L546-547 by step index; discriminators L550-552; "MASQUE index" L570; "SCORE / 100" L573; zones L583; ticks L589; CDS L611-620; band labels L487-490; "Drive at the refusals" L647). Items 661-674 (Yes/No L670-671). K 427-431. Panel 683-876 (schema list L710-712/738; axes L783-786; §7.2 L772; §11 L807/814; tabs quality/validation/fairness/mitigation L727-729). Patient 923-1016 (English/Español L955; "⚠︎ Traducción sin revisar." L958; ask questions L934-945; "No score, no band…" L987-988; rail L997-1010). Scribe 1314-1550 ("Ambient capture · simulated" L1378; L1400-1401; kind captions L1413-1420; L1457; notes explainer L1493-1497; red-flag copy L1500-1502; rail L1516-1544; "RED FLAG:" L1478/1487).

#### Hardcoded dependencies (Simulator)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 7 | header | brand | |
| 27-28 | versions | version | module / shell; single-source footer L458 |
| 75, 77-78 | ORDER, CUTS, band names | domain-key/other | module; derive L583/589/620; names also L111, 487-490, 614, 616 |
| 308 | FULL_HIGH | item-id | module.samples |
| 316-329 | SCENARIOS copy, labels, v_* answers, rf_asym, x_* answers, `step:6` | condition/domain-key/item-id/flag-id/other | module.scenarios; derive result step |
| 397-398 | `.tier.emergent/.urgent` CSS | flag-id | fixed tier vocab |
| 443-444, 458 | title, version line, footer | brand/version | |
| 466-467 | STEPS, STEP_DOMAIN | domain-key | module.steps |
| 480, 499, 532, 550, 556, 637, 640 | step index literals | other | data-driven step kinds |
| 504, 535-537, 546-547, 550, 552 | safety copy, "Recalcitrance", §7.1, domain intros, discriminators | condition/domain-key | module.steps / domain intro |
| 570, 573 | "MASQUE index", "SCORE / 100" | brand/other | indexName; scale max |
| 583, 589, 620 | zones, ticks, "below 34" | other | derive |
| 612, 614, 616-619 | CDS copy; `band !== "low"`; `band === "high"`; referral; "standard ENT management" | brand/other/condition | module.copy / referral |
| 678-680 | COHORTS | other | module.cohorts |
| 685, 689-690, 784 | axes | other | configurable |
| 710, 738, 145-148 | canonical schema | other | single-source |
| 772, 807, 814 | § citations | other | |
| 892-915 | PITEMS ids | item-id | module.patientItems |
| 931-943 | ask rules on m_photo/m_nausea/m_trig, x_objective, r_normal, r_abx + en/es copy | item-id/condition | module.patientAskRules |
| 954, 958 | locale list; Spanish banner label | locale | PQ keys; PQ.es |
| 1004 | "the migraine question" | condition | module rail copy |
| 1020-1026 | LINES | condition | module.demoTranscript |
| 1029-1039 | CUES ids | item-id | module.lexicon |
| 1041 | NEG | locale | engine per language |
| 1080-1164 | PROBES whens/targets/rf ids | item-id/flag-id | module.probes (import) |
| 1169 | duplication comment | brand | import instead |
| 1216-1304 | VM_PROBES rescues/whens/writes | item-id | module.probes |
| 1332 | 14-char window | other | engine param |
| 1340 | `!c.id.startsWith("c_")` | item-id | explicit `context:true` or membership test |
| 1400, 1494-1497, 1517-1544 | rail/notes copy | condition | module copy |
| 1409, 1413-1420, 1422, 1454 | kind order, captions, truncation (cap 3) | other | PROBE_KIND caption/truncate |
| 1432 | raw `p.rescues` | item-id | item label |

**File notes.** Capabilities not in the dedicated apps: (1) scenario probe rail; (2) tabbed shell combining all four apps; (3) makeCohort + COHORTS picker instead of CSV; (4) LINES stepping with condensed CUES/NEG; (5) static "What to notice" rails. Absent here: FHIR builders, full lexicon, CSV export, model card, population artifact. Answer conventions as the other apps (Patient adds 'unsure'; Scribe negated cue → 'no'; rf `{id:true}` in Screener, `{id:'nlp'|'probe'}` in Scribe). Deliberate decisions marked: coverage gate/two-sided range L86-88; no-imputation L139-140; Newcombe signed bounds L157-164; cohort sizes/Math.imul L274-284; level UP L257; probe ranking L1043-1068; rescue semantics L1198-1202/L1353-1355; phenotype zero L1204-1210; flags never cleared L1501-1502; FAIL-only gate L813-815; safety/rescue never truncated L1422/L1454-1458. SCENARIOS reference lucide icon components directly — module data must name icons.

### 3.6 `MASQUE_Extraction.js` (300 lines)

Plain ES module — no React, no JSX, no CSS, no imports, **no default export**. Exports: LEXICON_VERSION, EXTRACTOR_KIND, NEGATION, THIRD_PARTY, HISTORICAL, BOOL_EX, CTX_EX, SCALE_EX, MULTI_EX, RF_PHRASES, firstHit, allHits, negatedNear, extract, faersToUtterances. Non-exported: cueBefore L197, thirdPartyNear L204, historicalNear L205. External consumers (verified by grep): Scribe L8 `{ extract, LEXICON_VERSION, RF_PHRASES }` (drift guard L556; footer L1148); MASQUE_Extraction_Benchmark.mjs L25 `{ extract, LEXICON_VERSION, EXTRACTOR_KIND, NEGATION, RF_PHRASES }` (isRf = id in RF_PHRASES; sweeps opts.negationWindow; records lexiconVersion/extractorKind). Uses ES2020 `??`/`?.` (L218, L241, L285, L287, L289).

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| LEXICON_VERSION | 24 | version | `"0.3.1"` | Scribe footer; benchmark L116/L225 | yes | module.extraction.lexiconVersion |
| EXTRACTOR_KIND | 25 | version | `"rule-based / phrase-match with local negation"` | benchmark L116/L226 | no | engine |
| NEGATION | 38-48 | lexicon | `{window: 14, cues: [14 lowercase English cues: 'no ', 'not ', "n't", 'never', 'without', 'none', "haven't", "hasn't", "didn't", "don't", "doesn't", "isn't", 'denies', 'negative for']}` | negatedNear L202-203, extract L218, benchmark sweep (L183) | yes | window 14 swept against THIS lexicon (L39-44: "the optimum moves with the lexicon") — per-module with English default |
| THIRD_PARTY | 57-62 | lexicon | `{window: 34, cues: [15: 'my mother','my mom','my father','my dad','my sister','my brother','my daughter','my son','my wife','my husband','my partner','her ','his ','they get','runs in']}` | thirdPartyNear L204, gated() L226 | yes | 'her '/'his ' very broad; window not swept |
| HISTORICAL | 69-73 | lexicon | `{window: 30, cues: [8: 'used to','years ago','as a teenager','when i was young','back then','no longer','stopped getting',"haven't had that in"]}` | historicalNear L205, gated() L227 | yes | |
| BOOL_EX | 79-106 | lexicon | `[{id, ph[], thirdPartyExempt?}]` ×24: m_photo, m_nausea, m_disable, m_aura, m_trig, m_fhx (**only thirdPartyExempt: true**, L85), v_motion, v_aural, v_head, n_burn, n_otalgia, n_auto, n_viral, n_allo, r_abx, r_surg, r_normal, r_lesion, v_count, v_migfeat, x_purulent, x_objective, x_lowfreq, x_anosmia | extract L237-244 → {id, value 'yes'\|'no', kind 'item'} | yes | phrases must be lowercase; comments L98/L101 encode module scoring assumptions |
| CTX_EX | 108-110 | lexicon | `[{id 'c_dismiss', val 'yes', ph[6]}]` | extract L246-250 → kind 'ctx' | yes | negated → skipped (no 'no') |
| SCALE_EX | 112-134 | lexicon | `[{id, cue[], bands:[{ph[], v}], fallback}]` ×5: m_head (bands [v2], fallback 1); v_vertigo (bands v1, v3, v2; fallback null); m_dur (bands v2, v3, v1; fallback null); i_days (no bands, fallback 3); i_role (no bands, fallback 3) | extract L252-259 → numeric value | yes | **band order significant** (first band in array order whose phrases hit anywhere wins, L256); bands not proximity- or negation-checked; fallback null = leave unanswered (L115-117) |
| MULTI_EX | 136-141 | lexicon | `[{ids:[{id, value, kind}], ph[]}]` ×2: [{r_dur,'yes','item'},{c_dur,'>12mo','ctx'}] on chronicity; [{c_clin,'3+','ctx'}] on multiple-clinician | extract L261-265 | yes | ctx values must match module context options exactly |
| RF_PHRASES | 153-166 | redFlags | `Record<rfId, string[]>` ×12 | extract L232-235 → {id, value true, kind 'redflag'} ungated; Scribe drift guard L556; benchmark isRf L35 | yes | keys must equal module RED_FLAGS ids; no-gating policy (L143-151, L231) is engine |

#### Engine functions

| Function | Lines | Purpose | Reads | Portable | Notes |
|---|---|---|---|---|---|
| firstHit | 172-176 | index of first phrase **in list order** found as lowercase substring; −1 | — | yes | ordering affects negation checks for CTX/SCALE/MULTI |
| allHits | 187-195 | every match position of every phrase, sorted | — | yes | lets BOOL_EX prefer any unnegated mention (L178-185) |
| cueBefore | 197-200 | backward window check with `{window, cues}` spec | — | yes | already module-injectable shape; not exported |
| negatedNear | 202-203 | window overridable, cues from NEGATION global | NEGATION | no | inject spec |
| thirdPartyNear / historicalNear | 204-205 | | THIRD_PARTY / HISTORICAL | no | inject spec |
| extract | 217-268 | `extract(text, {negationWindow?, includeSuppressed?}) → [{id, value, kind, evidence (whole text), cueIndex, suppressedBy?: 'third-party'\|'historical'}]`; order: RF (ungated, value true) → BOOL (allHits; first unnegated → 'yes' else 'no'; gated unless thirdPartyExempt) → CTX (firstHit; skip if negated; gated) → SCALE (cue firstHit; skip if negated; first band hit anywhere else fallback; null skipped; gated) → MULTI (firstHit; skip if negated; each target gated); gating order third-party then historical | all 8 content constants | no (globals only) | zero branching on any id; only per-entry flag is thirdPartyExempt (L243). Target: `extract(text, lexicon, opts)` or `createExtractor(lexicon)`; keep opts for benchmark |
| faersToUtterances | 284-300 | openFDA/FAERS adapter → [{utteranceId 'faers-<id>-<k>'\|'faers-anon-<k>', register 'narrative', speaker 'reporter', text}] | — | yes | declared, never run (L270-282); FAERS third-person register will trip 'her '/'his ' |

#### Hardcoded dependencies (Extraction)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 1, 12, 30, 39 | comments naming MASQUE files/benchmark | brand | rename to generic engine; move lexicon comments to module |
| 24 | LEXICON_VERSION | version | module.extraction.lexiconVersion |
| 52, 66, 223 | migraine/aura examples in comments | condition | reword generically |
| 85 | `m_fhx … thirdPartyExempt: true` | item-id | keep flag in generic BoolRule schema |
| 98, 101, 115 | comments: v0.2 items, Bárány/ICHD, discriminators negative-weight, duration bands | condition/domain-key/version | move with module |
| 180 | comment referencing m_trig | item-id | comment only |
| 231, 234 | red flags no gating; kind literals 'redflag'\|'item'\|'ctx', suppressedBy values | flag-id/other | engine policy; keep output contract stable |
| 242 | `unnegated === undefined ? "no" : "yes"` | other | boolean values are the strings 'yes'/'no'; parameterise if a module uses other option keys |
| 294 | 'faers-' prefix | other | data-source, leave |

**File notes.** Split: L24 and L38-166 → one `extraction lexicon` object per module `{lexiconVersion, negation, thirdParty, historical, bool, ctx, scale, multi, redFlags}`; L25 and L172-300 → engine. Matching semantics to preserve: (a) text lowercased, phrases not; (b) firstHit list-order semantics; (c) BOOL via allHits, negation yields captured denial 'no' whereas CTX/SCALE/MULTI drop the capture; (d) SCALE band order, whole-text search, no negation check, fallback null; (e) red flags never gated, value true; (f) gating order third-party then historical, suppressed only returned with includeSuppressed; (g) evidence = whole utterance, cueIndex = cue offset; (h) window swept per lexicon; LEXICON_VERSION bumps with any phrase/window change. English only; raw indexOf, no tokenisation or diacritic folding — a Spanish module needs entirely separate cue sets and phrase lists (engine unchanged). Engine-policy comments to keep with engine: negation limitation, red-flag no-gating, allHits rationale, FAERS caveat.

### 3.7 `MASQUE_Probes.js` (345 lines)

Plain ES module — no imports, no React, no CSS, no default export. Exports: `ALL_PROBES` (L289), `PROBE_SET_VERSION` (L290), `{ PROBE_KIND, PROBES, VM_PROBES }` (L291), `liveProbes(answers = {}, redFlags = {}, answered = {})` (L301), `validateProbes(itemIds = [], redFlagIds = [])` (L322). Consumers: Scribe and Simulator import ALL_PROBES / PROBE_KIND / liveProbes / validateProbes / PROBE_SET_VERSION; validateProbes invoked at module load by both.

#### Content blocks

| Block | Lines | Kind | Shape | Consumers | MS | Notes |
|---|---|---|---|---|---|---|
| Header comment | 1-19 | doc | 'Project MASQUE', 'Release 0.3.1 · PROBE_SET_VERSION 1.0.0 · instrument 0.2'; names Extraction/Scribe; Bárány/IHS | — | yes | versioning rule (L11-14) is generic |
| Ranking rationale | 21-46 | doc | tiers safety > criteria > ruleout > exam (L29-41 generic); L43-45 tinnitus archetype (module) | — | mixed | |
| PROBE_KIND | 47-54 | engine | `Record<kind,{rank, label, c, bg}>`: safety(0,'Safety',--coral), rescue(1,'Re-ask',#7A4DA8), criteria(2,'Criteria',--petrol), ruleout(3,'Rule-out',--amber), phenotype(4,'Supporting',#2A6E8A), exam(5,'Exam',--slate) | liveProbes L306, validateProbes L329, Scribe, Simulator | no | labels are English UI copy; colours depend on host CSS vars |
| PROBES | 56-143 | probes | `Probe = {id 'pr_*', kind, when:(answers, redFlags)=>boolean, target?, say, why, opts:[{l, rf?, a?, note?}]}`; safety L57-88 (pr_tinnitus_quality, pr_laterality, pr_sudden_drop, pr_posture, pr_onset, pr_gca, pr_nasal_mass); criteria L90-103 (pr_episode_count→v_count, pr_migfeat→v_migfeat, pr_attack_duration→m_dur); ruleout L105-121 (pr_scan_detail→x_objective, pr_purulence→x_purulent, pr_audiogram→x_lowfreq, pr_smell→x_anosmia); exam L123-142 (pr_dix_hallpike, pr_head_impulse, pr_tuning_fork, pr_temporal_artery) | ALL_PROBES | yes | `when` closes over v_aural, m_head, r_normal, r_abx, v_vertigo and rf_asym (L134, the only flag-triggered probe); m_dur written as ordinal 1-4; pr_gca trailing comma L84 |
| VM_PROBES doc | 145-186 | doc | five Bárány symptom types; rescue (L171-175) and phenotype (L177-183) semantics; 'v0.3 candidate' | — | mixed | kind semantics → engine docs |
| VM_PROBES | 187-287 | probes | rescue probes with `rescues` instead of `target`: pr_internal_vertigo→v_vertigo L189, pr_visual_vertigo→v_motion L198, pr_positional→v_head L205, pr_photophono_only→v_migfeat L224 (`when` fires while target undefined OR negative); criteria pr_headmotion_nausea L216-222 (target m_nausea; deliberately not a rescue, L212-215); phenotype L232-286 (pr_childhood_motion, pr_childhood_vertigo, pr_osmophobia, pr_mdds, pr_interictal_photo, pr_smd, pr_neck, pr_prodrome, pr_treatment_trial) with opts carrying only l + note | ALL_PROBES | yes | L229 writes v_migfeat + m_aura in one option; L194 writes v_vertigo:1 sub-threshold with note |
| ALL_PROBES | 289 | probes | `[...PROBES, ...VM_PROBES]` (35) | liveProbes L302, validateProbes L326, consumers | yes | becomes module.probes, injected |
| PROBE_SET_VERSION | 290 | version | `'1.0.0'` | consumers | yes | independent of INSTRUMENT_VERSION |

#### Engine functions

| Function | Lines | Purpose | Reads | Portable | Notes |
|---|---|---|---|---|---|
| liveProbes | 301-307 | keep p where when() truthy; drop answered[p.id] !== undefined; drop p.target set && answers[p.target] !== undefined; stable sort by PROBE_KIND rank | ALL_PROBES, PROBE_KIND (closures) | yes once injected | Invariant 1 realised structurally: rescues lack `target` so L305 never retires them; a rescue mistakenly given `target` is silently retired — add validation or skip kind==='rescue' at L305 |
| validateProbes | 322-345 | errors for: duplicate id L327; unknown kind L329; when not function L330; missing say/why L331; empty opts L332; target/rescues not in itemIds L333-334; o.rf not in redFlagIds L336; o.a keys not in itemIds L338; **Invariant 2** kind==='phenotype' with any o.a key L339; console.error '[MASQUE probes] validation failed' L343; returns errs, never throws | ALL_PROBES, PROBE_KIND | yes once injected | membership checks skipped when arrays empty; cannot inspect `when` bodies; does not check rescue-must-lack-target or rescues-only-on-rescue |
| Probe.when predicates | 58-281 | trigger closures encoding item ids and value conventions | v_aural, m_head, r_normal, r_abx, v_vertigo, v_motion, v_head, m_nausea, v_migfeat, m_photo; rf_asym | no (content) | a declarative trigger DSL would let validateProbes check trigger ids |

#### Hardcoded dependencies (Probes)

| Line | Snippet | Category | Suggestion |
|---|---|---|---|
| 1-16, 35, 43 | header/ranking comments (MASQUE, release, Bárány, ICHD-3, tinnitus archetype) | brand/version/condition | module docs; generic tier doc says "a reference criterion" |
| 48-53 | CSS vars in PROBE_KIND | other | document host dependency |
| 58, 64, 69, 73, 77, 81, 85, 91, 95, 99, 106, 110, 114, 118, 124, 129, 139 | `when` on v_aural / m_head / r_normal / r_abx / v_vertigo | item-id | module content |
| 61, 67, 72, 76, 80, 84, 88, 142 | opts rf: rf_pulsatile, rf_asym, rf_ssnhl, rf_progressive, rf_thunderclap, rf_gca, rf_mass, rf_gca | flag-id | module content |
| 66, 93, 97, 101, 116, 126 | why strings naming migraine, Bárány A/C, ICHD-3 1.1 B, Ménière's, BPPV | condition | module content |
| 91-121 | targets v_count, v_migfeat, m_dur, x_objective, x_purulent, x_lowfreq, x_anosmia and `a:` writes (m_dur ordinals 1-4 L102-103) | item-id | module content; ordinal encoding must match items |
| 134 | `when:(a,rf) => !!rf.rf_asym` | flag-id | engine must keep passing redFlags as 2nd arg |
| 145-186, 311 | comments (Bárány/IHS, v0.2, v0.3 candidate) | condition/version | split engine semantics vs clinical justification |
| 189-230 | rescues v_vertigo/v_motion/v_head/v_migfeat; rescue negative checks (=== 0 vs === 'no'); writes incl. L229 two items; L216-221 pr_headmotion_nausea target m_nausea | item-id | module content |
| 195, 222, 236, 242 | notes naming Bárány / VM-supporting | condition | module content |
| 233-281 | phenotype whens on v_vertigo, m_head, m_photo, v_motion | item-id | module content |
| 290 | PROBE_SET_VERSION | version | module.probeSetVersion |
| 339 | `p.kind === "phenotype"` | other | generic tier; consider `mayWrite:false` in PROBE_KIND |
| 343 | '[MASQUE probes]' | brand | `[${moduleId} probes]` |

**File notes.** Probe object shape (exact): `{ id, kind, when, target?, rescues?, say, why, opts:[{l, rf?, a?, note?}] }`; option semantics as consumers apply them: rf → raise flag; a → merge answers; note → append observation; an option may carry none. Rank order safety 0 < rescue 1 < criteria 2 < ruleout 3 < phenotype 4 < exam 5; ties keep insertion order (stable sort, PROBES before VM_PROBES). Truncation is done by consumers (Scribe cap 2, Simulator cap 3), never here. Value conventions: 'yes'/'no' strings, numbers for graded items (v_vertigo 0/1/2, m_head > 0, m_dur 1-4); rescue negative tests must match the item type (0 vs 'no'). Versioning contract (L11-14, L171-175, L316-320): PROBE_SET_VERSION bumps on any add/remove/reword/reclassify; adding probes never changes items/weights/cutpoints; rescues write only existing items; phenotype features are 'v0.3 candidates' promoted only by clinical decision + INSTRUMENT_VERSION bump. English only; PROBE_KIND labels should route through app locale layer.

---

## 4. Constraints, invariants and versioning ownership

### 4.1 Invariants (from the docs) and what each means for the module system

| # | Invariant | Where enforced today | Refactor implication |
|---|---|---|---|
| 1 | **Absent data is never rendered as negative data.** Unanswered ≠ denial; missing label ≠ negative; no labels → no metrics; Patient "Not sure" leaves item unanswered; weight default 1 applied only inside weightOf(), stored field stays null. | useScore/computeScore bounds (Screener ~L342-405, Scribe ~L293-330); normalizeRows/metrics/weightedMean/population (RRP, fix #3); screenToCohortRow writes '' and empty label/reference_diagnosis (Screener L572-604); QuestionnaireResponse omits answer element for never-asked; Patient Yes/No/Not sure; model card missingDataPolicy/cohortState. | Engine treats `undefined` as unanswered for every module and never accepts a module-supplied default answer. Three-state answer is an engine concept. Cohort exporter emits '' for unanswered regardless of module; label/reference_diagnosis stay empty at capture. normalizeRows stays module-agnostic; demo rows go through normalizeRows (cfg.demo bypass must not return). Fix Scribe skipPrompt writing 'no' (L830) or document it as a clinician-recorded denial. |
| 2 | **Gate, don't warn.** Unfinished screen → no band; red flag withholds routing; unrecorded safety review blocks routing (and signing by default); fairness FAIL withholds probability/decision; unscorable abstains at any coverage. | `band = scorable ? bandFor(total) : 'indeterminate'`; CDS card and ServiceRequest require scorable; notScorable → `{cards: []}`; safety canContinue (fix #2); scribe `!override && safetyReviewed` + REQUIRE_SAFETY_REVIEW_TO_SIGN (L153-168); panel scorable hard-override; ABSTAIN_FLOOR 0.55; §11 gate. | All gating is engine-owned and identical across modules; a module cannot opt out. A module with a short/empty flag list still gets the explicit "none of these apply" step. Generic CDS builder keeps notScorable → empty cards. REQUIRE_SAFETY_REVIEW_TO_SIGN is a site/shell setting. |
| 3 | **Report the denominator, or don't report.** Suppress subgroups < minimum with n shown; every rate has an interval (Wilson on Kish n; Newcombe for gaps); gap not distinguishable from zero → INCONCLUSIVE; < 2 reportable groups → NOT ASSESSABLE; PASS needs the whole CI under tolerance. | FAIRNESS_POLICY (RRP L463-483) + fairness()/verdictOf (~L550-660); metrics with 95% CIs (fix #4). | Thresholds, interval maths and four-way verdict are engine constants; a module may not lower minGroupN/minCellN. Module tolerance overrides only with toleranceSetBy/Rationale/SetOn; otherwise reported as unattributed placeholder. Replace Simulator POLICY (L134) with the engine constant. |
| 4 | **Say what a number is.** Illustrative calibration labelled; in-sample benchmark says in-sample (SATURATED block); cohort weighted mean "not a survey estimate"; every artifact states "Prototype. Not for clinical use" on its face; model card records missingDataPolicy, cohortState, fairnessPolicy (toleranceStatus), fairnessAxis, equityMitigation 'not implemented'. | Header banners in all four apps; RRP model card/manifest; benchmark saturation block; etl/README_DATA_CONNECTION.md. | When titles become module-driven the caveat strings must not move with them — the prototype/illustrative/not-validated banner belongs to the shell and renders for every module. Model card and manifest must record module id + instrument version; 'masque-prototype-0.3.0' alone is ambiguous with >1 instrument. |
| 5 | **A band holds across the whole attainable range (two-sided).** Best case → ceiling, worst case → floor; band only when bandFor(floor) === bandFor(ceiling). 'low' never while ceiling ≥ moderate cut; 'high' never while total < high cut; no high band while a negative-weight discriminator is unanswered. | itemBounds + BAND_CUTS (Screener L329-405), mirrored Scribe/Simulator; 200,000-answer-set random sweep (fix #1, #6/#9). | Engine must support negative weights and per-item best/worst bounds; never reintroduce floor = total. Cut-points are module content; the rule is engine. Keep the random-sweep test generic, parametrised by module, run per module. |
| 6 | **Red flags sit outside the score and override it; capture may raise, never clear.** Flags carry no weight; index still computed and recorded but proposes nothing while a flag is open; extraction applies no negation/attribution/history to flags; captured flags tagged 'heard in encounter', clinician-dismissable; review must be explicit. | RED_FLAGS (12, two tiers); extract() red-flag pass; benchmark scores flags separately; Flag resources + routing-override component; drift guard on missing cue phrases. | Module defines flags (id, tier, points-to, action, patient-safe wording, cue phrases); engine never allows a weight on a flag and exposes a no-negation matching mode for flags. Benchmark keeps the red-flag slice separate per module. Screener safety gate and scribe review gate are engine. |
| 7 | **Rescue probes survive a negative answer; supporting probes never write to a scored item; safety ranks first; probe ids must resolve.** | liveProbes()/validateProbes(); MASQUE_Probes_Check.mjs fails the build and currently regex-scrapes ids ([rmvnix]_ and rf_) from MASQUE_Screener_v0_3.jsx. | Probe set is module content; PROBE_KIND ranks, liveProbes, validateProbes are engine. Re-point the check to import the selected module's item and flag ids, run per module. Phenotype option may carry note only. Safety and re-ask tiers never truncated; other kinds show top two with a count. Add validation: rescue must have `rescues`, must not have `target`. |
| 8 | **One instrument, one source of truth.** Identical ids/weights/scale counts in Screener/Scribe/Patient (30/30/30); Questionnaire, CDS, dictionary and CSV columns generated from the same ITEMS; P keyed by item id with load-time assertion; benchmark imports the shipped lexicon. | buildQuestionnaire/buildCdsHooks/buildDataDictionary (Screener L424-560); Patient assertion (fix #10); Probes_Check; benchmark import; Simulator copies = documented limitation. | The refactor's core requirement: the module definition is the single source for all four apps, published artifacts, CSV template columns, probe validator, lexicon ids and patient/Spanish wording. Loader asserts: wording keys vs item ids and scale lengths; lexicon ids vs items; probe targets vs items; every scale has an option with f = 0; positive weights sum to declared max; each domain's weights match its max. Retire the Simulator's inline copies. Make buildCdsHooks generated, not literal. |
| 9 | **The empty label column is the pilot instrument.** Captured screen = a row in the canonical schema, label/reference_diagnosis empty until follow-up, unanswered items '', instrument_version + app_version on every row; sequence by captured_at, not visit number. | screenToCohortRow (Screener L572-604); masque_cohort_template.csv; dictionary canonicalCohortFields. | Canonical non-item columns are engine-owned and stable; item columns follow the module, so the CSV template is per-module. Add a module id column; existing MASQUE rows must still ingest. |
| 10 | **Sex and gender are independent fairness axes.** No fallback between them; rows without a value on the chosen axis counted but never form an 'unknown' group; PASS on one axis ≠ PASS on the other; gender free text. | fairness(rows, cfg, policy, axis) + Stratify-by (fix #16); propagated to cohort row, dictionary, CSV template, demo patients. | Engine-owned. Module demo patients and scenario generators must supply sex and gender separately, include divergent cases and rows with only one present. |
| 11 | **The extractor maps one phrase list to one item and never infers one item from another.** m_dur matches duration phrases only; dizziness without a duration cue leaves the item unanswered; any unnegated mention wins (allHits); family history thirdPartyExempt. | Extraction lexicon + extract(); fix #6, fix #15. | Lexicon (phrases, thirdPartyExempt, NEGATION.window, THIRD_PARTY cues) is module content; matcher (windows, allHits semantics) is engine and must not add cross-item inference. Lexicon ids resolve to the module's items. |
| 12 | **Gold set integrity and in-sample honesty.** Every label correction in `_meta.revisionLog` with reason; harness marks figures in-sample when rules were revised against the set; window swept, smallest on plateau preferred. | masque_extraction_goldset.json `_meta`; benchmark saturation block + sweep. | Each module's lexicon carries its own gold set + version; harness imports the module lexicon and reports module id, lexicon version and gold-set version together. Re-run sweep after any phrase change. |
| 13 | **Panel confidence credits nothing the caller did not supply.** signalQuality null → confidence is pure coverage; scorable hard-overrides; props default safely because VOICED/BREATHE import the panel. | RRP (fix #1, #5). | Engine-owned. No placeholder signalQuality of 1. Panel prop changes stay backward-compatible for the other prototypes. |

### 4.2 Deliberate omissions to carry into the generic apps

- **Patient companion:** no score/band/probability anywhere; clinician block lists present features in clinical language ordered by weight (weights only for ordering). No differential for any red flag — two things per flag: how fast to be seen and what to say (zero of twelve clinical differentials appear in the patient build). No automatic research capture; export is patient-initiated and local. "Not sure" is first-class and leaves the item unanswered; thin summaries refuse rather than hand over; when discriminators are positive the migraine question is reframed to open both doors. Spanish shipped with REVIEWED.es = false and an unreviewed banner on every screen and in the export; summary prose translated as templates.
- **Clinician screener:** incomplete screen posts QuestionnaireResponse in-progress and Observation preliminary with dataAbsentReason temp-unknown, no ServiceRequest, hatched total–ceiling range, button "Write partial screen to chart"; the reassuring low-band fallback cannot fire on an unfinished screen. Demo patient has no DOB; MRN SANDBOX-77-2210 labelled synthetic.
- **Ambient scribe:** capture raises but never clears a flag; no negation on the flag path; routing requires recorded review; signing blocked until review (REQUIRE_SAFETY_REVIEW_TO_SIGN); draft note opens with SAFETY REVIEW in all three states. While !scorable the suggestion pool widens to every unanswered item.
- **CDS Hooks:** notScorable → `{cards: []}` published explicitly; red flag pre-empts the screening card with a critical/warning card.
- **Research panel:** validation metrics withheld entirely without explicit 0/1 labels, with the reason named; cost KPIs '—' not $0; fairness FAIL withholds probability/decision; subgroups under minGroupN suppressed with n; 4-row nonbinary demo stratum suppressed; reweighting 'not implemented'.
- **Population / ETL:** survey data never goes through the cohort loader; weighted mean labelled 'not a survey estimate'; NHIS symptom block TODO by design.
- **Extraction benchmark:** red flags scored separately; headline F1 under an automatic SATURATED block (inSample, no held-out split, one annotator).
- **Probe panel:** phenotype probes recorded as notes, score zero, tagged v0.3 candidates.

### 4.3 FHIR / identifier constraints (module-owned values that must stay byte-identical for the MASQUE module)

| What | Value | Must stay | Ownership |
|---|---|---|---|
| Questionnaire canonical URL | `http://masque.example/Questionnaire/masque-screener-v0.2` | yes | module (Dizziness/MASQUE keeps this exact string; new module gets its own; never rename to contain "dizziness") |
| Questionnaire identity | name 'MASQUEScreener'; version = INSTRUMENT_VERSION; status draft; experimental true; publisher 'Project MASQUE — TOPx prototype' | yes | module; status/experimental honest until validation |
| Item linkIds / flag ids / group linkIds | 30 item ids; 12 rf_*; groups recalcitrance, migraine, vestibular, neuro, impact, discriminators, safety | yes | module; probe checker's [rmvnix]_ regex must be replaced by reading ids |
| Local code system | `http://masque.example/codes`: masque-index, domain-{k}, screen-coverage, attainable-range, routing-override, each rf_* | yes | code system URL + index code from module; component code strings engine-constant |
| Answer-option system | `http://masque.example/answer`, code = String(index), display = label | yes | module; option order is part of the instrument |
| Item-weight extension | `http://masque.example/StructureDefinition/item-weight` (valueDecimal) | yes | URL engine-stable; values module |
| Criterion system | `http://masque.example/criteria` with ref codes (m_dur ICHD-3 1.1 B; v_vertigo Bárány B; v_count Bárány A; v_migfeat Bárány C) | yes | module content; builder emits when item has ref |
| Standard terminology | observation-category survey; flag-category clinical; v3-ObservationInterpretation; data-absent-reason temp-unknown; UCUM {score} and %; status preliminary/final, in-progress/completed; denied = valueBoolean false, never-asked = no answer | yes | engine |
| CDS service | hook order-select; id 'masque-screen'; prefetch patient/priorScreens/activeFlags; uuids 'masque-safety'/'masque-index'; source {Project MASQUE, http://masque.example}; notScorable → [] | yes | id/title/description/source module; three-state contract engine |
| Model-card identifier | 'masque-prototype-${APP_VERSION}' / 'masque-scribe-prototype-${APP_VERSION}'; panel default 'prototype-0.2' | no | keep release + instrument; add module id |
| Canonical cohort fields | screen_id ('masque-'), captured_at, instrument_version, app_version, score, label, reference_diagnosis, subject_id, visit_label, sex, gender, age, weight, annual_cost, avoidable_cost, complaint, coverage, scorable, band, red_flags (pipe), then item columns | yes | non-item engine; item columns module; module id column may be added; nothing renamed/dropped |
| Pseudonym scheme | 's-' + FNV-1a(SITE_SALT::MRN); SITE_SALT 'CHANGE-ME-PER-SITE'; SALT_IS_DEFAULT | yes | engine/site; upgrade path HMAC-SHA-256 same interface |
| Scoring constants | BAND_CUTS {34, 67}; bands '< 34', '34–66', '≥ 67'; positive weights 100; discriminators −29; ABSTAIN_FLOOR 0.55 | yes | cuts/weights module (instrument bump to change); ABSTAIN_FLOOR engine |

### 4.4 Versioning-ownership table

| Axis | Constant | Current | Owner | Rationale (VERSIONS.md) |
|---|---|---|---|---|
| Release | APP_VERSION (+ filename suffix) | 0.3.0 in every app constant (Screener L46, Scribe L151, Patient L55, Simulator RELEASE L28 + literal L458); README/VERSIONS header say 0.3.1; VERSIONS table 0.3.0 — existing drift to resolve, not inherit | **app/shell** | Changes when any app-level change ships; identifies the build's scoring interpretation, routing and safety logic; recorded beside instrument_version on every cohort row |
| Instrument | INSTRUMENT_VERSION | 0.2 everywhere; QUESTIONNAIRE_URL and Questionnaire.version derive from it | **module** | "Not a build number": identifies the scored questionnaire (items, weights, scales, cut-points); moves only when one of those changes; two screens under 0.2 are poolable; 0.3/0.3.1 changed no item. Shell never derives or bumps it |
| Lexicon | LEXICON_VERSION (+ NEGATION.window as swept parameter) | 0.3.1; window 14 (Extraction L24, L45) | **module** | Changes when a phrase list or negation parameter changes; window swept per lexicon; phrases and window travel together. Engine behaviour changes should carry a separate engine constant |
| Probe set | PROBE_SET_VERSION | 1.0.0 (Probes L290) | **module** | Changes when a probe is added/removed/reworded/reclassified; independent of instrument because rescues set existing items and phenotype scores zero. Kinds and engine functions unversioned |
| Gold set | `_meta.version` in masque_extraction_goldset.json | 0.2.0 (44 authored utterances; not openFDA) | **module** | Changes when a benchmark label is added/corrected; revisionLog records each; labels one module's lexicon against its ids |
| Shared panel / engine files | none — RRP carries no version; Extraction/Probes imported by path without suffix | ships with release | **engine** | Renaming shared files each release "would break every import for no informational gain"; both report state into model card / benchmark. Keep stable import paths, state reported into artifacts, no per-module suffixing |

Additional versioning drift to clean up: Scribe buildNote L1236 and Simulator L1496/L1543 hardcode "v0.3 candidates" (a literal outside the two constants); RRP default modelVersion 'prototype-0.2' (L792); Simulator header "0.3.0"; Probes header "Release 0.3.1 · PROBE_SET_VERSION 1.0.0 · instrument 0.2" (comment).

### 4.5 Other constraints carried from the docs

- "Dizziness" is a dropdown label only. The Questionnaire name, canonical URL, code system, CDS service id and item ids must not be renamed to match it, or instrument 0.2 comparability is lost.
- Copyright: items are authored; VM-PATHI mirrored at domain level only; licensed instruments (VM-PATHI, SNOT-22, DHI, HIT-6, MIDAS, ID Migraine, THI/TFI, SFN-SIQ, COMPASS-31) named, never reproduced. The module system must not let a module embed licensed instrument text.
- Data-source lists are per-project (Bridge2AI-Voice → VOICED; MASQUE → NHANES, NHIS, MEPS, CMS PUF, HCUPnet, openFDA, CDC WONDER/BRFSS, All of Us); no cross-bleed.
- Loader assertions: every scale has an f = 0 option (the m_dur "No attacks" bug); positive weights sum to declared max; per-domain weights match max; items carry a direction flag so reverse-scored (and zero-variance, listed by name) items are excluded from Cronbach's α; every flag has cue phrases; every lexicon id and probe target is an item id; patient wording for every item with matching option counts; per-locale REVIEWED defaults false.
- Data dictionary is generated from the module, not hand-maintained; the panel header points at the clinical app for it.
- Panel prop changes keep scorable, ceiling, signalQuality (null default) backward-compatible for six prototypes.
- Step list keyed by STEPS[step].key (fix #2); safety step first and mandatory for every module.
- §3.2 diagnostic-gap alert is sex-neutral (three markers, threshold two) — module content, neutrality is a constraint.
- Demo/sample/scenario sets must keep exercising the gates: full-score case; red-flag case with the same index; competing case; unlabeled cohort (validation withheld); single-positive-group cohort (NOT ASSESSABLE); sex/gender-divergent rows with a sub-minimum stratum (suppressed).
- weightOf() default-1-at-compute stays; provenance fingerprint + `deterministic: true` — no stochastic components in the panel.
- Every export and printed page carries the prototype / not-for-clinical-use / illustrative statement on its own face.

---

## 5. Appendix — every hardcoded branch on a domain key, item id or flag id, by file

These are the branches a generic component must express through module data instead. Adjacent vocabulary branches (complaint value, band name, tier name, id prefix) are included where they gate behaviour, because they are the same kind of coupling. Line numbers as in §3.

### 5.1 MASQUE_Screener_v0_3.jsx

| Line | Branch | Kind | Replace with |
|---|---|---|---|
| 83-92 | STEPS keys migraine/vestibular/neuro/impact/discriminators/intake/safety/result | domain-key | module.steps[{kind, domainKeys, extras}] |
| 290 | SAMPLE_CASES.redflag `rf: {rf_asym: true}` | flag-id | module.sampleCases (data) |
| 499 | CDS example detail hand-copies rf_asym.action | flag-id | generate from module.redFlags |
| 527 | `ITEMS.discriminators.max` | domain-key | Σ max over domains with negative:true |
| 874 | `ctx.c_clin === "3+"` | item-id | module.gapRule[0] |
| 875 | `ctx.c_dur === ">12mo"` | item-id | module.gapRule[1] |
| 876 | `ctx.c_dismiss === "yes"` | item-id | module.gapRule[2] |
| 882 | `f.tier === "emergent"` (also 897, 1230, 1332, 1561) | tier | fixed tier vocab / tier rank |
| 888 | `stepKey === "safety"` / `=== "intake"` | step-key | step.kind / step.requires |
| 914 | `band !== "low"` (also 1340, 1455) | band | lowest band of vocabulary |
| 915 | `complaint === "sinonasal" \|\| "both"` | complaint | rule predicate |
| 916 | `complaint === "otologic" \|\| "both"` | complaint | rule predicate |
| 922 | `domains.vestibular.pct >= 50` | domain-key | rule `{domainPctGte: {vestibular: 50}}` |
| 927 | `domains.neuro.pct >= 50` | domain-key | rule |
| 934 | `answers.v_aural === "yes"` | item-id | rule `{itemEquals: {v_aural: 'yes'}}` |
| 941 | `domains.discriminators.pts < 0` | domain-key | any negative domain with pts < 0 |
| 943 | `Math.abs(domains.discriminators.pts)` | domain-key | same |
| 944 | `ITEMS.discriminators.items.filter(answers[it.id] === "yes")` | domain-key | iterate negative domains |
| 994-997 | `loadSample("sinonasal"\|"otologic"\|"redflag"\|"competing")` | sample-key | render from module.sampleCases |
| 1086 | `<QGroup domainKey="recalcitrance">` | domain-key | step config |
| 1090 | `<StepCard dk="migraine">` | domain-key | step config |
| 1091 | `<StepCard dk="vestibular">` | domain-key | step config |
| 1092 | `<StepCard dk="neuro">` | domain-key | step config |
| 1094 | `<StepCard dk="discriminators">` | domain-key | step config |
| 1101 | `<QGroup domainKey="impact">` + `<ContextQ>` | domain-key | step {domainKey: 'impact', extras: ['context']} |
| 1191-1193 | ContextQ rows c_clin / c_dur / c_dismiss | item-id | module.contextItems |
| 1344 | `complaint === "otologic" ? "otologic" : "sinonasal"` | complaint | module.cds.indexCardSummary(complaint) |
| 1450 | `{low: "L", moderate: "N", high: "H"}[band]` | band | engine band → v3 map |
| 1456 | `complaint === "otologic" ? "Neuro-otology" : "Headache medicine / Neurology"` | complaint | module.referral.specialtyByComplaint |
| 1577 | `complaint === "otologic" ? "vestibular migraine" : "mid-facial / migrainous cause"` | complaint | module.referral.reasonByComplaint |

### 5.2 MASQUE_Scribe_v0_3.jsx

| Line | Branch | Kind | Replace with |
|---|---|---|---|
| 452 | `ITEMS.discriminators.max` | domain-key | Σ negative domains |
| 771 | `["r_abx","r_surg"].some(=== "yes") \|\| answers.m_head !== undefined` | item-id | module.phenotypes[].triggerItems |
| 772 | `["v_vertigo","v_motion","v_aural","v_head"].some(answered && !== "no")` | item-id | module.phenotypes[].triggerItems |
| 773 | `sin && oto → "both"; oto → "otologic"; else "sinonasal"` | complaint | phenotype keys + default from module |
| 781 | base active `{migraine, impact, recalcitrance, discriminators}` | domain-key | module.alwaysActiveDomains |
| 782 | `complaint === "otologic" \|\| "both" → active.add("vestibular")` | complaint/domain-key | module.phenotypes[].activatesDomains |
| 783 | `(answers.n_burn ?? "no") !== "no" \|\| answers.n_viral === "yes" → add("neuro")` | item-id/domain-key | module.domainActivationRules |
| 786 | `active.has("vestibular")` | domain-key | module.infoPrompts.gateDomain |
| 790 | `vestActive && VMPATHI_TAG[a.id]` (v_motion, v_vertigo, v_head, m_photo) | item-id | item.tag + boost rule |
| 796 | `it.domain === "vestibular" ? "vestibular" : label.toLowerCase()` | domain-key | per-domain shortTag |
| 800 | `if (vestActive) for VMPATHI_INFO` (vmp_cog, vmp_affect) | domain-key/item-id | module.infoPrompts |
| 836 | `ctx.c_clin === "3+"` | item-id | module.contextFlags |
| 837 | `ctx.c_dur === ">12mo"` | item-id | module.contextFlags |
| 838 | `ctx.c_dismiss === "yes"` | item-id | module.contextFlags |
| 844 | `f.tier === "emergent"` (also 1000, 1215, 1306) | tier | tier vocab |
| 1027 | kind order list | probe-kind | PROBE_KIND order |
| 1035-1037 | `kind === "safety"\|"rescue"\|"phenotype"` suffix copy | probe-kind | PROBE_KIND.caption |
| 1158 | `c.id.startsWith("rf_")` | flag-id prefix | capture.kind === 'redflag' |
| 1159 | `c.id.startsWith("c_")` | item-id prefix | capture.kind === 'ctx' |
| 1160 | `{c_dismiss, c_dur, c_clin}` label map | item-id | module.contextFlags[].shortLabel |
| 1168-1178 | shortLabel map ×30 ids | item-id | item.short |
| 1185 | `complaint === "sinonasal" \|\| "both"` | complaint | rule predicate |
| 1186 | `complaint === "otologic" \|\| "both"` | complaint | rule predicate |
| 1188 | `domains.vestibular.pct >= 50` | domain-key | rule |
| 1189 | `domains.neuro.pct >= 50` | domain-key | rule |
| 1190 | `answers?.v_aural === "yes"` | item-id | rule |
| 1191 | `domains.discriminators.pts < 0` | domain-key | negative domains |
| 1202 | `VMPATHI_INFO.find(i => i.id === k)` | item-id | module.infoPrompts |
| 1204 | `ctx.c_dur === ">12mo"` | item-id | contextFlags[].noteLabel |
| 1205 | `ctx.c_clin === "3+"` | item-id | contextFlags[].noteLabel |
| 1206 | `ctx.c_dismiss === "yes"` | item-id | contextFlags[].noteLabel |
| 1256 | `{low, moderate, high}[band]` | band | engine map |
| 1259 | `complaint === "otologic" ? "Neuro-otology" : …` | complaint | module.phenotypes[].referralSpecialty |
| 1311 | `complaint === "otologic" ? "vestibular migraine" : …` | complaint | module.phenotypes[].referralReason |

### 5.3 MASQUE_Patient_v0_3.jsx

| Line | Branch | Kind | Replace with |
|---|---|---|---|
| 383, 405 | UI.sections[3..7] index-aligned to migraine/vestibular/neuro/impact/discriminators | domain-key | domain.patientLabel |
| 437 | SUM.migWords keyed m_photo, m_nausea, m_disable, m_aura, m_trig, m_fhx | item-id | summary rules |
| 443 | SUM.vWords keyed v_motion, v_aural, v_head | item-id | summary rules |
| 445 | SUM.nWords keyed n_burn, n_otalgia, n_auto, n_viral, n_allo | item-id | summary rules |
| 449, 457 | SUM.dWords / dShort keyed x_purulent, x_objective, x_lowfreq, x_anosmia | item-id | summary rules |
| 523-529 | CONTEXT_Q ids c_clin, c_dur, c_dismiss | item-id | module.contextQuestions |
| 535-539 | SECTIONS keys migraine, vestibular, neuro, impact, discriminators | domain-key | from module.steps |
| 655 | `f.tier === "now"` (also 829, 837, 838, 1023, 1024) | tier | tier rank / urgent flag |
| 656 | `key === "safety"` | step-key | shell step kind |
| 720 | `<QBlock domain="recalcitrance">` inside 'story' | domain-key | module.storyDomain |
| 726 | `["migraine","vestibular","neuro","impact","discriminators"].includes(key)` | domain-key | `key in module.items` |
| 729 | `BLURB[key]` keyed by those five domains | domain-key | module.blurbs |
| 910 | `yes("r_dur")` | item-id | rule |
| 911 | `yes("r_abx")` | item-id | rule |
| 912 | `yes("r_surg")` | item-id | rule |
| 913 | `yes("r_normal")` | item-id | rule |
| 914 | `yes("r_lesion")` | item-id | rule |
| 916 | `scale("m_head")`, `scale("m_dur")` | item-id | rule |
| 917 | `mHead > 0` | item-id | rule |
| 918 | `mDur === 2` | item-id (index semantics) | rule |
| 919 | mig = [m_photo, m_nausea, m_disable, m_aura, m_trig, m_fhx].filter(yes) | item-id | feature group |
| 920, 940 | `mig.length >= 2` | item-id | group threshold |
| 922-923 | `scale("v_vertigo")` → vertigoT[vDur] | item-id | rule |
| 924 | `yes("v_count")` | item-id | rule |
| 925 | `yes("v_migfeat")` | item-id | rule |
| 926 | vOther = [v_motion, v_aural, v_head].filter(yes) | item-id | feature group |
| 929 | neu = [n_burn, n_otalgia, n_auto, n_viral, n_allo].filter(yes) | item-id | feature group |
| 932-934 | `scale("i_days")`, `scale("i_role")` → daysT/roleT | item-id | rule |
| 936 | disc = [x_purulent, x_objective, x_lowfreq, x_anosmia].filter(yes) | item-id | negative-domain items |
| 940 | migPattern = mHead > 0 && (mig ≥ 2 \|\| mDur === 2) | item-id | rule |
| 941 | vestPattern = vDur === 2 \|\| yes(v_count) \|\| yes(v_migfeat) | item-id | rule |
| 945-953 | ask tree over migPattern/vestPattern/disc/neu/r_normal/r_lesion/r_abx/r_surg | item-id | rule table |
| 949 | `neu.length >= 2` | item-id | threshold |
| 950 | `yes("r_normal") \|\| yes("r_lesion")` | item-id | rule |
| 952 | `yes("r_abx") \|\| yes("r_surg")` | item-id | rule |
| 955 | `ctx.c_clin === "3+"`, `ctx.c_dur === ">12mo"`, `ctx.c_dismiss === "yes"` | item-id | option `signal: true` |
| 957 | same three ctx values passed to S.gap | item-id | same |
| 967 | `it.scale && v === 0` skip | answer convention | engine |

Simulator PITEMS-equivalent: none in this file beyond the above.

### 5.4 ResearchReadinessPanel.jsx

No branch on any domain key, item id or red-flag id. Adjacent vocabulary branches: `band = "low"` default (L783); axes 'sex'/'gender' (L533, L648, L775-776, L823, L827, L967); score aliases `masque_score|breathe_score|voiced_score` (L197, L216); `parsed.masqueArtifact === "population-estimates"` (L864); `PROJECTS[project] || PROJECTS.MASQUE` (L798).

### 5.5 MASQUE_Simulator.jsx

| Line | Branch | Kind | Replace with |
|---|---|---|---|
| 320 | SCENARIOS.partial answers v_vertigo, v_count, v_migfeat, v_motion, v_aural, v_head | item-id | module.scenarios |
| 326 | SCENARIOS.redflag `rf: {rf_asym: true}` | flag-id | module.scenarios |
| 329 | SCENARIOS.ruleout x_objective, x_purulent, x_anosmia | item-id | module.scenarios |
| 317-329 | `step: 6` | step index | steps.length − 1 |
| 397-398 | `.tier.emergent` / `.tier.urgent` | tier | fixed vocab |
| 467 | STEP_DOMAIN {2 migraine, 3 vestibular, 4 neuro, 5 impact} | domain-key | module.steps |
| 480 | `step === 0 ? (safety \|\| override)` | step index | step.kind |
| 499, 532, 550, 556, 637, 640 | `step === 0/1/5/6` | step index | step.kind |
| 537 | `<Items domain="recalcitrance">` | domain-key | step config |
| 546 | `step === 3 ? "…Bárány…"` | step index/domain | domain.intro |
| 547 | `step === 2 ? "…ICHD-3…"` | step index/domain | domain.intro |
| 552 | `<Items domain="discriminators">` | domain-key | step config |
| 614 | `sc.band !== "low"` | band | lowest band |
| 616 | `sc.band === "high"` | band | highest band |
| 685, 689-690, 784 | axes sex/gender | axis | config |
| 892-915 | PITEMS ids r_dur, r_abx, r_normal, m_photo, m_nausea, m_trig, x_objective | item-id | module.patientItems |
| 931 | `["m_photo","m_nausea","m_trig"].filter(=== "yes").length` | item-id | patientAskRules |
| 932 | `a.x_objective === "yes"` | item-id | patientAskRules |
| 934, 937 | `mig >= 2 && disc` / `mig >= 2` | item-id | patientAskRules |
| 940 | `a.r_normal === "yes"` | item-id | patientAskRules |
| 943 | `a.r_abx === "yes"` | item-id | patientAskRules |
| 1029-1039 | CUES ids m_head, m_photo, v_motion, m_nausea, m_dur, r_abx, r_normal, v_vertigo, v_aural, c_dismiss, rf_asym | item-id/flag-id | module.lexicon |
| 1080, 1086, 1091, 1136 | `a.v_aural === "yes"` | item-id | module.probes |
| 1083-1110, 1164 | opts rf: rf_pulsatile, rf_asym, rf_ssnhl, rf_progressive, rf_thunderclap, rf_gca, rf_mass | flag-id | module.probes |
| 1095, 1099, 1103, 1121, 1161 | `(a.m_head ?? 0) > 0` | item-id | module.probes |
| 1107, 1128, 1132, 1140 | `a.r_normal === "yes" \|\| a.r_abx === "yes"` | item-id | module.probes |
| 1113, 1117, 1121, 1128, 1132, 1136, 1140 | targets/writes v_count, v_migfeat, m_dur, x_objective, x_purulent, x_lowfreq, x_anosmia | item-id | module.probes |
| 1146, 1151, 1113, 1117 | `(a.v_vertigo ?? 0) > 0` | item-id | module.probes |
| 1156 | `!!rf.rf_asym` | flag-id | module.probes |
| 1216, 1225, 1232, 1247 | rescues v_vertigo / v_motion / v_head / v_migfeat with negative checks | item-id | module.probes |
| 1239 | `a.v_head === "yes" && a.m_nausea === undefined` | item-id | module.probes |
| 1252 | `a: {v_migfeat: "yes", m_aura: "yes"}` | item-id | module.probes |
| 1256-1304 | phenotype whens on v_vertigo, m_head, m_photo, v_motion | item-id | module.probes |
| 1340 | `!c.rf && !c.id.startsWith("c_")` | id prefix | cue `context: true` or membership test |
| 1409 | kind order list | probe-kind | PROBE_KIND |
| 1413-1420 | `k === "ruleout"\|"safety"\|"rescue"\|"phenotype"` captions | probe-kind | PROBE_KIND.caption |
| 1422, 1454 | `k === "safety" \|\| k === "rescue"` never truncated | probe-kind | PROBE_KIND.truncate |

### 5.6 MASQUE_Extraction.js

Engine functions contain no branch on any id. Content entries that name ids (module data, listed for completeness): BOOL_EX L79-106 (24 ids; `thirdPartyExempt` on m_fhx L85 — the only per-entry behavioural switch, read at L243); CTX_EX L108-110 (c_dismiss); SCALE_EX L112-134 (m_head, v_vertigo, m_dur, i_days, i_role); MULTI_EX L136-141 (r_dur, c_dur, c_clin); RF_PHRASES L153-166 (12 rf_* keys). Engine branches on kind literals only: 'redflag' L234, 'item'/'ctx' L237-265, `unnegated === undefined ? "no" : "yes"` L242.

### 5.7 MASQUE_Probes.js

Engine branches: `p.target && answers[p.target] !== undefined` (L305, generic); `p.kind === "phenotype"` (L339, kind literal). All id branches are inside module content (`when` closures and options), listed in §3.7: v_aural L58/64/69/114; m_head L73/77/81/99/139/233/245/257 (via m_photo)/269/275/281; r_normal/r_abx L85/106/110/118; v_vertigo L91/95/124/129/190/225/233/239/245/251/263/269/275/281; rf_asym L134; v_motion L199/263; v_head L206/217; m_nausea L216-221; v_migfeat L225-230; m_photo L257; flag options rf_pulsatile L61, rf_asym L67, rf_ssnhl L72, rf_progressive L76, rf_thunderclap L80, rf_gca L84/L142, rf_mass L88.

---

## 6. Verdict on the Simulator

**Recommendation: retire `MASQUE_Simulator.jsx` as a code artefact; salvage its four unique pieces into the module and shell; do not parameterize it.**

What it duplicates (all diverged or stale): ITEMS (no `f` factors, wrong discriminators.max, different labels), RED_FLAGS (third wording), CUTS + band literals, a **wrong** linear scoreItem (awards full criterion-B points to excluded durations), a useScore without itemBounds, POLICY/CFG (subset of the panel's), the entire probe set (identical, but by copy), a 6-cue negation list and 11-cue lexicon subset, a 7-item Patient subset with its own bilingual copy, and its own English-only Panel. The README already calls these copies a known limitation "to keep in step or drop"; the constraints extract says the refactor should retire them rather than add a per-module set. Parameterizing it would mean maintaining a fifth generic app whose only distinguishing feature is being smaller than the four it condenses — and the module system makes the four real apps import the same content, which removes the reason it existed (a single-file demo that could not import).

What it uniquely provides, and where each should go:

1. **Scenario probe rail** (SCENARIOS L314-330, rail L644-656; header says explicitly "not in the real apps"). Worth keeping: it exercises the gates (empty, partial-vestibular, full high, red-flag-same-index, rule-out). Move the five scenarios into `module.sampleCases` (the Screener already has four; merge and add `buttonLabel`, icon by name, no `step` index) and render the sample rail generically in the Screener.
2. **Deterministic synthetic cohort generator** (makeCohort L285-305, COHORTS L677-681). The dedicated panel ingests CSV/JSON and carries 9 demo rows; it has no generator for the unlabeled and disparate cohorts the constraints require for gate rehearsal. Move makeCohort into the panel engine (generic given a score range/midpoint) and the three cohort kinds into `module.research.demoCohorts`; expose "Load demo cohort" next to "Restore demo".
3. **Tabbed shell combining the four apps.** This is exactly the shape the module dropdown needs (one `module` state passed down). Reuse the idea, not the file: the new shell = module dropdown + app tabs, importing the four generic apps.
4. **Static "What to notice" rails** (Patient L992-1013, Scribe L1511-1547) and the seven-line LINES transcript. Educational copy; fold into `module.copy.walkthrough` if a guided-demo mode is wanted, otherwise drop. LINES is superseded by the Scribe SCRIPT.

Keep-as-is is not viable: it would ship a scorer that disagrees with the instrument and a fairness policy without provenance under the same brand as the real apps. Once the four apps run on the shared engine, a "condensed demo" is just the shell with one module selected.

---

## 7. Top refactor risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Breaking instrument 0.2 comparability** by renaming identifiers to match the "Dizziness" label (Questionnaire URL, name, code system, `masque-index`, CDS service id, item ids, cohort column names, screen_id prefix). | high | Module carries these as opaque constants copied byte-for-byte; add a golden-file test that the generated Questionnaire, CDS document, data dictionary and a captured cohort row for the MASQUE module are identical to the 0.3.1 outputs (modulo the ctx bug fix). "Dizziness" appears only in `module.label`. |
| 2 | **Scoring regression while genericising** — e.g. adopting the Simulator's linear scoreItem, dropping itemBounds, hardcoding scale max 100, or letting band = bandFor(total) leak when unscorable. | high | Extract Screener L321-408 verbatim as the engine; port the 200,000-answer-set random sweep as a per-module test; assert positive-max = declared scale max in the loader; snapshot-test sample cases' totals/bands. |
| 3 | **Routing/summary logic mistranslated into rule data.** Screener recs, Scribe buildRecs and Patient buildSummary are ordered decision trees with magic indices (m_dur===2, v_vertigo===2), thresholds and fall-through order. | high | Write the rule evaluator first, then encode MASQUE's rules and diff outputs against the old inline functions over the four sample cases plus a generated answer sweep; keep rule order explicit in data; give SCALE indices symbolic names in the module. |
| 4 | **Gates becoming module-optional.** A module with few flags, no context items or no negative domain could skip the safety step, the gap alert or the coverage gate. | high | Gates live in the shell/engine with no module switch; loader requires ≥ 1 flag or renders the mandatory "none of these apply" step regardless; REQUIRE_SAFETY_REVIEW_TO_SIGN and ABSTAIN_FLOOR are shell constants. |
| 5 | **Import-time side effects and drift guards not re-run per module** (assertRedFlagCues, validateProbes, assertCoverage, assertLocales, Probes_Check regex over the Screener file). | high | Replace with `validateModule(module)` run on selection and in CI for every registered module; Probes_Check imports module ids. Fail loudly (throw in dev, banner in prod), not console.error only. |
| 6 | **Module switch leaving stale state** — answers keyed by item ids, rf, ctx, complaint, cohort rows, probe answers, transcript captures. | medium | Reset all screen state on module change; key the app component by module id; the session cohort is per module (or rows carry module id and the panel filters). |
| 7 | **Divergent copies reconciled the wrong way** (Scribe/Simulator red-flag abbreviations, Patient CONTEXT_Q option values, Simulator scale labels). | medium | Take the Screener as canonical per §2; treat every divergence as a clinical-lead decision logged in the module changelog; align Patient CONTEXT_Q values to the Screener's before extraction so the gap rule matches one vocabulary. |
| 8 | **Losing deliberate omissions and caveats** when copy becomes module data: patient app never showing scores or differentials; prototype/not-for-clinical-use banners; unreviewed-translation banner; "not a survey estimate"; empty CDS cards. | medium | Caveat strings belong to the shell and render unconditionally; the patient module schema has no field for points-to/differential text; REVIEWED defaults false per locale; add a test that no clinician `points` string appears in the patient build. |
| 9 | **Version bookkeeping ambiguity** with more than one instrument: modelVersion, manifest, cohort rows, footer lines. | medium | Add `module_id` to cohort rows, manifest, model card and footers alongside instrument/lexicon/probe/gold-set versions; reconcile APP_VERSION 0.3.0 vs README 0.3.1 once, before the refactor branch. |
| 10 | **Shared panel breakage for VOICED/BREATHE** when props or PROJECTS change. | medium | Keep the `project` string prop working (map to registry), keep scorable/ceiling/signalQuality defaults, keep BREATHE/VOICED registry entries; do not claim they run on the shared engine until they do. |
| 11 | **Lexicon/probe engines silently keyed to conventions** — `'yes'`/`'no'` strings, `c_`/`rf_` prefixes, phrases pre-lowercased, SCALE band order, rescue-without-target. | medium | Document the conventions in the module schema; branch on capture.kind not prefixes; loader lowercases or rejects phrases; validateProbes gains rescue/target rules; keep NEGATION.window with the module and re-run the sweep on change. |
| 12 | **CSS/global scope collisions** once four apps mount inside one shell (Screener and Scribe both define `.mq`, `.card`, `:root` tokens and `*{box-sizing}`). | low | Move tokens to the shell root; prefix or CSS-module the app classes; keep `.mp` and `.rrp-` as they are. |
| 13 | **Known bugs carried into the generic code** — Screener screenToCohortRow `ctx` ReferenceError (L585), buildBundle ignoring `floor` (L1526/L1549), Scribe skipPrompt writing 'no', raw item ids shown to clinicians. | low | Fix during extraction (use Scribe bundle as base with Screener's referral guard; pass ctx/visit_label; display item short labels); add tests for capture and bundle range. |

