// tests/harness/emr-decisions-delta.js — the clinical lead's answers on the EMR template's open items, release 0.4.6.
// Plain data only: no imports, no logic, nothing happens at import time. Local-only, never deployed.
//
// One source of truth, as tests/harness/referral-delta.js is for the referral rule:
//   tests/tools/extract-rubric.js  applies it last, to the rubric that already carries the signed-off
//                                  emrTemplate (tests/harness/emr-delta.js, release 0.4.3, unchanged)
//                                  and the referral rule (applyEmrDecisionsDelta, tests/harness/diff.js):
//                                  each `added` row adds a key that must not exist yet to an object under
//                                  /emrTemplate, nothing else; it proves the result exact with
//                                  revertEmrDecisionsDelta, checks the lead's answers, that the approved
//                                  wording is printed as approved and every item, probe and option the
//                                  data names, and appends `changelog` after the release 0.4.5 entry;
//   tests/suites/values.js         pins this data, the decision record and both emrTemplate blocks (the
//                                  signed-off one under this delta, and the shipped one).
//
// THE DECISIONS. On 2026-10-10 (local date, UTC-7) the user, who is the project's clinical lead,
// answered four questions in chat about the items the EMR template sign-off had left open
// (CHANGELOG.md, release 0.4.3: the reading of "also" under red flags, the DZ4 clause, I5 and D6).
// `quotes` keeps each question, the options the lead saw (label and description, as shown) and the
// answer, verbatim:
//   also          "Workup + referral + references": under an open red flag the plan also prints the
//                 screen-based referral block and the empiric-treatment references; the FHIR bundle
//                 still withholds the referral (the option said so). Engine only (engine/emr.js).
//   dz4           "Keep the clause (Recommended)": the DZ4 label keeps its indication clause. No change.
//   addBack       "Modifying conditions,Family history of migraine,Assessment 'Considerations'" (three of
//                 the I5 items; the scale-item HPI lines stay out): the modifying-conditions row and the
//                 family-history-of-migraine line are data (`added`, pastHistory); the Considerations
//                 line is engine only (the headings of the recommendations the plan prints).
//   hints         "Add a clinician line (Recommended)": a placeholder under the HINTS exam row when the
//                 central option is recorded (`added`, examRows/14/optionPlaceholders).
// The wording added is the wording the lead approved: the modifying-conditions label and the HINTS
// placeholder are the strings quoted in the chosen options' descriptions (the extractor checks
// both), and the family-history line is the item's own wording with its recorded state.
//
// Shape:
//   release       "0.4.6"
//   decided       {by, channel, date}
//   quotes        {key: {date, question, options: [{label, description}], answer}}  verbatim (chat)
//   added         [{path, value}]  JSON pointers under /emrTemplate; each adds a key that must not exist
//   basis         {pointer under /emrTemplate: what the entry rests on}: one per pastHistory row and one
//                 per option placeholder
//   changelog     the rubric's `emr-decisions` change-log entry, appended after the release 0.4.5 entry

