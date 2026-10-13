// tests/harness/emr-plan-delta-048.js — the clinical lead's plan line for the EMR template, release 0.4.8.
// Plain data only: no imports, no logic, nothing happens at import time. Local-only, never deployed.
//
// One source of truth, as tests/harness/emr-decisions-delta.js is for the lead's 0.4.6 answers:
//   tests/tools/extract-rubric.js  applies it last, to the rubric that already carries every earlier
//                                  delta, with the same functions as the 0.4.6 answers
//                                  (applyEmrDecisionsDelta, tests/harness/diff.js): its one `added` row
//                                  adds a key that must not exist yet (planAdvice) at the end of
//                                  /emrTemplate, nothing else; it proves the result exact with
//                                  revertEmrDecisionsDelta, checks that the line is the sentence the
//                                  lead quoted, verbatim, and the lead's answers, and appends
//                                  `changelog` after the release 0.4.8 question entry;
//   tests/suites/values.js         pins this data and the record, and the emrTemplate blocks (the
//                                  signed-off one under every delta, the one of release 0.4.6 under
//                                  this delta, and the shipped one), and exempts the added leaves
//                                  (pointer and value) from the provenance sweep;
//   tests/suites/emr.js            asserts where the engine prints the line (engine/emr.js).
//
// THE REQUEST. On 2026-10-12 (chat) the user, who is the project's clinical lead, wrote (verbatim,
// `request`; the first sentence of the same message asked for the Scribe's Question Review, which
// is app code, not data, and is recorded in CHANGELOG.md):
//   "Also recommendations in the plan should also add "recommend a trial of migraine abortives if
//    not contra-indicated due to other conditions." so that a primary doctor can offer this as an
//    option to the patient for relief in the interim."
// The lead then answered two questions (AskUserQuestion, 2026-10-12). `quotes` keeps each question,
// the label of the option the lead chose and that option's description, verbatim, as shown; the
// options the lead did not choose were not kept with the answers, so they are not recorded here:
//   when      "With the treatment refs, no red flag (Recommended)": the line prints in the plan beside
//             the empiric-treatment references, whenever they print and no red flag is open. Engine
//             only (engine/emr.js): right after the reference lines, before the treatment-offered
//             placeholders, on the no-flag path; never under an open red flag's screen-based block.
//   outputs   "EMR template note (Recommended)": the EMR Friendly Template's plan, on the Screener and
//             the Scribe. Not the Scribe's encounter note (buildNote), the FHIR bundle or the
//             Screener's result cards.
// The text is the lead's quoted sentence, stored and printed exactly as written (lower-case first
// word, final full stop): never re-cased or re-punctuated. `source` and `decided` are its record
// (validator V61: a plan-advice line names who decided it and when); the engine prints the text only.
//
// Version axes: emrTemplate is outside the instrumentHash, scoringHash and lexiconHash projections
// (engine/hash.js), so instrument 0.2, the scoring hash (and the illustrative calibration), lexicon
// 0.3.3, probe set 1.0.0 and gold set 0.4.0 do not move; only contentHash and the rubric's bytes
// change.
//
// Shape (the shape of tests/harness/emr-decisions-delta.js, so the same apply and revert serve):
//   release     "0.4.8"
//   requested   {by, channel, date}
//   request     the lead's words, verbatim, as lines
//   quotes      {key: {date, question, answer, answerDescription}}  verbatim (AskUserQuestion)
//   added       [{path, value}]  JSON pointers under /emrTemplate; each adds a key that must not exist
//   basis       {pointer under /emrTemplate: what the entry rests on}: one per plan-advice line
//   changelog   the rubric's `emr-plan` change-log entry, appended after the release 0.4.8 question entry

/** The clinical lead's plan line for the EMR template (release 0.4.8). */
export const EMR_PLAN_DELTA = {
  release: "0.4.8",
  requested: {
    "by": "clinical lead",
    "channel": "chat",
    "date": "2026-10-12"
  },
  request: [
    "Also recommendations in the plan should also add \"recommend a trial of migraine abortives if not contra-indicated due to other conditions.\" so that a primary doctor can offer this as an option to the patient for relief in the interim."
  ],
  quotes: {
    "when": {
      "date": "2026-10-12",
      "question": "When should the plan print \"recommend a trial of migraine abortives if not contra-indicated due to other conditions.\"?",
      "answer": "With the treatment refs, no red flag (Recommended)",
      "answerDescription": "In the EMR note's plan, beside the empiric-treatment references, whenever they print and no red flag is open (screen points to a migrainous driver)."
    },
    "outputs": {
      "date": "2026-10-12",
      "question": "Which outputs should carry it?",
      "answer": "EMR template note (Recommended)",
      "answerDescription": "The EMR Friendly Template plan, on both the Screener and the Scribe."
    }
  },
  added: [
    {
      "path": "/emrTemplate/planAdvice",
      "value": [
        { "text": "recommend a trial of migraine abortives if not contra-indicated due to other conditions.", "source": "lead", "decided": "2026-10-12" }
      ]
    }
  ],
  basis: {
    "/planAdvice/0": "L: the clinical lead's sentence, verbatim (request, chat, 2026-10-12: \"Also recommendations in the plan should also add \"…\" so that a primary doctor can offer this as an option to the patient for relief in the interim.\"), stored and printed exactly as written. Printed by engine/emr.js as a plan line (\"- \" and the text) right after the empiric-treatment reference lines and before the treatment-offered placeholders, only where those references print with no red flag open (quotes.when, \"With the treatment refs, no red flag (Recommended)\"), in the EMR Friendly Template only, on the Screener and the Scribe (quotes.outputs, \"EMR template note (Recommended)\"). The references print where the referral gate opens (decision D4) and showFor allows, so the line follows the same gate; under an open red flag the screen-based block keeps the references but not this line. No citation: the line is the lead's recommendation, not a reference."
  },
  changelog: {
    "date": "2026-10-12",
    "kind": "emr-plan",
    "note": "Plan advice of the EMR Friendly Template, recorded in release 0.4.8 from the clinical lead's request in chat of 2026-10-12 (\"Also recommendations in the plan should also add \"recommend a trial of migraine abortives if not contra-indicated due to other conditions.\" so that a primary doctor can offer this as an option to the patient for relief in the interim.\") and the lead's answers of the same day (when: \"With the treatment refs, no red flag (Recommended)\"; outputs: \"EMR template note (Recommended)\"): emrTemplate.planAdvice holds the lead's sentence, verbatim, \"recommend a trial of migraine abortives if not contra-indicated due to other conditions.\", with its source and date. The EMR template's plan prints it right after the empiric-treatment reference lines, before the treatment-offered placeholders, only where those references print and no red flag is open; never under an open red flag's screen-based block, and never in the encounter note, the FHIR bundle or the Screener's result cards. The signed-off emrTemplate block of release 0.4.3 and the 0.4.6 additions are unchanged. Recorded in tests/harness/emr-plan-delta-048.js. Instrument 0.2, lexicon 0.3.3, probe set 1.0.0 and gold set 0.4.0 are unchanged; only contentHash changes.",
    "paths": ["/emrTemplate/planAdvice"]
  }
};
