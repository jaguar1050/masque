# Project MASQUE — Release 0.3 Conformance Re-audit

**Audited against:** `Project_MASQUE_TOPx_HHS_Proposal.docx` (June 2026)
**Release:** 0.3.0 · instrument 0.2 · lexicon 0.3.1 · gold set 0.2.0
**Date:** 4 August 2026
**Supersedes:** `MASQUE_v0.2_Proposal_Conformance_Audit.md`

---

## Verdict

The clinical instrument half of the proposal is now built, gated, benchmarked, and honest about its own limits. All sixteen items from the v0.2 audit are closed.

**The open-data half is still not built.** That was the finding in the first audit and it is still the finding. Everything since has improved the screener; nothing has connected a dataset. §9 lists "population prevalence/cost estimates" as a Build-phase deliverable and there is no artifact corresponding to it.

Three further deficits surfaced in this pass that the first audit missed, one of which is a governance inconsistency rather than a gap.

---

## 1. Conformance map

| Proposal section | Facet | v0.2 | **0.3** |
|---|---|---|---|
| §1 | Composite screener + instrument routing | Met | **Met** |
| §1, §4 | AI on open data to quantify hidden prevalence | Not built | **Not built** |
| §2 | Faster answers for patients / data in public's hands | Gap | **Met** — patient companion |
| §2 | Cost of illness | Partial | **Partial** — local rows only |
| §2, §7.2 | Equity / fairness layer | Partial | **Partial** — measured, not mitigated |
| §3.1 | All four masquerade phenotypes | Partial ×3 | **Met** |
| §3.2 | Women's diagnostic-gap surfacing | Met | **Met** — now also patient-side |
| §5 | Full instrument crosswalk | Gap | **Met** — all 9 present |
| §5.1 | VM-PATHI as keystone, copyright-safe | Met | **Met** |
| §6 | Eight open-data sources | Met | **Met** |
| §7.1 | Recalcitrant-ENT computable phenotype | Met | **Met** |
| §7.2 | ICHD / Bárány anchor labels | Gap | **Met** — items crosswalk |
| §7.2 | Calibrated classifier | Partial | **Partial** — constants illustrative |
| §7.2 | NLP benchmarked on openFDA narratives | Gap | **Partial** — harness built, corpus unrun |
| §7.2 | Reweighting / threshold adjustment | Gap | **Not implemented** (declared) |
| §7.3 | Prevalence & cost dashboard | Not built | **Not built** |
| §7.3 | Screener + risk calculator | Met | **Met** |
| §7.3 | FHIR-deployable specification | Partial | **Met** |
| §7.3 | Methods repo: code, dictionaries, model cards | Partial | **Partial** — no index |
| §8 | Internal consistency | Gap | **Met** — α + item-total |
| §8 | Calibration | Partial | **Partial** — Brier only |
| §8 | Sensitivity / specificity | Met | **Met** |
| §8 | Clinician-in-the-loop pilot capture | Gap | **Partial** — no repeat measures |
| §8 | Fairness audit, pre-specified metrics | Partial | **Met** |
| §8 | Reproducibility check | Gap | **Partial** — panel yes, population n/a |
| §11 | Decision-support framing | Met | **Met** |
| §11 | Red-flag guardrails | Gap | **Met** |
| §11 | Rejected if audits widen disparities | Gap | **Reported, not enforced** |

---

## 2. Remaining deficits, in order

### 2.1 The population estimate and dashboard — still absent

§1 promises to "use AI on U.S. Open Data to quantify how many people — and which subgroups — carry recalcitrant sinonasal/otologic phenotypes." §4 calls the population estimate the *first* of three things "none of which currently exists." §7.3 lists the dashboard as the *first* output. §9 schedules it for weeks 4–7.

What exists: a browser panel that ingests a local CSV and computes weighted means, correctly caveated that final estimates need design variables, strata, PSUs, cycle pooling, and source-specific variance methods. All eight sources are named with accurate purposes and adapter stubs. No dataset is connected.

This is the deliverable that makes MASQUE an open-data project rather than a well-built clinic app, and it is the one a TOPx reviewer will look for first. Everything else on this list is small by comparison.

### 2.2 §11's rejection commitment is reported, not enforced — *new*

§11 commits that the model "is rejected if audits show it widens disparities."

The panel does the hard part: pre-specified tolerances, Newcombe intervals, minimum cell sizes, a PASS/FAIL/INCONCLUSIVE/NOT ASSESSABLE verdict, and a red banner on FAIL reading *"the model is not fit to deploy on this cohort until this is addressed."*

Then it emits a probability and a FLAG decision anyway. `abstain` depends only on `scorable` and `confidence`; the fairness verdict gates nothing.

This matters because it is inconsistent with the codebase's own established pattern. Fix #1 gates the band on coverage rather than warning about it. Fix #2 gates routing on red flags. Fix #3 withholds validation metrics entirely rather than flagging unlabeled rows. Fairness is the one governance commitment still sitting on the warning side of that line — and it is the one the proposal states in the strongest terms.

Small fix: add the fairness verdict to the abstention condition, or gate the FLAG decision on it. The judgement call is whether a cohort-level FAIL should suppress an individual patient's output, which is arguable both ways — but "banner only" is the one option the proposal's wording doesn't support.

