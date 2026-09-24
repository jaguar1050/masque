# Fixes #15 and #16 — the last two audit items

Closes audit findings **4.6** (openFDA NLP benchmark) and **3.4** (sex/gender conflation).
New: `MASQUE_Extraction.js`, `MASQUE_Extraction_Benchmark.mjs`, `masque_extraction_goldset.json`, `extraction-benchmark.json`, `EXTRACTION_BENCHMARK.txt`, `package.json`.
Changed: `MASQUE_Scribe_v0_2.jsx`, `ResearchReadinessPanel.jsx`, `MASQUE_Screener_v0_2.jsx`, `masque_cohort_template.csv`.

**Every item on the fix list is now closed.**

---

# #16 — Sex and gender as separate axes

## The bug

`String(r.sex ?? r.gender ?? "unknown")`. A cohort stratified "by sex" was in fact stratified by *whichever column happened to exist per row*, which is neither variable. §7.2 and §11 both say "sex/gender"; the code silently answered a question nobody asked.

## What it actually did, measured

On a 120-row cohort where the axes diverge for 12 rows and 9 rows carry gender only:

```
collapsed 'sex' groups : female(62) male(49) woman(9)
correct sex groups     : female(62) male(49)  · 9 excluded
```

The collapse **invented a "woman" category inside a sex-stratified table** out of gender values. And the two axes give materially different compositions — 62 female vs 59 woman, because 12 rows differ.

## The fix

- `normalizeRows` normalizes `sex` and `gender` independently, with `sex_at_birth`/`birth_sex` and `gender_identity` as accepted aliases. **No fallback between them, ever.**
- `fairness(rows, cfg, policy, axis)` takes the axis explicitly. Rows with no value on that axis are counted and displayed but **do not form a group** — an "unknown" bucket built from missing data is not a subgroup, and letting it into a max−min gap manufactures a disparity between people and an absence.
- Fairness tab gets a **Stratify by: sex | gender** selector, disabled per axis when the column is absent, with an explicit count of rows excluded for having no value.
- The read-this note now names the axis: a pass on one is not a pass on the other.
- Model card records `fairnessAxis` — what it stratified on, what was available, groups reported, groups suppressed, rows excluded.
- Propagated to `screenToCohortRow`, the data dictionary, the CSV template, and both demo patients.

Demo rows now include cases where the axes diverge, one row with gender but no sex, and a 4-row `nonbinary` stratum that is **suppressed rather than reported** — the minimum-cell rule working, which is both the statistically right answer and the privacy-protective one.

---

# #15 — Extraction benchmark

## Why the engine moved first

Rules embedded in a React component cannot be swept, versioned, or run against a corpus. That is *why* §7.2's benchmarking commitment had gone unmet — not neglect, structure. So `MASQUE_Extraction.js` now owns the lexicon and the `extract` function, `MASQUE_Scribe_v0_2.jsx` imports it, and the benchmark imports the same module. **The harness scores the code that ships, not a copy of it.** A drift guard fails loudly if a red flag ever lacks cue phrases.

`LEXICON_VERSION` changes whenever a phrase list does, so any claimed figure is attributable to a specific rule set.

## What the benchmark found

Running it for the first time surfaced **four real bugs and three of my own labelling errors**:

| Found | Fix |
|---|---|
| `m_photo` missed "light sensitivity" (only "sensitive to light" was listed) | vocabulary |
| `m_fhx` missed "my mother gets migraines" — and worse, third-party gating was *suppressing family history*, which is inherently third-party | vocabulary + `thirdPartyExempt` |
| `n_viral`, `r_normal` missed narrative register ("following a viral illness", "no acute abnormality") | vocabulary |
| First-hit-only negation: *"it's not the weather — it's when I skip meals"* recorded `m_trig = no` after the patient named a trigger | new `allHits()`; any unnegated mention wins |
| Three gold labels were wrong and the extractor was right | gold set corrected, **and logged** |

That last row matters. A gold set edited to match its system stops being a gold set, so `_meta.revisionLog` records every change with its reason rather than silently amending.

## The negation window is now measured, not guessed

It was `22` with no recorded justification. The sweep's first run was **flat across every window tested** — which was itself the finding: the set didn't discriminate the parameter at all, so the constant was still unjustified. Once the vocabulary gaps were fixed the sweep started discriminating:

```
window  10   F1  95.2%
window  14   F1 100.0%   <- shipped
window  18   F1 100.0%
window  22   F1 100.0%
window  26   F1  97.6%   <- previously shipped
window  44   F1  95.2%
```

Shipped value is now **14** — the smallest window on the plateau, because a narrower scope is the more conservative reading of a negation: it errs toward capturing a symptom the patient mentioned rather than deleting one they never denied. The harness reports plateaus as plateaus and refuses to pick an arbitrary tie-break.

## The headline number is the least useful thing in the report

Final run: **F1 100.0%** across 44 utterances. That number is worthless and the harness says so itself, automatically, without relying on whoever reads it to remember:

```
** SATURATED — DO NOT REPORT THE HEADLINE NUMBER AS PERFORMANCE. **
F1 is 100.0% on a 44-utterance authored set with no held-out split.
Rules were revised in response to this set (lexicon 0.2.0 → 0.3.1), so all
figures above are IN-SAMPLE.
This means the set has stopped being informative, not that extraction is solved.
```

The same flags are in the JSON report: `inSample: true`, `heldOutSplit: false`, `annotators: 1`, `interAnnotatorAgreement: null`.

## Red flags are scored separately, on purpose

They are never negation-checked, attribution-checked, or history-checked — capture may raise a flag, never clear one. Precision on them is therefore expected to be poor by design, so the harness breaks them out rather than blending them into the headline. Optimising that slice would mean letting text suppress a safety prompt.

## openFDA

`faersToUtterances()` maps the FAERS record shape onto the harness input. It is **a declared interface, not a validated one** — access is pending and it has never been run on live data. Every output path says so. The gold set includes eight narrative-register proxy cases so the register gap is measured rather than discovered later, but they are authored prose, not FAERS.

---

## Verification

All four JSX files build clean; `MASQUE_Extraction.js` passes `node --check`; the benchmark runs end to end and writes both artifacts.

## What I'd flag before submission

**The extraction benchmark is now honest but not yet useful.** It has done its job — it found seven defects in one afternoon — but a saturated 44-case authored set can't do that twice. The next increment isn't more tuning, it's harder data: a FAERS pull through the adapter, a second annotator with an agreement statistic, and a held-out split written by someone who didn't write the rules. Until then the right claim in the proposal is "benchmark harness built and rules debugged against it," not a number.

**#16 leaves one open question I can't settle.** The audit called for separate sex and gender; that's done. But `gender` is free text with no fixed enumeration, which is deliberate — a closed list would either be wrong or enormous — and it means two cohorts using different vocabularies won't stratify comparably. Whether to publish a recommended value set, or normalise at ingest, is a data-governance call for the study protocol rather than a code fix.
