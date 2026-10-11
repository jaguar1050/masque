// tests/harness/lexicon-delta.js — the clinical-lead-approved MASQUE lexicon change 0.3.1 → 0.3.2
// (design 05 §6.2). Plain data only: no imports, no logic, nothing happens at import time.
// Local-only, never deployed.
//
// One source of truth for three readers:
//   tests/tools/extract-rubric.js  applies it to the baseline 0.3.1 lexicon (applyLexiconDelta) and
//                                  writes the result into modules/masque/masque.rubric.json;
//   tests/suites/values.js         proves the shipped lexicon is exactly 0.3.1 + this delta (AD13) and
//                                  exempts only these leaves from the provenance sweep;
//   tests/suites/extraction.js and render-scribe.js  run parity on revertLexiconDelta(shipped, delta).
//
// Approved by the clinical lead on 2026-10-04, row by row (lead decisions D1-D4; round 2, design 05
// §12: L1 adds the v_vertigo carryExclude row, L2 limits normalize.numbers to band phrases, L3
// confirms the carryRefuse row, which the team proposed as a carry-over guard). Round 3 (design 05
// §13) changes no row; it changes how the extractor reads them (R9-R11) and rewords the change-log
// note so it states only what the extractor does (R12). Every phrase is appended at the END of its
// list in the order given here; nothing is inserted, reordered or reworded. Drafts that were
// considered and struck, the superseded Appendix A drafts of design 05 and the known risks are
// recorded in modules/masque/CHANGELOG.md, not here.

/** The clinical-lead-approved MASQUE lexicon change 0.3.1 → 0.3.2. Paths are relative to the
 *  lexicon and use the 0.3.1 positional indices; entryId asserts the entry at that position. */