### 2.3 The cohort schema cannot express repeat measures — *new*

`screenToCohortRow` emits `screen_id` (unique per screen), `captured_at`, both version stamps, item-level answers, and an empty `label` / `reference_diagnosis` pair for follow-up. There is no subject identifier and no timepoint.

So every longitudinal psychometric property is structurally unreachable: test–retest reliability, responsiveness, and MCID validation all need two administrations linked to one person. §5.1 leans on exactly those properties to justify VM-PATHI as the keystone — test–retest r ≈ 0.90, MCID ≈ 6 points, "responsiveness to treatment" — and §8 asks for psychometric validation of the composite screener, not just of the anchor.

Cronbach's α works because it is single-administration. Nothing else does. The pilot as currently instrumented can measure flag rate and (once diagnoses are filled in) agreement and downstream diagnostic change, but it cannot measure whether the MASQUE score is stable or whether it moves when the patient improves.

Fix: a pseudonymous `subject_id` plus `timepoint` in the row. That is a schema change, not an algorithm change, and it is cheap now and expensive after the pilot starts collecting rows.

### 2.4 Calibration is still only Brier — *new*

§8 names three psychometric requirements: internal consistency, **calibration**, and sensitivity/specificity. Two are now properly instrumented. Calibration is represented by Brier score alone, which conflates calibration with discrimination — a model can improve its Brier by getting sharper while getting *worse* at being right about probabilities.

Missing: calibration-in-the-large (mean predicted vs. observed), calibration slope, and a reliability diagram. §7.2's whole premise is "a calibrated classifier that outputs the probability of an underlying migrainous/neuropathic driver," so calibration is not a nice-to-have here — it is the adjective in the deliverable.

### 2.5 Equity mitigation remains declared-but-absent

§7.2 promises "reweighting or threshold adjustment to reduce, not encode, female underdiagnosis." The model card records `equityMitigation: { status: "not implemented" }` with a stated rationale — measurement precedes mitigation, a disparity cannot be honestly claimed reduced before there is an instrument capable of detecting it.

That rationale is sound and the honesty is the right posture. It is still an unmet §7.2 bullet, and it should be described that way in the submission rather than left for a reviewer to discover.

### 2.6 The methods repository has no index

§7.3 promises "a methods repository (code, data dictionaries, model cards) released openly for reuse." The contents exist and are good. What's missing is an entry point: a reviewer opening the folder finds eleven files and nine changelogs with no statement of what runs, how, or in what state.

`VERSIONS.md` (added this pass) covers the version axes. A README covering *what each file is and how to run it* does not exist.

### 2.7 The extraction benchmark is saturated

Not a deficit against the proposal — §7.2's "develop and benchmark" is now genuinely met, and the harness found seven defects on its first run. But it scores 100% in-sample on a 44-case authored set and reports its own saturation. It cannot find anything further. The next increment is a FAERS pull through `faersToUtterances()`, a second annotator, and a held-out split — not more tuning.

### 2.8 Patient app is English-only

§2's "public's hands" framing, and an Arizona-based pilot. The wording map is a single object with no logic, structured for translation. Unchanged from the last pass; still a judgement call about which languages.

---

## 3. What changed in this pass

**Version labelling.** Files renamed to the 0.3 release line; `APP_VERSION` aligned at 0.3.0 across all three apps (the patient companion was at 0.1.0). `VERSIONS.md` added, documenting why four version numbers exist and are deliberately different — release 0.3.0, instrument 0.2, lexicon 0.3.1, gold set 0.2.0. Instrument stays at 0.2 because release 0.3 changed no item, weight, or cutpoint, and bumping it would have silently invalidated cohort comparability for nothing.

**Two dead imports removed.** The #15 extraction refactor left `firstHit` and `LEXICON_VERSION` imported into the scribe and unused. `firstHit` is gone; `LEXICON_VERSION` is now surfaced in the scribe footer alongside the app and instrument versions, since the scribe ships a versioned dependency and should say which one.

---

## 4. Verification

```
instrument parity     screener 30 · scribe 30 · patient 30 — identical ids and weights
scoring               positive weights sum 100 · discriminators −29
instruments (§5)      VM-PATHI, ID Migraine, MIDAS, HIT-6, DHI, SNOT-22,
                      THI, TFI, SFN-SIQ, COMPASS-31, ICHD, Bárány — all present
open data (§6)        NHANES, NHIS, MEPS, DE-SynPUF, HCUP, openFDA,
                      WONDER, BRFSS, All of Us — all 8 sources named
dead imports          none across all four component files
builds                4/4 JSX clean · MASQUE_Extraction.js passes node --check
benchmark             runs end to end, writes both artifacts
```

---

## 5. If only two things get done before submission

**Connect one dataset.** Not all eight — one. A single NHIS or MEPS extract driving the population tab, with the design variables it already knows it needs, converts §7.3's first output from "scaffolded" to "demonstrated" and changes what the whole submission is. This is the difference between a clinic tool with an open-data section and an open-data project.

**Gate on the fairness verdict.** It is a small change, it removes the one place where the code warns instead of gating, and §11's language ("rejected") is the strongest governance commitment in the proposal. Shipping a build that prints "not fit to deploy" and then deploys is the kind of thing a reviewer notices.
