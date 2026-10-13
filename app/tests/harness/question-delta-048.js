// tests/harness/question-delta-048.js — the clinical lead's question for item r_dur, release 0.4.8.
// Plain data only: no imports, no logic, nothing happens at import time. Local-only, never deployed.
//
// One source of truth, as tests/harness/referral-delta.js is for the referral rule:
//   tests/tools/extract-rubric.js  applies it last, to the rubric that already carries every earlier
//                                  delta (applyQuestionDelta, tests/harness/diff.js): each `changed`
//                                  row replaces an item's clinician question (`ask`, a JSON pointer
//                                  /domains/<i>/items/<j>/ask) that must still be its `from`, on the
//                                  item its `item` names; it proves the change exact with
//                                  revertQuestionDelta, checks that the new question is the lead's
//                                  sentence verbatim (quoted in the request), and appends `changelog`
//                                  after the release 0.4.7 lexicon entry;
//   tests/suites/values.js         pins this data and the record, reads the baseline ASK pin on the
//                                  reverted rubric, and exempts the new question (pointer and value)
//                                  from the provenance sweep;
//   the parity suites              excuse exactly this question where the baseline printed the old
//                                  one (AD19, tests/harness/diff.js).
//
// THE REQUEST. On 2026-10-12 (chat) the user, who is the project's clinical lead, wrote (verbatim,
// `request`; the second line ends with a space, as written):
//   "Fix 2: Question: recalcitrance
//    How long has this been going on?
//    Is a yes/no, if phrasing it as such it should ask "Have symptoms persisted over 3 months despite
//    trials of medical management?""
// "Question: recalcitrance" is the Scribe's Ask-next card of item r_dur: its tag is the domain label
// lowercased ("recalcitrance"), its question the item's `ask` ("How long has this been going on?"),
// and its answer buttons are the boolean item's Yes / No. The new question is the lead's quoted
// sentence, stored and shown exactly as written. Nothing else changes: the item's clinician statement
// (`text`, "Symptoms have persisted or recurred for more than 3 months"), weight, short label, patient
// wording (en and es) and the patient context question c_dur (which also reads "How long has this been
// going on?" but offers three durations, not yes / no) are untouched. There is no Spanish counterpart:
// the clinician question is shown only on the English clinician surfaces (the Scribe), and no locale
// carries an item `ask` for r_dur.
//
// Version axes: `ask` is outside the instrumentHash and scoringHash projections (engine/hash.js:
// items project id, w, text, ref, scale) and outside lexiconHash, so instrument 0.2, the scoring hash
// (and the illustrative calibration), lexicon 0.3.3, probe set 1.0.0 and gold set 0.4.0 do not move;
// only contentHash and the rubric's bytes change (design 03 §3.10, Q11: copy edits keep the version).
//
// Shape:
//   release     "0.4.8"
//   requested   {by, channel, date}
//   request     the lead's words, verbatim, as lines
//   changed     [{path, item, from, to}]   path: /domains/<i>/items/<j>/ask; from: the baseline value
//   basis       {path: what the change rests on}, one per changed row
//   changelog   the rubric's `question` change-log entry, appended after the release 0.4.7 entry

/** The clinical lead's question for item r_dur (release 0.4.8). */
export const QUESTION_DELTA = {
  release: "0.4.8",
  requested: {
    "by": "clinical lead",
    "channel": "chat",
    "date": "2026-10-12"
  },
  request: [
    "Fix 2: Question: recalcitrance",
    "How long has this been going on? ",
    "Is a yes/no, if phrasing it as such it should ask \"Have symptoms persisted over 3 months despite trials of medical management?\""
  ],
  changed: [
    {
      "path": "/domains/0/items/0/ask",
      "item": "r_dur",
      "from": "How long has this been going on?",
      "to": "Have symptoms persisted over 3 months despite trials of medical management?"
    }
  ],
  basis: {
    "/domains/0/items/0/ask": "L: the clinical lead's sentence, verbatim (request, chat, 2026-10-12), replacing the baseline Scribe question (Scb ASK.r_dur, \"How long has this been going on?\"), which asked for a duration while the item's answers are Yes / No. Shown wherever the item's clinician question is shown: the Scribe's Ask-next card and heard card (scribe.js itemSuggestion: ask = item.ask ?? item.text), and the Rubric Editor's ask field. The scored statement, weight and patient wording are unchanged; ask is outside instrumentHash and scoringHash."
  },
  changelog: {
    "date": "2026-10-12",
    "kind": "question",
    "note": "Clinician question of item r_dur, recorded in release 0.4.8 from the clinical lead's request in chat of 2026-10-12 (\"Fix 2: Question: recalcitrance / How long has this been going on? / Is a yes/no, if phrasing it as such it should ask \"Have symptoms persisted over 3 months despite trials of medical management?\"\"): the item's ask \"How long has this been going on?\" becomes the lead's sentence, verbatim, \"Have symptoms persisted over 3 months despite trials of medical management?\". Its answers stay Yes / No. The item's statement, weight, short label and patient wording, and the patient context question c_dur, are unchanged; ask is outside instrumentHash and scoringHash, so instrument 0.2 and the calibration stand; contentHash changes. Lexicon 0.3.3, probe set 1.0.0 and gold set 0.4.0 unchanged.",
    "paths": ["/domains/0/items/0/ask"]
  }
};
