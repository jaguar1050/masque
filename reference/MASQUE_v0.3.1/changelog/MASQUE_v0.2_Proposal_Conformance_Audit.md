# Project MASQUE — v0.2 Proposal Conformance Audit

**Audited against:** `Project_MASQUE_TOPx_HHS_Proposal.docx` (June 2026)
**Artifacts reviewed:** `MASQUE_Screener_v0_2.jsx`, `MASQUE_Scribe_v0_2.jsx`, `ResearchReadinessPanel.jsx`, `masque_cohort_template.csv`, `IMPLEMENTATION_README.md`
**Date:** 2 August 2026

---

## Verdict

The **screener half** of the proposal is built and is good. The **open-data half** — the thing that makes this an open-data submission rather than a clinic app — is scaffolded but not built, which the README states honestly.

Two issues are blocking regardless of data access, because a judge can hit both in under a minute:

1. **An empty screen returns "Low likelihood — continue standard ENT management."**
2. **An unlabeled cohort CSV silently becomes an all-negative labeled cohort and publishes validation metrics from it.**

Everything else below is ordered under those.

---

## 1. Conformance map

| Proposal section | Facet | Status |
|---|---|---|
| §1 | Composite screener + instrument routing | **Met** |
| §1 | AI on open data to quantify hidden prevalence | **Not built** (adapters listed, no dataset connected) |
| §2 | "Faster answers for patients" / data in public's hands | **Gap** — no patient-facing artifact exists |
| §2 | Cost of illness | **Partial** — weighted means over uploaded rows only |
| §2, §7.2 | Equity / fairness layer | **Partial** — audit only, no mitigation |
| §3.1 | Midfacial "sinus" migraine phenotype | **Met** |
| §3.1 | Vestibular migraine phenotype | **Partial** — not criteria-mappable (see 4.2) |
| §3.1 | Cochlear / otic migraine phenotype | **Gap** — no scored item |
| §3.1 | Cranial / small-fiber neuropathy | **Partial** — 3 items, no otalgia, no autonomic |
| §3.2 | Women's diagnostic-gap surfacing | **Met** (gap alert), sex-neutral by design |
| §5 | VM-PATHI as keystone, copyright-safe | **Met** — cleanly done |
| §5 | Full instrument crosswalk | **Gap** — MIDAS, THI, TFI absent |
| §6 | Eight open-data sources | **Met** — all present, correctly scoped |
| §7.1 | Recalcitrant-ENT computable phenotype | **Met** in item form |
| §7.2 | ICHD / Bárány anchor labels | **Gap** — never referenced; items don't map |
| §7.2 | Calibrated classifier | **Partial** — logistic, constants illustrative |
| §7.2 | NLP on openFDA narratives + benchmark | **Gap** — transcript rules only, no benchmark |
| §7.3 | Prevalence & cost dashboard | **Not built** |
| §7.3 | Screener + risk calculator | **Met** |
| §7.3 | FHIR-deployable specification | **Partial** — bundle yes, spec artifacts no |
| §7.3 | Methods repo: code, data dictionaries, model cards | **Partial** — model card yes, data dictionary claimed but absent |
| §8 | Psychometric validation | **Partial** — no α, no calibration curve, no CIs |
| §8 | Clinician-in-the-loop pilot capture | **Gap** — no path from a screen to a cohort row |
| §8 | Fairness audit, pre-specified metrics | **Partial** — metrics yes, thresholds/pass-fail no |
| §8 | Reproducibility check | **Gap** — no provenance in manifest |
| §11 | Decision-support framing, honest limitations | **Met** — consistently and well |
| §11 | Red-flag / safety guardrails | **Gap** — not wired in MASQUE |

---

## 2. Blocking — clinical safety

### 2.1 An incomplete screen reports "Low likelihood"

Path: select "Sinonasal" → Continue ×5. `canContinue` gates only step 0 (`Screener:363`). With zero answers, `useScore` sums to 0 → band `low` (`Screener:148-152`) → the fallback recommendation fires (`Screener:386-390`):

> "Features do not currently suggest an underlying migrainous or neuropathic driver. Continue standard ENT management."

That is the exact clinical error the proposal exists to correct, produced by the tool itself, with no data. Abstention does exist — but only inside the bottom panel, and it stops firing above **37.5% coverage** (`confidence = 0.72·coverage + 0.28·signalQuality`, `Panel:219-220`; MASQUE never passes `signalQuality`, so it defaults to 1 and gifts a flat 0.28). Eight of twenty-one items answered clears the bar.

