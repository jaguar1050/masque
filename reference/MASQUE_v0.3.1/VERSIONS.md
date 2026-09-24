# MASQUE — versioning

**Release 0.3.1** · 5 August 2026

There are five version numbers in this codebase and they are deliberately not the
same number. Collapsing them would hide exactly the thing versioning is for.

| Axis | Constant | Current | Changes when |
|---|---|---|---|
| **Release** | filename suffix, `APP_VERSION` | **0.3.0** | any app-level change ships |
| **Instrument** | `INSTRUMENT_VERSION` | **0.2** | a scored item, weight, scale, or band cutpoint changes |
| **Lexicon** | `LEXICON_VERSION` | **0.3.1** | an extraction phrase list or negation parameter changes |
| **Probe set** | `PROBE_SET_VERSION` | **1.0.0** | a probe is added, removed, reworded, or reclassified |
| **Gold set** | `_meta.version` | **0.2.0** | a benchmark label is added or corrected |

## Why the instrument stays at 0.2 in a 0.3 release

`INSTRUMENT_VERSION` is not a build number. It identifies the scored questionnaire —
which items exist, what they weigh, where the band cutpoints sit. Every score, every
`QuestionnaireResponse`, every captured cohort row, and every published `Questionnaire`
resource is only interpretable against it.

Two screens taken six months apart under instrument 0.2 are comparable. If the
instrument number moved every time a button label changed, nobody could tell whether
a cohort was poolable. So it moves only when the measurement moves — and the pilot
cohort schema records both, because a row needs to say what measured it *and* what
built it.

Release 0.3 changed the patient-facing app, the fairness axis handling, and the
extraction module. It did not touch a single item, weight, or cutpoint. Instrument
0.2 is therefore still correct, and bumping it would have silently invalidated
comparability for no reason.

## What is in release 0.3

Everything on the conformance-audit fix list, #1 through #16:

- **0.1 → 0.2** — coverage gating, red-flag interception, no-imputation ingestion,
  pre-specified fairness audit, citation and versioning cleanup, instrument v0.2
  (ICHD/Bárány-compatible items, negative-weight discriminators), item-level FHIR
  capture, published Questionnaire/CDS Hooks/data dictionary, pilot cohort capture,
  provenance fingerprint.
- **0.2 → 0.3** — patient-facing companion (`MASQUE_Patient_v0_3.jsx`), sex and
  gender split into independent fairness axes, extraction engine moved into
  `MASQUE_Extraction.js` with a runnable benchmark harness and a measured negation
  window.
- **0.3.1** — real-time encounter probes extracted into `MASQUE_Probes.js` and wired into
  the scribe: 32 probes ranked safety → re-ask → criteria → rule-out → supporting → exam
  rather than by point weight, including 14 vestibular-migraine probes from the Bárány/IHS
  literature. Instrument untouched — rescue probes set existing items, and supporting
  features are recorded as notes and score zero, enforced by `MASQUE_Probes_Check.mjs`.
- **0.3.0 point release** — §11 deployment gate (a fairness FAIL now withholds the
  model probability and decision rather than annotating them), calibration-in-the-large,
  calibration slope and a reliability table, pseudonymous `subject_id` and repeat-measures
  statistics, the survey-estimates bridge under `etl/`, and a repository README.
  Instrument untouched throughout.

## Files

| File | Versioned by |
|---|---|
| `MASQUE_Screener_v0_3.jsx` | release |
| `MASQUE_Scribe_v0_3.jsx` | release |
| `MASQUE_Patient_v0_3.jsx` | release |
| `ResearchReadinessPanel.jsx` | none — carries no independent version; ships with the release |
| `MASQUE_Extraction.js` | `LEXICON_VERSION` internally |
| `MASQUE_Probes.js` | `PROBE_SET_VERSION` internally |
| `MASQUE_Simulator.jsx` | release — single-file demo, carries an inline copy of the probe set |
| `MASQUE_Extraction_Benchmark.mjs` | reports whatever it imports |
| `masque_extraction_goldset.json` | `_meta.version` |
| `masque_cohort_template.csv` | instrument (column set follows item ids) |

The shared panel and the extraction module are imported by path without a version
suffix on purpose: renaming them each release would break every import for no
informational gain, and both already report their own state into the model card and
the benchmark report.
