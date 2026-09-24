# Project MASQUE — methods repository

Release **0.3.1** · instrument **0.2** · lexicon **0.3.1** · probe set **1.0.0**

Open screening instrument and research tooling for migraine- and neuropathy-masquerading ENT presentations. Satisfies proposal §7.3's methods-repository deliverable: code, data dictionaries, and model cards.

> **Prototype.** Not for clinical use. Calibration constants are illustrative until fit on approved data. Nothing here has been validated in a clinical study, and every artifact says so on its own face rather than relying on this line.

---

## Start here

| I want to… | Open |
|---|---|
| Understand what was built and why | `MASQUE_v0.3_Proposal_Reaudit.md` |
| See what's still missing | same file, §2 |
| Connect a real dataset | `etl/README_DATA_CONNECTION.md` |
| Know why four version numbers differ | `VERSIONS.md` |
| Trace one design decision | `changelog/` — one file per fix |

---

## Applications

| File | What it is |
|---|---|
| `MASQUE_Screener_v0_3.jsx` | Clinician screener. Six steps behind a mandatory safety gate; FHIR write-back; pilot cohort capture. The reference implementation of the instrument. |
| `MASQUE_Scribe_v0_3.jsx` | Ambient scribe. Extracts findings from encounter speech, prompts for high-yield gaps, drafts a note. |
| `MASQUE_Patient_v0_3.jsx` | Patient companion. Produces a visit-preparation summary. No score, no band, no probability, no research capture — see its header for why each of those is deliberate. |
| `ResearchReadinessPanel.jsx` | Shared research layer embedded in the screener and scribe: cohort ingestion, validation, calibration, fairness audit, repeat measures, population estimates, model card. |
| `MASQUE_Extraction.js` | The extraction engine and its versioned lexicon. Lives outside the scribe so it can be benchmarked. |
| `MASQUE_Probes.js` | Real-time encounter probes — what to ask or do next while the patient is in the room. Ranked by what the answer could change, not by what it scores. Lives outside the scribe so a clinician can review it without reading JSX. |
| `MASQUE_Simulator.jsx` | Single-file interactive demo of all four apps, for review without a build step. Carries an inline copy of the probe set so it runs standalone. |

All are single-file React components. `MASQUE_Screener` and `MASQUE_Scribe` import `./ResearchReadinessPanel`; the scribe also imports `./MASQUE_Extraction`. Keep them in one directory or fix the import paths.

## Benchmark

```bash
node MASQUE_Extraction_Benchmark.mjs              # prints the report
node MASQUE_Extraction_Benchmark.mjs --json out.json
```

| File | What it is |
|---|---|
| `MASQUE_Extraction_Benchmark.mjs` | Harness. Per-item P/R/F1, error taxonomy, negation-window sweep, automatic saturation warning. |
| `masque_extraction_goldset.json` | 44 authored utterances. **Not openFDA.** Revision log records every label corrected after the harness disagreed with it. |
| `extraction-benchmark.json` / `EXTRACTION_BENCHMARK.txt` | Last committed run. |

**Read the saturation block before quoting any number from this.** The rules were tuned against this set, so the headline F1 is in-sample and the harness says so itself.

## Probe set

```bash
node MASQUE_Probes_Check.mjs     # referential integrity + the invariants below
```

Two rules are enforced in code rather than left to review:

- A **rescue** probe stays live while its target reads negative. It is an alternate phrasing for an item the first wording may have missed — Bárány enumerates five qualifying vestibular symptom types, and in published cohorts internal vertigo outnumbers external spinning, so one wording of one question can decide the whole vestibular arm. Rescues set existing items, so the instrument does not change.
- A **supporting** (phenotype) probe must never write to a scored item. These are literature-supported features with no v0.2 home; they are recorded as notes and score zero. Totalling them would invent a measurement the validated instrument does not make. They are instrument v0.3 candidates — a clinical decision and a version bump, not something a prompt panel does quietly.

## Population estimates

```bash
Rscript etl/masque_population_etl.R --data ./adult24.csv \
  --map etl/phenotype_map_nhis_2024.json --out ./masque-population-estimates.json
```

| File | What it is |
|---|---|
| `etl/README_DATA_CONNECTION.md` | Why survey data must not go through the cohort loader, and what to do instead. |
| `etl/masque_population_etl.R` | Design-aware estimation. Subsets the design, not the data frame. |
| `etl/phenotype_map_nhis_2024.json` | Variable map. Design block verified; **symptom block is TODO by design** — see the file. |
| `etl/population_estimates.schema.json` | Contract between the ETL and the panel. |

## Data

| File | What it is |
|---|---|
| `masque_cohort_template.csv` | Canonical import schema with item-level columns. |
| `package.json` | `{"type":"module"}` so the `.mjs` tooling runs. |

---

## Invariants

Four rules the codebase holds everywhere. Each was a real defect before it was a rule, and each has a changelog.

**Absent data is never rendered as negative data.** A missing label is not a negative case (`normalizeRows`). An unanswered item is not a denial (`useScore`). A cohort with no reference labels gets no validation metrics rather than a full table of fabricated negatives.

**Gate, don't warn.** An unfinished screen reports no band. A red flag withholds routing. A fairness FAIL withholds the model's probability and decision. Where the proposal commits to refusing something, the code refuses it.

**Report the denominator, or don't report.** Subgroups below the reporting minimum are suppressed with their size shown. Intervals accompany every rate. A gap that can't be distinguished from zero is INCONCLUSIVE, never PASS.

**Say what a number is.** Illustrative calibration is labelled illustrative. An in-sample benchmark says in-sample. A cohort weighted mean says it is not a survey estimate.

## Known gaps

Full list in `MASQUE_v0.3_Proposal_Reaudit.md` §2. The load-bearing ones:

- **No population estimate yet.** The mechanism exists; the variable map needs filling from the codebook and the ETL needs running. This is the largest gap against the proposal.
- **Equity mitigation is proposed, not applied.** Threshold adjustment is computed and evaluated on held-out data, with the specificity cost shown alongside the sensitivity gain. Applying group-specific thresholds at the point of care is an institutional decision, not a setting. Reweighting is not implemented and not applicable — it is a fit-time intervention and this model is not fitted.
- **Fairness tolerances are placeholders and unattributed.** 10% across all three metrics, chosen to make the machinery concrete. `toleranceSetBy` / `toleranceRationale` are null, so the panel reports a PASS as provisional until someone signs for the number.
- **Extraction benchmark is saturated.** Needs real FAERS narratives and a second annotator, not more tuning.
- **Spanish is drafted, not reviewed.** `REVIEWED.es` is false and the app says so on every screen and in the exported file. It needs a bilingual clinician before use with patients.
