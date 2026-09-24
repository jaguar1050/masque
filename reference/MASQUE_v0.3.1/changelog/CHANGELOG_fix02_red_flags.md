# Fix #2 — Red-flag interception

Closes audit finding **2.2** (*"No red-flag interception"*).
Files changed: `MASQUE_Screener_v0_2.jsx`, `MASQUE_Scribe_v0_2.jsx`, `ResearchReadinessPanel.jsx`.
Still open: **#3** (`normalizeRows` label imputation), **#4** (fairness cell size), **#5** (Bridge2AI + version drift).

---

## Why this is the fix the proposal most needed

MASQUE's premise is that a recalcitrant ENT picture is often a migraine or a neuropathy hiding in plain sight. That premise is dangerous in exactly one direction: the same complaints are the presenting picture of a vestibular schwannoma, a subarachnoid haemorrhage, giant cell arteritis, an invasive sinonasal process, or raised intracranial pressure.

The demo case makes it concrete. **Sample: red flag** is the existing dizziness case — index 85, "high likelihood" — with one detail added: the aural symptoms are always the same ear. Before this change the app referred that patient to neuro-otology to be worked up for vestibular migraine. §11 named clinician judgment as the backstop, which is fair, but the tool was actively steering *away* from escalation.

## Design: an override, not another input

Red flags are deliberately **not** scored, weighted, or traded off against the index. They aren't items with big point values — they sit outside the model entirely and override its output.

Twelve flags across four groups, each carrying what it points to and what to do:

| Tier | Flags |
|---|---|
| **Emergent** (same-day) | thunderclap onset · new focal deficit · vision loss / obscurations · GCA triad over 50 · orbital signs · sudden SNHL |
| **Urgent** (days, not weeks) | unilateral hearing loss or tinnitus · pulsatile tinnitus · progressive or postural headache · first severe headache after 50 · one-sided obstruction with bleeding or facial numbness · systemic features |

The index still computes and is still recorded. It just doesn't get to propose a destination while a flag is open.

## Screener

- **New step 00 · Safety, before intake.** The step list was rekeyed off `STEPS[step].key` rather than hard-coded indices, so inserting a step no longer means renumbering six conditionals.
- **The gate cannot be passed by default.** Either a flag is ticked, or the clinician actively records "none of these apply." Advancing on an unexamined safety step is the failure this exists to prevent, so `canContinue` blocks until one of the two happens.
- **Result view leads with the override**, above the index — each flag with what it points to, what to do, and its tier.
- **CDS card is pre-empted**, not merely suppressed: a `critical`/`warning` safety card replaces the screening card rather than leaving a silent gap.
- New **Sample: red flag** demo case.

## Scribe

Ambient capture raises flags from the encounter (`extract` gained a red-flag pass, and captures render as `RED FLAG:` tags in the transcript). Two rules govern it, and they matter more than the capture:

1. **Capture may only ever raise a flag, never clear one.** Negation checking is deliberately *not* applied on this path — verified below, a denial still raises the flag for review. The absence of a cue phrase is not evidence of absence, and safety is not a recall problem you hand to a phrase list.
2. **The clinician must record the review explicitly.** Routing requires `!override && safetyReviewed`. An unreviewed encounter proposes nothing, and an amber "Safety check outstanding" strip sits in the live screen until it's done.

A flag raised by capture is tagged *heard in encounter* and remains clinician-dismissable — the provenance is visible rather than silently merged.

The draft note now opens with a `SAFETY REVIEW` section in all three states (flags present / reviewed clear / **not yet reviewed**), and the plan defers to it.

## FHIR

Red flags post as `Flag` resources so they're visible in the chart whether or not anyone opens the screening result. The routine referral is replaced, not supplemented:

```
A. High index, no red flag
   QuestionnaireResponse, Observation, ServiceRequest
   -> routine: Referral: Neuro-otology — evaluate for vestibular migraine

B. Same index + one-sided hearing loss (urgent)
   Flag, QuestionnaireResponse, Observation, ServiceRequest
   -> urgent: Red-flag evaluation: MRI internal auditory canals

C. Same index + sudden hearing loss (emergent)
   Flag x2, QuestionnaireResponse, Observation, ServiceRequest
   -> stat: Red-flag evaluation: Same-day audiogram; MRI internal auditory canals
```

The Observation also carries a `routing-override` component naming what withheld it.

## Panel

`redFlags` is now passed by both apps, finally lighting the safety-override UI that had been sitting unused at `Panel:256`. The Decision KPI reads `OVERRIDE` rather than `FLAG`/`NO FLAG`.

## Verification

All three build clean. Extraction tested against ten utterances:

```
one-sided                 -> rf_asym
sudden loss               -> rf_ssnhl
pulsatile                 -> rf_pulsatile
thunderclap               -> rf_thunderclap
focal                     -> rf_focal
ICP posture               -> rf_progressive
GCA                       -> rf_gca
systemic                  -> rf_systemic
baseline demo line        -> (none)
"No, I've never had double vision"  -> rf_focal   <- denial still raises, by design
```

The existing demo script raises nothing, so the sinus/dizziness walkthroughs are unchanged.

---

## One thing worth deciding before submission

The screener's gate is mandatory; the scribe's is a persistent nag that blocks routing but doesn't block the encounter. That asymmetry is intentional — you can't hard-stop an ambient tool mid-visit — but it means the scribe can reach "sign to chart" with the safety review unrecorded, and the note will say so in capitals rather than refusing.

If you'd rather signing be hard-blocked until the review is recorded, that's a one-line change to the Sign button's `disabled`. It's a workflow call, not a code one, so I left it as-is.