**Fix:** gate the band itself on coverage. Below a declared floor, the result screen shows *Insufficient data — screen not scorable*, and the CDS card, ServiceRequest, and the "continue standard management" recommendation are all suppressed.

### 2.2 No red-flag interception

The panel already accepts `redFlags` and renders a safety override (`Panel:210, 256`), but neither MASQUE app passes it (`Screener:513`, `Scribe:598`). Nothing in the item set captures sudden or asymmetric sensorineural loss, unilateral or pulsatile tinnitus, new focal deficit, thunderclap onset, first severe headache after 50, vision loss, or fever with orbital signs.

A vestibular schwannoma or a temporal-arteritis presentation currently routes to "consider vestibular migraine." §11 leans on clinician judgment as the backstop, which is fair — but the tool should not be actively steering away from escalation.

**Fix:** a red-flag step before intake that hard-overrides the band and blocks routing. The panel's override UI is already written; only the wiring is missing.

### 2.3 Unanswered is scored as "no"

`scoreItem` treats `undefined` identically to a denial (`Screener:128-134`). The note builder then drops unasked items entirely (`Scribe:640`), so a chart note cannot distinguish *denied* from *never asked*. The QuestionnaireResponse writes only five domain aggregates (`Screener:726-729`), so the distinction is unrecoverable downstream too.

### 2.4 The screen can only confirm its own hypothesis

Every item adds points; nothing subtracts. §5 assigns SNOT-22 the job of *separating true sinus disease from migrainous facial pressure*, but no item captures purulence, hyposmia, endoscopic findings, or a Lund-Mackay score — and nothing captures the Ménière or ETD discriminators on the otologic side.

A confirm-only instrument inflates flag rate, and it inflates hardest in the group with the highest base rate of these complaints — women. That is the equity goal running backwards. Add two or three negative-weight discriminators.

---

## 3. Blocking — research integrity

### 3.1 Silent label imputation

`normalizeRows` (`Panel:142-151`) coerces missing values to defaults: `label → 0`, `annual_cost → 0`, `avoidable_cost → 0`, `weight → 1`.

Verified against a realistic unlabeled screening cohort (three rows, `score`/`sex`/`age` only):

| Panel reports | Truth |
|---|---|
| Reference labels: **Detected** | none present |
| Missingness: **0%** on all seven canonical fields | five fields absent |
| Specificity **33%**, PPV **0%** | undefined — no reference standard |

This is the failure mode §11's Integrity value is written against: the panel presents fabricated negatives as study output while its own banner says the numbers are illustrative. Anyone importing a real pre-label cohort gets metrics that look real.

**Fix:** preserve `null`. Count only explicit `0`/`1` toward `hasLabels`; suppress the entire validation tab when the labeled count is zero.

### 3.2 The missingness check cannot fire

`dataQuality.missing` (`Panel:195`) tests for `null | undefined | ""`, but `normalizeRows` has already replaced those with numbers for the five normalized fields. Missingness will report 0% for `score`, `label`, `weight`, `annual_cost`, and `avoidable_cost` on every import, forever. Only `sex`, `age`, and the VOICED extras report honestly.

### 3.3 Fairness gaps can read as 0% on one group

`fairness` (`Panel:182-192`) computes gaps as max − min after `.filter(Number.isFinite)`. A group with no positives yields `NaN` sensitivity and drops out. A cohort that reduces to one usable group reports a **0% sensitivity gap** — i.e. perfect fairness — from a single stratum.

The governance callout (`Panel:275`) promises exactly the review the code doesn't enforce: no minimum cell size, no confidence intervals, no pre-specified disparity tolerance, and no pass/fail rule, though §11 commits to rejecting the model if audits show widened disparity.

**Fix:** suppress any group below a declared *n*; show CIs; encode the tolerance and a visible PASS/FAIL.

### 3.4 Sex and gender are collapsed

`String(r.sex ?? r.gender ?? "unknown")` (`Panel:183`). §7.2 and §11 both say "sex/gender." Keep them as separate fields with explicit handling of small and undisclosed categories, and state which one drives stratification.

### 3.5 Psychometrics are structurally out of reach

