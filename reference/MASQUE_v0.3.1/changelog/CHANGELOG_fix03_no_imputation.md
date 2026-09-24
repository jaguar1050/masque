# Fix #3 — Absent is not zero

Closes audit findings **3.1** (*silent label imputation*) and **3.2** (*the missingness check cannot fire*).
File changed: `ResearchReadinessPanel.jsx` only — the clinical apps are untouched.
Still open: **#4** (fairness minimum cell size), **#5** (Bridge2AI + version drift).

---

## The single invariant

`normalizeRows` was coercing every absent value to a default — `label → 0`, cost `→ 0`, `weight → 1`. One line, three separate fabrications, and the worst of them turned "we have no reference standard" into "every patient is a confirmed negative."

Everything below follows from one rule: **an absent value is preserved as `null` and excluded from computation. It is never imputed.**

Weight is the one documented exception, and it's split rather than fudged: the field stays `null` in the data so missingness reports it honestly, and the default of 1 is applied only at the point of computation in `weightOf()`.

## Why the downstream fixes were mandatory, not optional

Preserving `null` alone would have made things *worse*, because `Number(null) === 0`. Three consumers were silently relying on that:

| | Was | Now |
|---|---|---|
| `metrics()` usable filter | `[0,1].includes(Number(r.label))` → `null` passes as 0 | `r.label === 0 \|\| r.label === 1` |
| `dataQuality.hasLabels` | same defect | counts explicit 0/1 only |
| `weightedMean()` | `Number.isFinite(Number(null))` is **true** → null costs counted as $0 | absent values skipped in numerator *and* denominator |

`population()` also now drops rows with no score rather than scoring them as 0, and reports how many it dropped.

## New: present-but-unreadable is its own category

A label column full of `positive`/`negative` used to become all-zeros. Preserving nulls alone would make it read as simply "unlabeled" — accurate but useless, because the user has a label column right there and no idea why it isn't counting.

Each row now carries which canonical fields the source actually supplied, so the panel distinguishes *column absent* from *column present but unparsable* and names the offending field with a row count.

## Demo rows now travel the same path

`cfg.demo` bypassed `normalizeRows` entirely, so demo and imported data went through different code. Both now normalize, which is what makes the demo a real rehearsal of the import path rather than a separate happy case.

## What the tabs say now

- **Data** — "Reference labels" reads `N of M` with explicit 0/1, not a binary Detected/Not detected. Unreadable fields get a named callout.
- **Validation** — metrics are **withheld**, not degraded, when nothing is labeled, and the message states which of the three reasons applies (no rows / no labels / labels present but unparsable).
- **Population** — cost KPIs show `—` with "no cost data" rather than `$0`, and each carries the row count behind it.
- **Manifest / model card** — now record `missingDataPolicy` (the invariant above, in words) and `cohortState` (rows, labeled, unlabeled, scored, unparsed-by-field).

---

## Verification

Tested against the shipped logic extracted from the edited source:

```
1. Unlabeled cohort (score/sex/age only) — the reported bug
   labeled 0/3, hasLabels false
   missingness: label 100% · weight 100% · annual_cost 100%     (was 0% across the board)
   validation: WITHHELD                                         (was spec 33%, PPV 0%)
   mean annual cost: —                                          (was $0)

2. Label column coded 'positive'/'negative'
   unreadable: label(2) -> named, not silently dropped

3. Partially labeled (2 of 4)
   validation computed on the 2 labeled rows only
   mean annual cost $3,400                                      (was $1,700)

4. masque_cohort_template.csv rows — unchanged, 0% missing everywhere

5. Non-binary labels (2 / -1) -> rejected as unreadable, not silently included
```

Case 3 is the one worth dwelling on. Two of four rows had no cost data. Old behaviour averaged `(5000 + 1800 + 0 + 0) / 4 = $1,700`; correct is `(5000 + 1800) / 2 = $3,400`. **Every missing cost row halved the estimate** — and cost-of-illness is a headline deliverable in §2 and §7.3, not a side metric. The label bug was the more alarming finding; this one would have been the more embarrassing number to defend.

Fixes #1 and #2 re-verified: 200,000-set band sweep still returns zero unsafe assignments, and the red-flag bundle tests are unchanged.

---

## Where this leaves the integrity story

#1 and #3 were the same failure in two places — absent data silently rendered as negative data, once in the screener and once in the ingestion layer. Both are now closed under a stated rule rather than two patched symptoms, and the rule is written into the model card where a reviewer will actually see it.

That's worth saying explicitly in the submission. A reviewer who finds "unanswered items are never scored as negatives" and "unlabeled rows are never scored as negatives" as one declared invariant reads it as a design position. Finding them as two separate bug fixes reads as luck.

**#4 (fairness cell size) is the last blocker**, and it is the third instance of the same family: a subgroup with no positives currently drops out of the gap calculation via `.filter(Number.isFinite)`, so a cohort that reduces to one usable group reports a 0% sensitivity gap — absent data rendered as *fairness* this time.
