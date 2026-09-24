# Fix #4 — Fairness: suppression, intervals, and a verdict

Closes audit finding **3.3** (*fairness gaps can read as 0% on one group*), and picks up the missing confidence intervals from **3.5** along the way.
File changed: `ResearchReadinessPanel.jsx` only.
Remaining: **#5** (Bridge2AI citation + version drift) — cosmetic, not a blocker.

---

## The bug, and why it belongs to the same family as #1 and #3

Gaps were computed as `max − min` after `.filter(Number.isFinite)`. A subgroup with no positive cases has an undefined sensitivity, so it silently vanished from the calculation — and a cohort that reduced to one usable group reported a **0% sensitivity gap**, i.e. perfect fairness, measured across a single stratum.

That is the third instance of one failure: **absent data rendered as a reassuring result.** Unanswered items became a negative screen (#1). Unlabeled rows became negative cases (#3). A missing subgroup became demonstrated equity (#4).

## Three rules, declared before the numbers

`FAIRNESS_POLICY` is a named constant at the top of the file, not a threshold picked after seeing an outcome:

```
minGroupN: 30          rows in a subgroup before any rate is reported
minCellN:  10          rows in a metric's denominator before that rate is reported
tolerance: 10%         per metric, pre-specified
confidence: 95%
```

**1. Small groups are suppressed, not dropped.** The group and its size stay on screen; only the rates are withheld. Hiding that a stratum exists would be worse than reporting it thinly. Suppression also limits re-identification in small cells, which matters for the §11 privacy posture.

**2. Every rate carries an interval.** Point estimates are weighted; intervals use Wilson score bounds on Kish's effective sample size, `(Σw)²/Σw²`, so a handful of heavily weighted rows cannot masquerade as a large sample. Gaps use Newcombe hybrid-score intervals for the difference of two proportions.

**3. PASS must be earned.** This is the part that actually fixes the bug:

| Verdict | Condition |
|---|---|
| **PASS** | the entire interval sits below tolerance |
| **FAIL** | the entire interval sits above tolerance |
| **INCONCLUSIVE** | the interval spans tolerance |
| **NOT ASSESSABLE** | fewer than two reportable groups |

Failing to detect a gap in a small sample is INCONCLUSIVE, never PASS. Passing requires *demonstrating* the disparity is small — the non-inferiority framing, which is the correct epistemics for a fairness claim and the direct answer to a 0% gap computed from one stratum. FAIL is the branch §11 commits to when it says the model is rejected if audits show widened disparity.

## Verification

Interval maths checked against published reference values before anything else:

```
Wilson p=0.5, n=20   -> 0.299–0.701   (expected 0.299–0.701)
Wilson p=0,   n=10   -> 0.000–0.278   (expected 0.000–0.278)
Wilson p=0.9, n=100  -> 0.826–0.945   (expected 0.825–0.945)
Newcombe 0.90 vs 0.70, n=100 each -> 0.20, CI 0.090–0.306
```

### The reported bug

Two groups; only one has positive cases.

```
female  n=60   flag 50% [38-62]   sens 100% [89-100]
male    n=60   flag  0% [0-6]     sens n=0 < 10

selection    gap 50% CI [36, 62]   FAIL
sensitivity  —                     NOT ASSESSABLE
specificity  gap  0% CI [-11, 6]   PASS
```

Previously: sensitivity gap **0%**, read as fair. Now: sensitivity is honestly unassessable, *and* the 50% flag-rate disparity that was sitting in the same cohort is caught and failed.

### Sample size changes confidence, not direction

The same 20% sensitivity gap at two cohort sizes:

```
6a. 60 per group    sens gap 20%  CI [ 5, 37]   INCONCLUSIVE
6b. 600 per group   sens gap 20%  CI [16, 25]   FAIL
```

Identical point estimate. The small sample cannot reach FAIL — and, more importantly, cannot reach PASS either. That is the property the old code inverted.

### Other cases

```
Single stratum only              -> NOT ASSESSABLE  (was 0% gap)
Both groups n=12                 -> both SUPPRESSED, NOT ASSESSABLE
Large equivalent groups (n=400)  -> PASS, gaps 0% with tight intervals
40% of female positives missed   -> FAIL on selection AND sensitivity
```

Fixes #1–#3 re-verified: 200,000-set band sweep clean, unlabeled cohort still withholds validation, red-flag bundles unchanged. All three files build clean.

## Also picked up

Overall validation metrics on the Validation tab now show 95% CIs alongside sensitivity and specificity, with the positive/negative counts behind them. That was audit item 3.5's "no confidence intervals anywhere," and it came almost free once the interval machinery existed.

The model card now records `fairnessPolicy` (thresholds, pass rule, suppression rule, marked `prespecified: true`) and `fairnessAudit` (the verdict, per-metric codes, gap estimates with intervals, and which groups were compared).

---

## What is and isn't fixed

This closes the measurement half of the equity work. The proposal's §7.2 also promises **mitigation** — "reweighting or threshold adjustment to reduce, not encode, female underdiagnosis" — and that is still not implemented. The audit tells you whether you have a problem; it does not fix one.

I'd argue that ordering is correct rather than a shortfall, and worth stating that way in the submission: you cannot honestly claim to have reduced a disparity you had no instrument to measure. But it should be stated, not left for a reviewer to notice — the current model card says the audit exists, not that mitigation is deferred.

One judgement call embedded above: the 10% tolerance is a placeholder I chose to make the machinery concrete. It is the one number in this fix that should be set by you on clinical grounds and, ideally, cited — a disparity tolerance is a clinical and ethical commitment, not an engineering default.