§8 requires internal consistency and calibration. The canonical schema ingests an aggregate `score` only — no item-level columns — so Cronbach's α, item-total correlations, and factor structure cannot be computed at all. Calibration stops at Brier: no calibration-in-the-large, no slope, no reliability diagram. No confidence intervals anywhere in the panel.

**Fix:** add item-level fields to the schema and write item-level answers into the QuestionnaireResponse. This is the change that unlocks the most of §8 for the least work.

### 3.6 The pilot loop is open

§8's clinician-in-the-loop pilot needs flag rate, agreement, and downstream diagnostic change. The screener produces screens; the panel reads external files; nothing connects them. There is no export of a completed screen as a canonical row, no field for the eventual reference diagnosis, and no follow-up capture.

**Fix:** an "Append this screen to cohort" action emitting a template-schema row. The pilot then generates its own dataset, and the demo stops depending on synthetic rows.

### 3.7 No provenance

The manifest carries `generatedAt` and nothing else (`Panel:238`). §8's reproducibility check needs a dataset hash, row count, code version or commit, and a seed.

### 3.8 Data dictionary claimed but absent

The panel header comment claims "downloadable model card, data dictionary, and ingestion manifest" (`Panel:17`). Only Manifest (`Panel:268`) and Model card (`Panel:279`) exist. §7.3 lists data dictionaries as a methods-repo deliverable. Either ship it or drop the claim.

---

## 4. Proposal facets not represented

### 4.1 Instruments named in §5 but missing from the apps

Confirmed by search across all three JSX files:

| Instrument | §5 role | In code |
|---|---|---|
| VM-PATHI | Primary anchor | Yes |
| ID-Migraine | Case-finding | Yes |
| HIT-6 | Impact | Yes |
| SNOT-22 | Sinonasal burden | Yes |
| DHI | Dizziness comparator | Yes |
| SFN-SIQ / COMPASS-31 | Neuropathy / autonomic | Yes |
| **MIDAS** | Disability quantification | **Absent** |
| **THI / TFI** | Migrainous vs otologic tinnitus | **Absent** |
| **ICHD / Bárány** | Reference-label gold standard | **Absent** |

`v_aural` scores tinnitus but nothing routes to a tinnitus instrument, so §5's "characterizes migrainous vs. otologic tinnitus" row has no implementation.

### 4.2 Items don't map to the anchor criteria

§7.2 defines reference labels by ICHD and Bárány criteria. Bárány vestibular migraine requires **≥5 episodes**, duration **5 minutes to 72 hours**, migraine history, and migrainous features in **≥50%** of episodes.

`v_vertigo` reads "minutes to hours" (`Screener:69`) — it misses the 5-minute floor and the 72-hour ceiling. There is no episode-count item and no headache-duration item (ICHD needs 4–72 h). As written, the item set cannot be crosswalked to the criteria that §7.2 says will generate the training labels. This blocks the modeling plan, not just the paperwork.

### 4.3 Two phenotypes under-covered

- **Cochlear / otic migraine** (§3.1 bullet 3): fluctuating hearing appears only as descriptive text in the intake picker (`Screener:455`). No scored item, and no Ménière or ETD differential anywhere.
- **Cranial / small-fiber neuropathy** (§3.1 bullet 4): three items, none for otalgia and none autonomic — yet COMPASS-31 is the recommended next step.

### 4.4 No patient-facing artifact

The sprint track is *"AI tools from U.S. Open Data to help patients... reach answers and care faster"*, and §2 commits to putting open data "in the public's hands." Both prototypes are clinician-facing: SMART launch, physician prompts, chart write-back. A patient has no entry point.

This is the largest strategic gap. A patient-facing version of the same score — "here's what to ask your doctor about" — is a small build on top of what already exists and directly answers the track statement.

### 4.5 No prevalence and cost dashboard

§7.3's first output. Currently a browser CSV uploader computing weighted means. No dataset connected, no survey design variables (honestly disclosed at `Panel:277`). This is the deliverable that makes MASQUE an open-data project.

### 4.6 NLP component

§7.2 promises free-text extraction developed and benchmarked **on openFDA narratives**. Built instead: a rule-based transcript extractor (`Scribe:118-191`) with a fixed 22-character negation window (`Scribe:122`) and unversioned phrase lists. No precision/recall, no error analysis, no openFDA narratives touched.

Even a small hand-labeled benchmark with reported P/R would convert this from "unbuilt" to "in progress."

### 4.7 Equity layer is audit-only