export const LEXICON_DELTA = {
  from: "0.3.1", to: "0.3.2",
  approved: { by: "clinical lead", date: "2026-10-04" },
  // Phrases appended at the END of an existing list, in this order. Item-vocabulary paths:
  // /bool/<i>/ph, /ctx/<i>/ph, /multi/<i>/ph, /scale/<i>/cue, /scale/<i>/bands/<j>/ph, /redFlags/<id>.
  // The two cue-list rows (/negation/cues, /thirdParty/cues) are a separate lead decision (D3) and
  // carry no entryId: those lists belong to no entry.
  appended: [
    { path: "/scale/1/cue", entryId: "v_vertigo",
      phrases: ["world is moving", "world moving around", "world's moving", "world was moving", "everything spins",
        "everything spun", "room spun", "room is moving", "everything is moving", "like i'm on a boat",
        "like i was on a boat", "like i am on a boat", "like being on a boat", "rocking feeling",
        "rocking sensation", "swaying side to side", "feel unsteady", "unsteady on my feet",
        "losing my balance", "lose my balance", "balance is off"],
      why: "F3: v_vertigo symptom cues (problem report wording, pr_internal_vertigo probe wording, lay variants of existing cues)",
      approvedOn: "2026-10-04" },
    { path: "/scale/1/bands/0/ph", entryId: "v_vertigo",
      phrases: ["split second", "a second or two", "a couple minutes", "under five minutes", "less than five minutes",
        "two minutes", "three minutes", "four minutes"],
      why: "F3: v_vertigo band v 1 (Under 5 min)",
      approvedOn: "2026-10-04" },
    { path: "/scale/1/bands/2/ph", entryId: "v_vertigo",
      phrases: ["half the day", "half a day", "about a day", "all night", "for a day or two", "for a couple of days",
        "for two days", "for three days", "overnight"],
      why: "F3: v_vertigo band v 2 (5 min – 72 h)",
      approvedOn: "2026-10-04" },
    { path: "/scale/1/bands/1/ph", entryId: "v_vertigo",
      phrases: ["lasts more than three days", "lasted more than three days", "days at a time"],
      why: "F3: v_vertigo band v 3 (Over 72 h)",
      approvedOn: "2026-10-04" },
    { path: "/bool/8/ph", entryId: "v_head",
      phrases: ["roll over", "rolled over", "turning over", "over in bed", "when i turn my head", "when i look up",
        "when i lie back", "lying back in", "tip my head back", "high shelf", "bending over"],
      why: "F3: positional triggers (problem report, pr_positional and pr_headmotion_nausea probe wording, lay variants)",
      approvedOn: "2026-10-04" },
    { path: "/bool/6/ph", entryId: "v_motion",
      phrases: ["driving through a tunnel", "drive through a tunnel", "patterned", "busy visual",
        "dizzy riding in a car", "sick riding in a car"],
      why: "F3: visual-motion triggers (pr_visual_vertigo probe wording, the module's patient-summary wording)",
      approvedOn: "2026-10-04" },
    { path: "/bool/7/ph", entryId: "v_aural",
      phrases: ["ears feel full", "ears ring", "roaring"],
      why: "F3: aural fullness and tinnitus (plural variants of existing phrases; roaring)",
      approvedOn: "2026-10-04" },
    { path: "/bool/19/ph", entryId: "v_migfeat",
      phrases: ["headache during the dizz", "headaches during the dizz"],
      why: "F3: headache with the episodes (variants of the existing \"headache with the dizz\")",
      approvedOn: "2026-10-04" },
    { path: "/negation/cues",
      phrases: ["fewer than"],
      why: "Lead decision D3: \"fewer than five episodes\" is a denial of v_count, not an affirmation",
      approvedOn: "2026-10-04" },
    { path: "/thirdParty/cues",
      phrases: ["my grandmother", "my grandma", "my aunt", "my uncle", "my friend"],
      why: "Lead decision D3: further relatives and a friend as attribution cues",
      approvedOn: "2026-10-04" },
  ],
  // Keys added to existing objects, in this order. `from` present = replaces that exact value.
  fields: [
    { path: "/version", from: "0.3.1", to: "0.3.2" },
    { path: "/scale/1/heard", entryId: "v_vertigo", to: true, why: "F1" },
    { path: "/scale/1/carry", entryId: "v_vertigo", to: 2, why: "F2" },
    { path: "/scale/1/carryExclude", entryId: "v_vertigo",
      to: ["about a day", "overnight", "for a day or two", "for a couple of days", "for two days", "for three days"],
      why: "R3a: day ranges are same-sentence only (clinical-lead decision L1, 2026-10-04); these v_vertigo band phrases never supply a carried value. Round 3: in a carried reply they still count for the negation and disagreement tests (R10); in the cue's own utterance they supply a value only in a cue sentence and elsewhere can only withhold (R11, as corrected in round 3c)",
      approvedOn: "2026-10-04" },
    { path: "/scale/2/yieldTo", entryId: "m_dur", to: ["v_vertigo"], why: "F4" },
    { path: "/scale/2/anchor", entryId: "m_dur",
      to: ["headache", "facial pressure", "facial pain", "pressure in my face", "behind my eyes", "migraine lasts",
        "migraines last", "head pain"],
      why: "F4" },
    { path: "/carryRefuse", to: ["ago", "since", "started", "began"],
      why: "F2 guard: confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard); lead decision L3. In a heard entry's own utterance it withholds the duration and no carry-over opens from that utterance (R9 c, f); in a carried reply it refuses the carry" },
    { path: "/normalize", to: { apostrophes: true, numbers: "en" },
      why: "text normalization (lead decision D4); numbers apply to band phrase matching only (lead decision L2, 2026-10-04)" },
    { path: "/goldSet",
      from: { version: "0.2.0", lexiconVersion: "0.3.1", file: "masque_extraction_goldset.json" },
      to:   { version: "0.3.0", lexiconVersion: "0.3.2", file: "masque_extraction_goldset_0.3.0.json" }, why: "gold set re-run" },
  ],
  changelog: {
    date: "2026-10-04",
    kind: "lexicon",
    note: "Lexicon 0.3.1 → 0.3.2, approved by the clinical lead on 2026-10-04. v_vertigo: heard signal on (heard) and carry-over 2 (carry): when its cue is heard with no duration phrase the item stays unanswered and is shown as heard, and the next two patient replies may supply the duration — same item only; refused when the reply names anything else the lexicon knows, contains the item's own cue, is a question, contains a carryRefuse phrase, or when any duration phrase in it is negated (a negation cue anywhere before it in the reply), its duration phrases disagree, or it is attributed or historical. v_vertigo carry exclusions (carryExclude; clinical-lead decision 2026-10-04, day ranges are same-sentence only): about a day, overnight, for a day or two, for a couple of days, for two days, for three days set the duration only in a sentence where a v_vertigo cue is said, not negated, attributed or historical (a sentence ends at . ! ? or ; followed by whitespace or the end of the text), never from a carried reply; elsewhere in the cue's own utterance, and in a reply, they never supply the duration but still count for the negation and disagreement tests, so an utterance or reply in which one of them disagrees with another duration phrase gives no duration, and one standing alone outside such a sentence is a stated duration that is withheld. In the cue's own utterance a heard entry takes a duration only when the duration phrases found there agree, none of them is negated and no carryRefuse phrase occurs (an onset is not a duration); a phrase inside a longer phrase does not count. A duration that is stated but withheld leaves the item heard, opens only a yield-only slot (it keeps the yieldTo suppression for the next replies and never carries a value), and turns an open slot of that item yield-only with its reply window renewed, so the clinician asks. m_dur yields to v_vertigo (yieldTo) unless an approved anchor phrase is present and not negated, so a dizziness-duration sentence no longer scores the headache-attack duration; the yield holds while the reply window of a heard v_vertigo cue is open, also after its heard card is answered or skipped (an answered or skipped item is never carried); anchors: headache, facial pressure, facial pain, pressure in my face, behind my eyes, migraine lasts, migraines last, head pain. carryRefuse: ago, since, started, began — confirmed by the clinical lead on 2026-10-04 (proposed by the team as a carry-over guard). In a heard entry's own utterance it withholds the duration and no carry-over opens from that utterance; in a carried reply it refuses the carry. It can only prevent a capture, never cause one: withholding a duration no longer arms carry-over, so no later reply can supply a value because of it (an utterance with no duration phrase arms carry-over as before). Text normalization (normalize): before matching, curly apostrophes are read as a straight apostrophe; for duration band phrases only (clinical-lead decision 2026-10-04, digits for durations only), the standalone whole numbers 0–20 and 30, 40 … 90 are read as English words, so typed digits never reach a cue, yes/no, context, multi-item or red-flag phrase or a negation, attribution or history window; every other number stays as digits. Phrases appended: /lexicon/scale/1/cue (v_vertigo cues): world is moving, world moving around, world's moving, world was moving, everything spins, everything spun, room spun, room is moving, everything is moving, like i'm on a boat, like i was on a boat, like i am on a boat, like being on a boat, rocking feeling, rocking sensation, swaying side to side, feel unsteady, unsteady on my feet, losing my balance, lose my balance, balance is off; /lexicon/scale/1/bands/0/ph (v_vertigo, Under 5 min): split second, a second or two, a couple minutes, under five minutes, less than five minutes, two minutes, three minutes, four minutes; /lexicon/scale/1/bands/2/ph (v_vertigo, 5 min – 72 h): half the day, half a day, about a day, all night, for a day or two, for a couple of days, for two days, for three days, overnight; /lexicon/scale/1/bands/1/ph (v_vertigo, Over 72 h): lasts more than three days, lasted more than three days, days at a time; /lexicon/bool/8/ph (v_head): roll over, rolled over, turning over, over in bed, when i turn my head, when i look up, when i lie back, lying back in, tip my head back, high shelf, bending over; /lexicon/bool/6/ph (v_motion): driving through a tunnel, drive through a tunnel, patterned, busy visual, dizzy riding in a car, sick riding in a car; /lexicon/bool/7/ph (v_aural): ears feel full, ears ring, roaring; /lexicon/bool/19/ph (v_migfeat): headache during the dizz, headaches during the dizz; /lexicon/negation/cues: fewer than; /lexicon/thirdParty/cues: my grandmother, my grandma, my aunt, my uncle, my friend. Drafts struck and known risks: listed in CHANGELOG.md. Instrument 0.2 and probe set 1.0.0 unchanged. Gold set 0.2.0 → 0.3.0: 218 utterances and 93 dialogues added; no 0.2.0 case or label changed.",
    paths: ["/lexicon/version", "/lexicon/scale/1/heard", "/lexicon/scale/1/carry", "/lexicon/scale/1/carryExclude",
      "/lexicon/scale/2/yieldTo", "/lexicon/scale/2/anchor", "/lexicon/carryRefuse", "/lexicon/normalize", "/lexicon/goldSet",
      "/lexicon/scale/1/cue", "/lexicon/scale/1/bands/0/ph", "/lexicon/scale/1/bands/2/ph", "/lexicon/scale/1/bands/1/ph",
      "/lexicon/bool/8/ph", "/lexicon/bool/6/ph", "/lexicon/bool/7/ph", "/lexicon/bool/19/ph",
      "/lexicon/negation/cues", "/lexicon/thirdParty/cues"],
  },
};
