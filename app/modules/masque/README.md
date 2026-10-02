# MASQUE module — clinical rationale

**Prototype · not for clinical use.**

This file keeps the rationale that headed the source files of the MASQUE apps before they
became the screenAIr module "Dizziness and Sinusitis (MASQUE v1)". Each block below is the
header comment of one of those files, moved byte-for-byte from the frozen copy in
`app/tests/baseline/src/` (pinned by its `MANIFEST.sha256`); nothing in a block was reworded.
The blocks are the authors' notes as they stood at release 0.3.x: file names, release numbers
and "the real apps" refer to that code base, not to screenAIr. Six of those files are retired
from `app/src/` (see `docs/refactor/02-app-divergences.md`, "screenAIr 0.4.0"); the frozen copies,
`reference/fixed-src/` and git history keep them.

Where the module's content now lives:

- `masque.rubric.json` — items, weights, cut-points, red flags, context items, lexicon, patient
  wording, research configuration, FHIR/CDS identity and copy; `SOURCES.md` maps each field to
  its source lines.
- `masque.logic.js` — routing rules, phenotype derivation, the patient-summary rules and
  templates, and the probe set, with a header that maps each block to its source lines.
- `CHANGELOG.md` — the module's change log.

Version axes: instrument 0.2, lexicon 0.3.1, probe set 1.0.0, gold set 0.2.0 (the release is
screenAIr's own, `app/src/engine/policy.js`).

## Clinician Screener — file header

`MASQUE_Screener_v0_3.jsx` lines 8-26 (baseline SHA-256 `b478094a4d3421d1…`).

```text
/*  Project MASQUE — clinical screening prototype
    Migraine And Sensory-neuropathy Quantification in Underdiagnosed ENT presentations
    -------------------------------------------------------------------------------
    A SMART on FHIR-style decision-support app. It screens patients with recalcitrant
    sinonasal / otologic symptoms for a masked migrainous or neuropathic driver, then
    routes to the licensed confirmatory instruments and (optionally) a referral.

    Honesty notes intentionally surfaced in the UI:
      • Screening aid, not a diagnosis.
      • The item set below is authored for this prototype; it is NOT the validated
        instruments (VM-PATHI, SNOT-22, DHI, HIT-6, ID Migraine), which are named as
        the confirmatory step and administered under their own licenses.
      • The weighted model is interpretable and illustrative, pending validation on
        the open-data sources named in the Project MASQUE proposal §6 (NHANES, NHIS,
        MEPS, CMS PUF, HCUPnet, openFDA, CDC WONDER/BRFSS, All of Us). Bridge2AI-Voice
        belongs to VOICED and is not a MASQUE source.
      • No PHI leaves the browser; a real deployment extracts features at the edge and
        writes structured results back via FHIR.
*/
```

## Clinician Screener — item set rationale (the same text heads the Scribe's copy of the item set)

`MASQUE_Screener_v0_3.jsx` lines 153-171 (baseline SHA-256 `b478094a4d3421d1…`).

```text
/*  Item set v0.2 — aligned to the criteria the proposal names as anchor labels.

    Two structural changes from v0.1, both from the conformance audit:

    1. ICHD-3 and Barany criteria are now expressible. v0.1 could not be crosswalked
       to them: "minutes to hours" excluded Barany's 5-minute floor and 72-hour
       ceiling, and there was no episode-count item and no attack-duration item.
       Since proposal 7.2 generates its training labels from those criteria, the
       old item set could not have supported the modeling plan.

    2. Discriminators carry NEGATIVE weight. Every v0.1 item added points, so the
       screen could only accumulate evidence for its own hypothesis — and that
       inflation lands hardest on the group with the highest base rate of these
       complaints, which is the opposite of the equity goal. Proposal 5 assigns
       SNOT-22 the job of separating true sinus disease from migrainous facial
       pressure; nothing in v0.1 implemented it.

    Positive domains still sum to 100. Discriminators subtract up to 29.
*/
```

## Ambient Scribe — file header

`MASQUE_Scribe_v0_3.jsx` lines 12-28 (baseline SHA-256 `62c8091fb199c001…`).

```text
/*  Project MASQUE — Ambient Scribe prototype
    ------------------------------------------------------------------
    An ambient AI scribe that listens to the ENT encounter, captures symptoms into the
    MASQUE screen automatically, tracks coverage, and prompts the physician with the
    highest-yield questions still unasked — including the VM-PATHI vestibular-migraine
    domains when the otologic pathway lights up.

    Copyright-safe: the on-screen prompts are authored for this prototype and mirror the
    VM-PATHI *domains* (motion sensitivity, disequilibrium, headache equivalents,
    cognition, affect). They are NOT the VM-PATHI items themselves — the validated
    instrument is named as the licensed confirmatory step.

    Prototype only. Screening aid, not a diagnosis. The transcript comes from the
    scripted demo, from typed statements, or live from the microphone through the
    browser's own speech recognition (MASQUE_Voice.js). A deployment plugs in ambient
    ASR at the edge with no raw audio retained.
*/
```

## Patient Companion — file header

`MASQUE_Patient_v0_3.jsx` lines 7-52 (baseline SHA-256 `dacdbfff7f722e2f…`).

```text
/*  Project MASQUE — patient-facing companion (release 0.3)

    Why this exists
    ---------------
    The TOPx track asks for tools built on U.S. Open Data that help PATIENTS reach
    answers and care faster, and proposal §2 commits to putting that data "in the
    public's hands". Until now every MASQUE artifact was clinician-facing: SMART
    launch, physician prompts, chart write-back. A patient had no entry point at all.

    That gap is not cosmetic. Proposal §3.2 is about people — disproportionately
    women — who have already seen three or four clinicians over a year or more and
    been told it is stress. The single thing most likely to change that visit is not
    another clinician-side score. It is the patient arriving able to describe the
    pattern precisely and ask for the specific evaluation. This app does that and
    nothing more.

    What it deliberately does NOT do
    --------------------------------
    1. No score, no band, no probability, anywhere in the patient's view. The
       calibration constants are illustrative until fit on approved data (fix #3),
       and "85/100 — high likelihood" handed to a patient is an unvalidated number
       that invites self-diagnosis. The clinician summary lists which FEATURES are
       present, in clinical language. That is what actually speeds up a visit, and
       it cannot be misread as a result.

    2. No differential is ever shown for a red flag. The clinician build names what
       each flag points to — schwannoma, subarachnoid haemorrhage, giant cell
       arteritis. A patient reading that list at 1am is harmed, not helped. Here a
       flag carries only two things: how fast to be seen, and the exact sentence to
       say when calling. Same safety behaviour, no terror.

    3. No automatic research capture. The clinician build appends screens to the
       pilot cohort (fix #7/#11). Patient-entered data carries different consent
       obligations than clinician-entered data, so nothing here writes to a cohort.
       Export is patient-initiated, local, and goes to the patient.

    The "Not sure" answer
    ---------------------
    Every yes/no question offers Yes / No / Not sure, and "Not sure" leaves the item
    genuinely unanswered rather than coercing a 0. This is the same no-imputation
    invariant the ingestion layer and the coverage gate run on — absent data is never
    rendered as negative data. It also turns out to be the most useful thing in the
    app: an honest "I don't know whether my scan showed inflammation" becomes a
    question on the visit summary, which is exactly the sort of thing that stalls
    these workups for months.
*/
```

## Extraction — file header

`MASQUE_Extraction.js` lines 1-22 (baseline SHA-256 `3849c0e86ba3e9cd…`).

```text
/*  Project MASQUE — free-text extraction module

    Proposal §7.2 commits to "developing and benchmarking free-text extraction on
    openFDA narratives". The conformance audit found the extraction built but the
    benchmark absent: rules lived inline in the scribe, the negation window was an
    unexplained constant, the phrase lists carried no version, and no precision or
    recall had ever been measured.

    Splitting the engine out of the UI is the precondition for the rest. A rule set
    embedded in a React component cannot be benchmarked, swept, versioned, or run
    against a corpus — so this module owns the lexicon and the extract function, and
    MASQUE_Scribe imports it. MASQUE_Extraction_Benchmark.mjs imports the same
    module, which is the point: the harness scores the code that ships, not a copy.

    LEXICON_VERSION changes whenever a phrase list changes. Benchmark reports record
    it, so a claimed precision/recall is always attributable to a specific rule set.

    Honest scope: this is a transparent rule-based extractor, not a learned model.
    That is a deliberate choice for a safety-adjacent prototype — every capture can
    be traced to the phrase that produced it — but it caps achievable recall, and the
    benchmark exists to say by how much rather than to flatter it.
*/
```

## Probes — file header

`MASQUE_Probes.js` lines 1-19 (baseline SHA-256 `e34f5976889323b5…`).

```text
/*  Project MASQUE — real-time encounter probes
    Release 0.3.1 · PROBE_SET_VERSION 1.0.0 · instrument 0.2

    What to ask or do next, while the patient is still in the room.

    This module owns the probe set for the same reason MASQUE_Extraction.js owns the
    lexicon: rules embedded in a React component cannot be validated, versioned, or
    reviewed by a clinician who does not read JSX. MASQUE_Scribe imports it, the
    simulator imports it, and validateProbes() is run at module load by both.

    PROBE_SET_VERSION moves whenever a probe is added, removed, or reworded. It is
    independent of INSTRUMENT_VERSION on purpose — see the rescue/phenotype note below.
    Adding probes has not changed a single scored item, weight, or cutpoint, so
    instrument 0.2 remains correct and cohorts stay comparable.

    Clinical content is drawn from the Bárány Society / IHS consensus criteria for
    vestibular migraine and the surrounding literature. All patient-facing wordings are
    authored for this tool rather than reproduced from those documents.
*/
```

## Research-readiness panel — file header

`ResearchReadinessPanel.jsx` lines 8-23 (baseline SHA-256 `cb099e14c93d6949…`).

```text
/*
  Shared research-readiness layer for MASQUE, VOICED, and BREATHE.

  What this adds now, before restricted/public datasets are connected:
  - calibrated probability + confidence/abstention behavior
  - transparent feature/domain contribution explanations
  - CSV/JSON ingestion with schema inspection and data-quality checks
  - validation metrics when reference labels are present
  - subgroup/fairness metrics when sex/gender fields are present
  - prevalence, utilization, and avoidable-cost summaries when fields are present
  - downloadable model card, provenance record, and ingestion manifest (the instrument data dictionary is published by the clinical app, which owns the item set)

  It intentionally does NOT claim that the illustrative calibration constants or demo rows are
  clinically validated. Replace the project adapter's calibration and field mappings with estimates
  learned from the approved datasets and clinician-in-the-loop reference cohort.
*/
```

## Simulator — file header

`MASQUE_Simulator.jsx` lines 7-25 (baseline SHA-256 `bef25d1a61809b17…`).

```text
/*  MASQUE — interactive simulation, release 0.3.0 · instrument 0.2

    A condensed but behaviourally faithful build of the three MASQUE apps and the
    shared research panel, in one file so it runs in a chat artifact.

    FAITHFUL: the item set (all 30 ids, weights, scales, and the four negative-weight
    discriminators), band cutpoints, the attainable-range coverage gate, all twelve
    red flags and their tiers, the no-imputation ingestion rule, the fairness audit
    with minimum cell sizes and Newcombe intervals, the §11 deployment gate,
    calibration-in-the-large and slope, and the equity threshold adjustment.

    CONDENSED: FHIR bundle construction, the ambient-capture lexicon (a small subset
    runs here), cohort CSV export, the model card JSON, and the population artifact
    renderer. Those are unchanged in the release and not what a click-through tests.

    The probe rail is not in the real apps. It exists because this codebase is
    defined by what it refuses to do, and a refusal you cannot reach is a refusal
    you cannot check.
*/
```