/** The clinical lead's EMR-template answers of 2026-10-10 that add data (release 0.4.6). */
export const EMR_DECISIONS_DELTA = {
  release: "0.4.6",
  decided: {
    "by": "clinical lead",
    "channel": "chat",
    "date": "2026-10-10"
  },
  quotes: {
    "also": {
      "date": "2026-10-10",
      "question": "When a red flag is open, what should the plan show besides the red-flag workup?",
      "options": [
        { "label": "Workup only (Recommended)", "description": "Keep as is: red-flag imaging/labs/referral lines plus the checklist; the neurology referral and the treatment references stay withheld until the flag is handled, matching the FHIR order." },
        { "label": "Workup + referral + references", "description": "Also print the neurology referral and the empiric-treatment references under an open red flag. The FHIR order would still withhold the referral, so note and order would differ." }
      ],
      "answer": "Workup + referral + references"
    },
    "dz4": {
      "date": "2026-10-10",
      "question": "DZ4 checklist label: keep the indication clause or trim it?",
      "options": [
        { "label": "Keep the clause (Recommended)", "description": "'Audiogram (episodic vertigo with aural symptoms, or unilateral tinnitus)' — tells the clinician when it applies; synthesised from AFP dizziness/tinnitus and AAO-HNS tinnitus sources." },
        { "label": "Trim to 'Audiogram'", "description": "Class name only, like the other trimmed labels (e.g. 'Specific-IgE allergy testing (skin or serum)')." }
      ],
      "answer": "Keep the clause (Recommended)"
    },
    "addBack": {
      "date": "2026-10-10",
      "question": "Which of the items left out to keep the note short should be added back?",
      "options": [
        { "label": "None — keep it tight (Recommended)", "description": "Leave the note as is." },
        { "label": "Modifying conditions", "description": "Add 'Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia): [ ]' (AAO-HNS adult sinusitis guideline)." },
        { "label": "Family history of migraine", "description": "Add a separate history line with the screen's answer (it already appears in the review of systems)." },
        { "label": "Assessment 'Considerations'", "description": "Repeat the fired recommendations' headings under Assessment (they already appear in the plan)." }
      ],
      "answer": "Modifying conditions,Family history of migraine,Assessment 'Considerations'"
    },
    "hints": {
      "date": "2026-10-10",
      "question": "If the Scribe records a central HINTS pattern ('Normal impulse (points central)'), what should the plan do?",
      "options": [
        { "label": "Add a clinician line (Recommended)", "description": "Under the HINTS exam row, add '[clinician interpretation of HINTS and any imaging decision]' when a central pattern is recorded. No new clinical claim; data-only change." },
        { "label": "Show the probe's own warning", "description": "Print the instrument's existing note for that answer (it calls the finding 'the opposite of reassuring') next to the recorded result." },
        { "label": "Treat as a red flag", "description": "Make a central pattern raise an urgent flag that withholds routine routing (an instrument change; needs your imaging/referral wording)." },
        { "label": "Keep as is", "description": "No plan response; stays an accepted risk." }
      ],
      "answer": "Add a clinician line (Recommended)"
    }
  },
  added: [
    {
      "path": "/emrTemplate/pastHistory",
      "value": [
        { "label": "Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia)", "group": "medical" },
        { "item": "m_fhx", "group": "family" }
      ]
    },
    {
      "path": "/emrTemplate/examRows/14/optionPlaceholders",
      "value": [
        { "option": 0, "placeholder": "clinician interpretation of HINTS and any imaging decision" }
      ]
    }
  ],
  basis: {
    "/pastHistory/0": "L: the label is the wording the lead approved on 2026-10-10 (quotes.addBack, option \"Modifying conditions\", quoted in its description), printed with the engine's [ ] placeholder after the pregnancy line (group medical). It is the optional D13 modifying-conditions row of the content basis §2.6 (\"Asthma / immunocompromise / AERD / cystic fibrosis / ciliary dyskinesia: [ ]\", heading from C AAO-SIN25 KAS 8, modifying conditions) in the words of the basis §4 SI5 label, \"Modifying conditions assessed (asthma, CF, immunocompromise, AERD, ciliary dyskinesia)\", with the abbreviations written out; left out under I5 until the lead's answer. No citation is printed (past-history rows carry none, like history rows).",
    "/pastHistory/1": "item id only (M): the line prints the item's own patientClin, \"Personal or family history of migraine\", and its recorded state (yes / answered no / not recorded, never a no from missing data; a Scribe probe that wrote it follows, labelled as recorded), as the content basis §2.6 line \"Personal or family history of migraine: <state>\"; left out under I5 until the lead's answer of 2026-10-10 (quotes.addBack, option \"Family history of migraine\"). The item leaves the review of systems, and the family-history placeholder below it reads \"Other family history: [ ]\" (basis §2.6).",
    "/examRows/14/optionPlaceholders/0": "L: the placeholder is the wording the lead approved on 2026-10-10 (quotes.hints, option \"Add a clinician line\", quoted in its description), printed in the engine's brackets under the HINTS row when the Scribe's pr_head_impulse probe records option 0, \"Normal impulse (points central)\" (M). It was the round 2 option for D6 (CHANGELOG.md, release 0.4.3). No flag, no plan line and no clinical claim: the interpretation and any imaging decision are the clinician's."
  },
  changelog: {
    "date": "2026-10-10",
    "kind": "emr-decisions",
    "note": "Clinical-lead answers on the EMR Friendly Template's open items, recorded in release 0.4.6 from the clinical lead's answers in chat of 2026-10-10. Two answers add data under emrTemplate: pastHistory (the modifying-conditions row, \"Modifying conditions (asthma, cystic fibrosis, immunocompromise, aspirin-exacerbated respiratory disease, ciliary dyskinesia)\", after the pregnancy line, and the item Personal or family history of migraine with its recorded state, before the family-history placeholder, which then reads \"Other family history\"), and an option placeholder under the HINTS exam row (\"clinician interpretation of HINTS and any imaging decision\", printed when the Scribe records Normal impulse (points central)). The other answers change the engine only or nothing: under an open red flag the note also prints the screen-based referral and the empiric-treatment references (the FHIR bundle still withholds the referral), the assessment names the headings of the recommendations the plan prints, and the DZ4 label keeps its indication clause. The signed-off emrTemplate block of release 0.4.3 is unchanged under these additions. Recorded in tests/harness/emr-decisions-delta.js. Instrument 0.2, lexicon 0.3.2, probe set 1.0.0 and gold set 0.3.0 are unchanged; only contentHash changes.",
    "paths": ["/emrTemplate/pastHistory", "/emrTemplate/examRows/14/optionPlaceholders"]
  }
};
