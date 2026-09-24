# Fix #1 — Coverage gating on the MASQUE band

Closes audit finding **2.1** (*"An incomplete screen reports 'Low likelihood'"*).
Files changed: `MASQUE_Screener_v0_2.jsx`, `MASQUE_Scribe_v0_2.jsx`, `ResearchReadinessPanel.jsx`.
No other audit item was touched — **#5 (Bridge2AI / version drift) is still open** even though it sits on lines adjacent to these edits.

---

## The approach: bound the index, don't just count answers

A flat coverage percentage would have worked, but it throws away a property the instrument already has: **every item can only add points.** So the answered items bound the final index from below, and the unanswered items define how far it could still rise.

```
total   = points from answered items          (the floor)
ceiling = total + weight of every open item   (the attainable maximum)
```

A band is reported only when `bandFor(total) === bandFor(ceiling)` — i.e. the whole attainable range sits inside one band. Otherwise the screen is `indeterminate`.

This gives the right asymmetry for free:

- **"High" resolves early.** Affirmative findings can't be un-found. A screen that already clears 67 is definitive at 62% coverage — no reason to make the clinician finish a form to confirm what's already established.
- **"Low" resolves late.** A rule-out is only meaningful once the remaining items *couldn't* push the index over 34. This is the direction that was actually unsafe.

It also avoids a false dependency: with everything denied and only the neuro domain unasked, headroom is 15 points, which cannot reach 34 — so the screen scores `low` correctly rather than nagging for irrelevant items.

## What changed

### Both apps

- `useScore` / `computeScore` now return `ceiling`, `coverage`, `scorable`, `answered`, and a weight-sorted `open` list. `band` becomes `"indeterminate"` when unsettled.
- Coverage is computed once inside the scoring function; the screener's duplicated inline calculation and the scribe's separate `coverage` memo are gone, so the two can no longer drift.
- Recommendations are gated. The reassuring fallback — *"No masked driver flagged… Continue standard ENT management"* — can no longer fire on an unfinished screen. It's replaced by an explicit "no result issued" card naming the range and the outstanding points per domain.
- CDS Hooks card and the `ServiceRequest` referral both require `scorable`.

### `MASQUE_Screener_v0_2.jsx`

- Result view shows `total–ceiling` with a hatched range band across the meter instead of a single needle at a score that isn't final.
- New **Outstanding items** panel lists the highest-weight unanswered items with their point values, and states plainly that unanswered items are not counted as denials.
- Chart write-back button relabels to *"Write partial screen to chart."*

### `MASQUE_Scribe_v0_2.jsx`

- Live pill reads *"Not scorable yet — range spans a cutpoint"* during capture, which is the honest state mid-encounter.
- **Prevented a trap this fix would otherwise have introduced:** suggestions were drawn only from the *active* pathway, so headroom parked in an inactive domain could hold the screen indeterminate with nothing left on screen to resolve it. While `!scorable`, the suggestion pool widens to every unanswered item, with active-pathway items still ranked first.
- `buildNote` no longer prints a `LOW likelihood` line on an incomplete screen — it prints the bounded range, the coverage, and an explicit "no rule-out is implied."

### `ResearchReadinessPanel.jsx`

- **Confidence no longer credits a signal-quality term the caller never supplied.** `signalQuality` defaulted to `1`, handing questionnaire-only MASQUE a flat `0.28` and dropping the effective abstention floor to 37.5% coverage. It now defaults to `null`; confidence is pure coverage unless a real value is passed, so the VOICED/BREATHE blend is preserved.

  | Coverage | Old | New |
  |---|---|---|
  | 20% | 42% — abstains | 20% — abstains |
  | **38%** | **55% — issues a result** | **38% — abstains** |
  | 54% | 67% — issues a result | 54% — abstains |
  | 55% | 68% — issues a result | 55% — issues a result |

- New `scorable` prop hard-overrides the arithmetic: an unscorable screen abstains at any coverage.
- `ABSTAIN_FLOOR` is now a named constant rather than a literal buried in an expression.
- Score and probability KPIs render as ranges when unsettled; the model card records `scorable`, `coverage`, `attainableRange`, `probabilityRange`, and `abstainFloor`.

### FHIR correctness

An incomplete screen previously posted a `final` Observation carrying a partial index with an `L` interpretation — downstream, indistinguishable from a completed negative screen.

| | Before | After (incomplete) |
|---|---|---|
| `QuestionnaireResponse.status` | `completed` | `in-progress` |
| `Observation.status` | `final` | `preliminary` |
| `Observation.valueQuantity` | partial index | omitted |
| `Observation.interpretation` | `L` (low) | omitted |
| — | — | `dataAbsentReason: temp-unknown` + explanatory note |
| `ServiceRequest` | drafted when band ≠ low | suppressed |

Two components were added to the Observation in both states: `screen-coverage` (percent answered) and, when unsettled, `attainable-range` as a `valueRange`. Codes remain in the existing `masque.example` placeholder system.

---

## Verification

All three files build clean under esbuild. Scoring was tested by extracting the shipped `useScore` from the edited source rather than a copy:

```
empty screen (0 answered)          cov   0%  range   0-100  band=indeterminate
vestibular only                    cov  19%  range  25-100  band=indeterminate   <- was "Low likelihood"
migraine domain only, all yes      cov  33%  range  30-100  band=indeterminate
mig+vest+impact yes, rest open     cov  62%  range  70-100  band=high            <- resolves early, correctly
all denied, neuro left unasked     cov  86%  range   0-15   band=low             <- no false dependency
all items denied                   cov 100%  range   0-0    band=low
all items affirmative              cov 100%  range 100-100  band=high
```

Random sweep over **200,000 answer sets**, checking three invariants — `low` never issued while `ceiling ≥ 34`, `high` never while `total < 67`, `moderate` never outside `[34, 67)`:

```
unsafe band assignments: 0
```

The demo sample cases (`sinonasal`, `otologic`) set all 21 items, so both still land on a full score and are unaffected.

---

## Follow-on

Fix **#3** (`normalizeRows` label imputation) is the next blocker and is independent of this change. Worth noting that #1 and #3 are the same failure in two places — absent data silently rendered as negative data — so it may be worth stating that as an explicit invariant in the model card before the submission.
