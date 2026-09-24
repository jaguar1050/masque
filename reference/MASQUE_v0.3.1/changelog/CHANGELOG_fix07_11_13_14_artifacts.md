# Fixes #7, #11, #13, #14 — Published artifacts and the pilot loop

Closes audit findings **3.6** (pilot loop open), **3.7** (no provenance), **3.8** (data dictionary claimed but absent), **4.8** (FHIR-deployable specification has no artifacts).
Files changed: all three.

These four went together because they are all §7.3 deliverables — *"an open-source screener and risk calculator (web tool + FHIR-deployable specification for EHR integration)"* and *"a methods repository (code, data dictionaries, model cards)"*.

Remaining: **#10** (patient-facing view), **#15** (openFDA NLP benchmark), **#16** (separate sex and gender fields).

---

## #7 — The pilot loop, closed

§8's clinician-in-the-loop pilot needs flag rate, agreement, and downstream diagnostic change. v0.2 could produce none of them: the app made screens, the panel read external files, and nothing connected the two. The demo depended on synthetic rows because there was no way to generate real ones.

A captured screen is now a row in the same canonical schema the panel ingests, with every item column from #6. **Append this screen** on the result view (and in the scribe's FHIR view), **Export cohort** as CSV, and **Load N captured screens** in the panel's Data tab.

Two columns are deliberately left **empty** rather than filled:

- `label` — there is no reference standard at screening time. Writing a 0 there is exactly the fabrication #3 removed.
- `reference_diagnosis` — filled at the follow-up visit. **The empty column is the pilot instrument.**

With #3 in place this composes correctly without any extra logic: export two captured screens, load them back, and the panel reports 0 labeled rows, 100% label missingness, and withholds validation entirely. Verified end to end. Unanswered items likewise export as empty, not 0 — the same invariant one layer out.

## #11 — A specification that exists

v0.2 wrote QuestionnaireResponse resources pointing at a Questionnaire URL that resolved to nothing, and rendered a CDS Hooks "card" that was a styled `div`. The word *deployable* was doing work no artifact backed up.

Three real resources now download from the app, **generated from the same `ITEMS` the app scores with** — so they cannot drift from the running instrument the way a hand-maintained spec would.

**FHIR Questionnaire** — 7 groups, 42 items, versioned by `INSTRUMENT_VERSION`, at the exact URL the QuestionnaireResponse references. Each scored item carries its weight in an extension, so an implementer cannot reimplement the index from the item text and get a different number. The 12 red flags are published as an unscored group; 30 of 42 items carry weights, which is the correct split. The four criterion-anchored items carry their provenance as codes:

```
m_dur      ICHD-3 1.1 criterion B
v_vertigo  Bárány VM criterion B
v_count    Bárány VM criterion A
v_migfeat  Bárány VM criterion C
```

**CDS Hooks service** — discovery document with `order-select`, prefetch for patient, prior screens and active flags, plus example responses for all three states. The third example is the one that matters: `notScorable` returns `{ cards: [] }`. An incomplete screen must not emit a reassuring card, and an empty array is the correct response — worth publishing explicitly so an implementer doesn't invent something friendlier.

**Data dictionary** (#14) — 30 items with domain, type, weight, options and direction; 12 canonical cohort fields with the no-imputation rule stated per field; 12 red flags marked unscored. The four reverse-scored discriminators are documented as such, so nobody re-derives the index assuming all weights are positive.

The panel's header comment had claimed a data dictionary it never shipped. Rather than duplicate one there, it now points at the clinical app, which owns the item set — the dictionary belongs where the items live.

## #13 — Provenance

The manifest carried `generatedAt` and nothing else, which reproduces nothing. A run is now identified by a stable fingerprint of the data it ran on — canonical field order, values normalized the way the metrics actually see them.

FNV-1a is not a security hash and isn't presented as one; it's a cheap content identifier, which is what *"did we run on the same rows?"* actually needs. Verified: identical rows produce identical fingerprints, a single score changed by 1 produces a different one, and removing one label produces a different one.

The manifest also states `deterministic: true` with the reason — there is no stochastic component anywhere in the panel, so the fingerprint plus the constants fully determine the output.

---

## Verification

```
capture
  score 48 · coverage 77% · band indeterminate · red_flags rf_asym
  label ""   reference_diagnosis ""        <- empty, never 0
  7 unanswered items exported as empty     <- true

round-trip through the ingestion layer
  2 rows · 0 labeled · hasLabels false · label missingness 100%
  -> validation correctly withheld

artifacts
  Questionnaire      7 groups, 42 items, v0.2, 30 weighted
  CDS Hooks          order-select; redFlagPresent(1 card), settledNonLowBand(1 card), notScorable(0 cards)
  Data dictionary    30 items, 12 cohort fields, 12 red flags, 4 reverse-scored documented

provenance
  same rows        6af1562b == 6af1562b
  one score +1     52dcb506  differs
  one label null   3fd84020  differs
```

Full regression: 200,000-set band sweep clean on both the one-sided and two-sided invariants, unlabeled cohorts still withhold validation, fairness still returns NOT ASSESSABLE on a single stratum, α = 0.961 on a coherent cohort. All three build clean.

---

## On #10, which I've left for its own pass

The patient-facing view is the last substantive gap, and it is the largest strategic one — the track statement is about helping *patients* reach answers faster, and both prototypes are clinician-facing.

I deliberately didn't batch it here. It is a different kind of work: plain-language copy for 30 items, and safety wording that has to survive being read by a frightened person with no clinician in the room. Rushing that alongside plumbing would produce the worst version of it.

One design decision worth settling before I build it: **a patient-facing view should almost certainly not show an index at all.** Several of the discriminators require records a patient doesn't have — a CT result, an audiogram — so a patient-completed screen is structurally indeterminate under the #1 gate, and would correctly refuse to band. Rather than fight that, the patient view should output talking points for the appointment rather than a score. That also avoids handing someone a risk number for a condition, which is the right product call independent of the mechanics.
