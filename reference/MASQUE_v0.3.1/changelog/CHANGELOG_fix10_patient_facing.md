# Fix #10 — Patient-facing companion

Closes audit finding **4.4** (*"No patient-facing artifact"*) — the largest strategic gap in the conformance audit.
New file: `MASQUE_Patient_v0_1.jsx`. No existing file changed.
Still open: **#15** (openFDA NLP benchmark), **#16** (separate sex/gender fields).

---

## The gap this closes

The TOPx track asks for tools built on U.S. Open Data that help **patients** reach answers and care faster, and proposal §2 commits to putting that data "in the public's hands." Every MASQUE artifact so far was clinician-facing — SMART launch, physician prompts, chart write-back. A patient had no entry point.

That gap isn't cosmetic. §3.2 is about people, disproportionately women, who have already seen three or four clinicians over a year and been told it's stress. The thing most likely to change that next visit isn't another clinician-side score. It's the patient arriving able to describe the pattern precisely and ask for the specific evaluation. This app does that and nothing else.

## Three things it deliberately does not do

**1. No score, no band, no probability — anywhere in the patient's view.** The calibration constants are illustrative until fit on approved data, and "85/100 — high likelihood" handed to a patient is an unvalidated number that invites self-diagnosis. The clinician section lists which *features* are present, in clinical language, ordered by instrument weight. That's what actually speeds up a visit, and it can't be misread as a result.

**2. No differential is ever shown for a red flag.** The clinician build names what each flag points to — schwannoma, subarachnoid haemorrhage, giant cell arteritis. A patient reading that list at 1am is harmed, not helped. Here each flag carries exactly two things: how fast to be seen, and the sentence to say when calling. Verified below: zero of the twelve clinical differentials appear in the patient build.

**3. No automatic research capture.** The clinician build appends screens to the pilot cohort (fix #7/#11). Patient-entered data carries different consent obligations, so nothing here writes to a cohort. Export is patient-initiated, local, and goes to the patient.

## The design keystone: "Not sure"

Every yes/no question offers **Yes / No / Not sure**, and "Not sure" leaves the item genuinely unanswered rather than coercing a 0. That's the same no-imputation invariant running through the ingestion layer (#3) and the coverage gate (#1) — absent data is never rendered as negative data.

It also turned out to be the most useful thing in the app. An honest "I don't know whether my scan showed inflammation" becomes a line on the summary:

```
THINGS I'M NOT SURE ABOUT
  - Did any of my scans or scope tests show real sinus swelling while I had symptoms?
  - Do my hearing tests show my hearing changing between visits?
```

Those are exactly the questions that stall these workups for months. Uncertainty becomes an agenda item instead of a gap.

## What the summary produces

Everything is a restatement of what the person entered, plus questions derived from which domains they endorsed. No inference about what they have. The closest thing to a judgement is *which questions are worth asking*, which is the whole point.

Five sections: safety (if flags), how to open, what to describe, what to ask, what you're unsure about, and a clinician block. On the long-odyssey case the opening line comes out as:

> "I've seen three or more clinicians about this over more than a year, and it's been put down to stress or a normal result. I'd like to work out what we haven't looked at yet."

That single sentence is the §3.2 intervention.

**The tool does not push its own hypothesis.** When the rule-out discriminators are positive, the migraine question is reframed rather than asked flat — it opens both doors:

> "Some of my results point to a sinus or ear cause and some of my symptoms look migraine-like. Could there be more than one thing going on?"

**Thin summaries say so.** If almost nothing was answered, the page says there isn't enough here to hand over, rather than presenting a near-empty artifact as a finished one — the same principle as the coverage gate.

## Verification

```
INSTRUMENT PARITY
  screener items: 30   patient items: 30
  ids missing from patient app : none
  ids in patient app only      : none
  weight mismatches            : none

DIFFERENTIAL CONTAINMENT
  differentials named in clinician build : 12
  leaked into patient build              : none
  alarming clinical terms in patient view : none

READING LEVEL (Flesch-Kincaid)
  questions      : grade 4.7  (30 items)
  red-flag text  : grade 4.2
  hardest item   : grade 8.0
```

Wording lives in a `P` map keyed by item id rather than as a field on `ITEMS`, so the instrument stays a single source of truth for scoring while the wording can be revised — or translated — without touching it. A module-load assertion fails loudly if the two ever drift, including scale-option counts.

All four JSX files build clean.

---

## Two things worth your call

**Translation is the obvious next step and I didn't do it.** The wording map is structured for it — one file, one object, no logic — but which languages matter for this population is your call, not mine. Spanish at minimum, given the Arizona context.

**The clinician block is a judgement call I'd want you to check.** It reproduces clinical item text verbatim (`Episodic vertigo 5 min – 72 h (Bárány VM B)`), which is precise and useful to the clinician but sits on a page the patient reads. I chose precision on the grounds that a patient handing over a document they can't fully parse is normal and fine, and vagueness there would waste the visit. If you'd rather it were plain-language throughout, that's a small change to the `c:` fields.
