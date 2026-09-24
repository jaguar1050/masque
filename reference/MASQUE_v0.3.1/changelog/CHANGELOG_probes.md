# Release 0.3.1 — real-time encounter probes

New: `MASQUE_Probes.js`, `MASQUE_Probes_Check.mjs`, `MASQUE_Simulator.jsx`.
Changed: `MASQUE_Scribe_v0_3.jsx`, `README.md`, `VERSIONS.md`.
**Instrument untouched.** No item, weight, or cutpoint changed, so `INSTRUMENT_VERSION` stays 0.2 and existing cohorts remain comparable.

---

## What was wrong

The scribe's suggestion list ranked unanswered items by weight. That is right for filling in a questionnaire and wrong for a live encounter: the highest-weight unanswered item is almost never the most urgent thing to say. A list that puts a 6-point index item above *"does the ringing pulse with your heartbeat"* helps you score a patient faster while missing the thing that mattered.

## The probe set

32 probes, triggered by what has already been captured, ranked by what the answer could change:

| Kind | n | Ranked by |
|---|---|---|
| **Safety** | 7 | The answer could surface a red flag. Above everything, including higher-scoring items. |
| **Re-ask** | 4 | Alternate phrasing for an item the first wording may have missed. |
| **Criteria** | 4 | Completes an ICHD-3 or Bárány anchor. Costs more than its weight — miss one and the screen cannot be crosswalked to a diagnosis at all. |
| **Rule-out** | 4 | The answer can *lower* the index. Above ordinary items on purpose: a prompt list that only asks questions capable of confirming its own hypothesis is a leading question with a progress bar. |
| **Supporting** | 9 | Literature-supported features with no v0.2 item. Recorded, never scored. |
| **Exam** | 4 | A manoeuvre rather than a question, for while you are already examining. |

Safety and re-ask are never truncated. Everything else shows the top two with a count.

## The two invariants, enforced in code

**A rescue survives a negative answer.** Uniquely among probes, a rescue stays live while its target reads negative — that is the entire point of the kind. Bárány enumerates five qualifying vestibular symptom types, and in a published definite-VM cohort internal vertigo was reported by *more* patients than external spinning. So the commonest qualifying presentation is precisely the one "do you get spinning episodes?" is least likely to capture: a patient whose head rocks like a boat answers no, and the vestibular arm collapses on a false negative. Rescues cover all five types in patient vocabulary and set the *existing* item, so nothing about the instrument changes.

The same cohort found photophobia/phonophobia accompanying attacks in roughly three quarters of patients while headache accompanied well under half. Criterion C is satisfied by headache **or** photophobia-plus-phonophobia **or** visual aura, so the original criterion-C probe — which led with headache — was asking about the least common of the three. There is now a rescue for the photophobia route.

**A supporting probe never writes to a scored item.** Childhood carsickness, osmophobia, post-travel rocking, interictal photophobia, space-motion avoidance, neck involvement, prodrome, prior triptan response, and childhood recurrent vertigo are all literature-supported and none of them are Bárány criteria. They record as notes and move the index by exactly zero. Totalling them would invent a measurement instrument v0.2 does not make. They are tagged as v0.3 candidates — a clinical decision and a version bump, not something a prompt panel does quietly.

`MASQUE_Probes_Check.mjs` fails the build on either violation, and reads item and red-flag ids out of the shipped screener rather than a copy, so a typo becomes a startup error instead of a finding nobody records.

## What the check caught

Running it the first time found a probe mislabelled as a rescue. `pr_headmotion_nausea` fires only once `v_head` is already positive, so it has no negative answer to correct — it supplies the Bárány nausea qualifier, which is criteria work. Left as a rescue it would have sat in the never-truncate tier it does not need. Reclassified.

It also exposed a defect in the test itself: checking "does this fire from a bare state" fails probes with compound triggers, because asking about migrainous features accompanying vertigo is meaningless before vertigo is established. The test now measures the property that actually matters — does setting the target negative *kill* the probe.

## Verification

```
32 probes · 18 encounter + 14 vestibular-migraine
safety 7 · re-ask 4 · criteria 4 · rule-out 4 · supporting 9 · exam 4
checked against 30 instrument items and 12 red flags

referential integrity: pass
phenotype probes writing to a scored item: 0 (must be 0)
rescues live after a negative answer: 4/4 (must be all)
red flags reachable by asking: 7/12
safety ranked first: pass
ALL CHECKS PASS
```

Seven of twelve red flags are reachable only by asking, which is the point: ambient capture hears what was said, not what wasn't.

## Known limitation

`MASQUE_Simulator.jsx` carries an inline copy of the probe set, because a chat artifact must be a single file. The module is the source of truth and the check validates the module. Keep them in step, or drop the simulator when the demo is no longer needed.
