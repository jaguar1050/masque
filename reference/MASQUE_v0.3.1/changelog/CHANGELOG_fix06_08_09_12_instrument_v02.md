# Fixes #6, #8, #9, #12 — Instrument v0.2

Closes audit findings **2.4** (confirm-only screen), **3.5** (psychometrics structurally impossible), **4.1** (missing instruments), **4.2** (items not criteria-mappable), **4.3** (under-covered phenotypes).
Files changed: all three, plus a regenerated `masque_cohort_template.csv`.

These four went together deliberately. Each one changes the item set, so doing them separately would have meant three instrument version bumps and three rounds of reweighting. `INSTRUMENT_VERSION` moves `0.1 → 0.2` — the first real use of the split introduced in #5.

Still open: **#7** (screen→cohort export), **#10** (patient-facing view), **#11** (published Questionnaire + CDS Hooks JSON), **#13–16** (nice-to-haves).

---

## #8 — The items can now express the criteria the proposal anchors on

§7.2 generates training labels from ICHD-3 and Bárány criteria. v0.1 could not be crosswalked to either, so the modeling plan had no path to execution. Three items were missing outright:

| New item | Criterion |
|---|---|
| `m_dur` — untreated attack duration | ICHD-3 1.1 criterion B (4–72 h) |
| `v_count` — at least five episodes | Bárány VM criterion A |
| `v_migfeat` — migrainous features in ≥50% of episodes | Bárány VM criterion C |

`v_vertigo` was also rescaled. It read "minutes to hours," which excludes Bárány's 5-minute floor *and* its 72-hour ceiling; the bands are now `None / <5 min / 5 min–72 h / >72 h`, with only the middle band scoring fully.

## #9 — The screen can now argue against itself

Every v0.1 item added points. A screen that can only accumulate evidence for its own hypothesis will inflate its flag rate — and that inflation lands hardest on the group with the highest base rate of these complaints, which is women. The confirm-only design was an equity problem as much as an accuracy one.

A sixth domain, **Discriminators**, carries negative weight (−29 total):

| Item | Points to | w |
|---|---|---|
| `x_purulent` — purulence or positive culture during episodes | true sinus disease | −8 |
| `x_objective` — endoscopy/CT inflammation during a symptomatic period | true sinus disease | −8 |
| `x_lowfreq` — audiometric fluctuating low-frequency SNHL | Ménière, not cochlear migraine | −8 |
| `x_anosmia` — persistent hyposmia between episodes | sinonasal disease | −5 |

The Ménière discriminator is the one worth explaining. Subjective aural fullness and tinnitus stay *positive* (`v_aural`) because they belong to the cochlear-migraine phenotype in §3.1. What separates Ménière is **documented fluctuating low-frequency SNHL on an audiogram** — so the audiometric finding, not the symptom, carries the negative weight.

New sample case, **competing**: a strong migrainous picture with objective sinus disease alongside it. Under v0.1 it scored identically to the plain sinonasal case, because nothing could argue against the hypothesis.

## The consequence for fix #1, which had to be generalised

Fix #1 relied on every item only ever *adding* points, so the floor was simply the current total. Negative weights break that invariant: an unanswered rule-out can now pull the index **down**.

Each unanswered item now contributes its best case to the ceiling and its worst to the floor. With no negative items, negative headroom is zero and the behaviour reduces exactly to before.

**The clinically important consequence: a high band can no longer be issued while the discriminators are unanswered.** Verified over 200,000 random answer sets — zero high bands with an open rule-out. "High likelihood of masked migraine" without having asked whether there is objective sinus disease was never a finding; it was an assumption.

## #6 — Item-level capture, and what it unlocks

v0.1 wrote five domain subtotals to the QuestionnaireResponse. That threw away everything needed for psychometrics and for the pilot.

Every item now appears with its own `linkId`, nested under its domain. The distinction that matters: an item **asked and denied** carries `valueBoolean: false`; an item **never asked** carries no `answer` element at all. Collapsing those into a zero is the same error as #1 and #3, one layer down.

The payoff is on the Validation tab. **Cronbach's α and corrected item-total correlations** are now computed when item-level columns are present — §8's internal-consistency requirement, which was structurally impossible before, since the schema ingested one aggregate `score`. §5 leans on α ≈ 0.92 for VM-PATHI while the panel could not compute α for its own instrument.

Two guards worth noting: constant items are **excluded and listed**, not silently folded in (a zero-variance item inflates α), and the reverse-scored discriminators are excluded, because α assumes one construct in one direction.

## #12 — Instruments the proposal names but the app never used

- **MIDAS** added to both headache routing paths.
- **THI / TFI** — §5 gives a tinnitus instrument the job of characterising migrainous vs otologic tinnitus. v0.1 scored tinnitus (`v_aural`) and routed it nowhere. A new recommendation fires on tinnitus.
- **Otalgia** (`n_otalgia`) and **autonomic features** (`n_auto`) added to the neuropathic domain — §3.1's fourth phenotype names both, and COMPASS-31 was being recommended with no autonomic cue to trigger it.
- New "competing objective findings" recommendation when discriminators fire.

---

## Two bugs the tests caught

**A scale with no true zero.** `m_dur`'s lowest option was "Under 4 h" at f = 0.2, so a patient with no headaches at all scored 0.8 points on attack duration — the fully-denied screen came out at 1/100 rather than 0. Added a "No attacks" option at f = 0.

**The scribe was inferring duration from frequency.** After the Bárány rescale, the extractor still mapped `rare ? 1 : 2` — but index 1 now means "under 5 minutes," not "rare." A frequency word was setting a duration band that feeds a criteria-anchored label. It now matches duration phrases only, and when it hears dizziness with no duration cue it leaves the item unanswered for the prompt to ask, rather than guessing.

## Verification

```
instrument shape       30 items · 26 positive summing to 100 · 4 discriminators summing to −29
                       every domain's weights match its declared max

bounds
  empty screen                              range   0–100   indeterminate
  all positives yes, discriminators OPEN     range  64–93    indeterminate
  all positives yes, discriminators denied   range  93–93    high
  all positives yes, sinus disease documented           72   high
  everything denied                          range   0–0     low

200,000 random answer sets
  band/range violations (band must hold across the whole range)          0
  high bands issued with a rule-out unanswered                           0

Cronbach's α
  coherent cohort (one latent trait)     α = 0.964
  noise cohort (items independent)       α = 0.110
  constant item present                  excluded and named, k drops 11 → 10
  aggregate score only                   null — correctly not computable

regenerated template (37 columns, 12 rows)
  ingests clean, 12/12 labeled, 0% missingness, α = 0.929 over 30 item columns
```

Fixes #1–#5 re-verified. All three files build clean.

---

## One judgement call to check

The discriminators are now effectively **mandatory for any non-low band**. A low screen still settles without them — rule-outs can only lower an already-low score — but moderate and high require them.

I think that is correct, and it is the whole point of #9. But it does mean the screen is meaningfully longer before it will commit to a routing recommendation, and that is a workflow cost you are better placed to judge than I am. If it proves too heavy in the pilot, the lever is the discriminator weights rather than the gate: smaller magnitudes narrow the floor and let more screens settle early, at the cost of letting objective disease matter less.