§7.2 promises "reweighting or threshold adjustment to reduce, not encode, female underdiagnosis." No mitigation exists. `sex` is passed into the panel (`Screener:513`, `Scribe:598`) and used only as an echo in the model card (`Panel:239`).

The gap alert is deliberately sex-neutral (`Screener:355`) — defensible, and I'd keep it. But it means the entire equity claim rests on the fairness tab, which has the defects in 3.3 and 3.4.

### 4.8 "FHIR-deployable specification" has no artifacts

§7.3 promises a deployable spec. Present: a well-formed transaction Bundle. Absent: the **Questionnaire** resource itself (both apps reference `masque.example/Questionnaire/masque-screener-v0.1` — a URL pointing at nothing, `Screener:723`, `Scribe:681`), a CDS Hooks service/discovery JSON (the card at `Screener:654-665` is a styled div), a SMART launch manifest, and any LOINC or SNOMED codes.

Publishing the Questionnaire and a CDS Hooks service definition would make the "open, reusable" claim in §7.3 literally true and costs almost nothing.

---

## 5. Copy and consistency

- **Bridge2AI cited as a MASQUE source, twice** (`Screener:21`, `Screener:692`): *"pending validation on open data (Bridge2AI / NHANES / MEPS) per Project MASQUE."* Bridge2AI-Voice is a VOICED source and appears nowhere in the MASQUE §6 table. The panel scopes it correctly (`Panel:81`) — this is cross-project bleed in the screener only, and a reviewer reading both proposals will catch it.
- **Version drift, four ways:** filenames `v0_2`; UI badges read "v0.1" (`Screener:431`, `Scribe:449`); the Questionnaire URL says `masque-screener-v0.1`; `modelVersion` says `masque-prototype-0.2`. The README also lists files as `MASQUE_Screener_v0.2.jsx` against actual `MASQUE_Screener_v0_2.jsx`. Minor on its own, but it sits directly under a reproducibility claim.
- **Demo patient shows a DOB and MRN** in the banner (`Screener:121-124, 416`). Synthetic, but for a privacy-forward submission, label it "synthetic sandbox patient" or drop the DOB.

---

## 6. What's already right

Worth protecting in the next pass:

- **All eight §6 data sources present** with accurate per-source purposes (`Panel:30-39`).
- **Screener and scribe share an identical item model** — same IDs, same weights, domain maxima summing to 100. One scoring source of truth across two apps is unusual discipline at prototype stage.
- **Copyright posture is careful and consistent.** Authored items, VM-PATHI mirrored at domain level only, licensed-instrument language surfaced in both apps and the README. This holds up.
- **Honest-limitations posture matches §11** — synthetic-data warnings at panel, tab, and README level, none of them buried.
- **The gap alert is a real operationalization of §3.2**, not a slogan: three concrete markers, threshold of two, plain-language rationale.
- **FHIR shape is correct R4** — QuestionnaireResponse, Observation with domain components, conditional ServiceRequest, DocumentReference in the scribe.

---

## 7. Fix order

**Before any demo:**

1. Coverage gate on the band; kill "Low likelihood" on empty screens (2.1)
2. Red-flag step wired to the existing override UI (2.2)
3. `normalizeRows` preserves `null`; validation tab suppressed without real labels (3.1, 3.2)
4. Minimum cell size + suppression in fairness (3.3)
5. Remove the Bridge2AI references; unify version strings (§5)

**Before submission:**

6. Item-level capture in schema and QuestionnaireResponse — unlocks α and the pilot (3.5)
7. "Append this screen to cohort" — closes the pilot loop (3.6)
8. Bárány/ICHD-compatible items: episode count, 5 min–72 h duration, headache duration (4.2)
9. Two or three rule-out discriminators so the screen can argue against itself (2.4)
10. Patient-facing view of the same score (4.4)
11. Publish the Questionnaire resource + CDS Hooks service JSON (4.8)
12. MIDAS, THI/TFI routing; fluctuating-hearing item; otalgia and autonomic items (4.1, 4.3)

**Nice to have:**

13. Manifest provenance — hash, row count, code version, seed (3.7)
14. Data dictionary export, or drop the claim (3.8)
15. Small labeled openFDA benchmark with P/R (4.6)
16. Separate sex and gender fields (3.4)

Items 1–5 are roughly a day. Items 6–8 are the ones that convert §8 from a plan into a running process, and they're what a validation-minded judge will look for.
