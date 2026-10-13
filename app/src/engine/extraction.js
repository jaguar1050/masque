// engine/extraction.js — rule-based phrase extraction with the lexicon injected
// (design 03 §4.9; heard, carry-over, yield and normalization: design 05 §1-§4, round 2: §12,
// round 3: R9-R11, round 3b: yield-only slots, round 3d: §13.12). Owner: WP5.
//
// The matcher is the baseline extraction engine (Ext L172-300) moved verbatim, with the
// module-level phrase constants replaced by a `lexicon` argument (rubric.lexicon, §3.2):
//
//   baseline constant   lexicon key
//   NEGATION            negation      {window, cues}
//   THIRD_PARTY         thirdParty    {window, cues}
//   HISTORICAL          historical    {window, cues}
//   BOOL_EX             bool          [{id, ph, thirdPartyExempt?}]
//   CTX_EX              ctx           [{id, val, ph}]
//   SCALE_EX            scale         [{id, cue, bands:[{ph, v}], fallback}]
//   MULTI_EX            multi         [{ids:[{id, value, kind}], ph}]
//   RF_PHRASES          redFlags      {flagId: phrases}
//
// Nothing here branches on an id: every id comes from the lexicon. The pass order, the
// first-hit / all-hits choice per family, the gating order (third party, then historical)
// and the significance of band order are those of the baseline, so a module's captures are
// byte-identical to the baseline's for the same lexicon.
//
// Red flags are the one family that is never gated: a cue phrase raises the flag for
// clinician review and nothing in the text may lower one (no negation, attribution or
// history check). Every other capture is gated.
//
// Optional lexicon fields (design 05), all module data and each inert when absent, so a
// lexicon without them extracts exactly as the baseline does (EXTRACTOR_FEATURES lists them):
//   scale[i].heard    with opts.includeHeard, a cue heard without its value (no band value, no
//                     fallback) is returned as a capture of kind "heard": it has no value and is
//                     never an answer, so absent data stays absent. A heard entry also chooses
//                     its band by agreement rather than by band order ("Band choice" below)
//   scale[i].carry    extractInContext lets that many following patient replies supply the
//                     value from one of the entry's own bands (an item capture, via "carry")
//   scale[i].carryExclude  band phrases of that entry that never supply a carried value. In the
//                     cue's own utterance they supply a value only inside a cue sentence
//                     ("Sentences" below); elsewhere, and in a carried reply, they can only
//                     withhold or refuse
//   scale[i].yieldTo  the entry captures nothing (no value, no heard) in an utterance where a
//   scale[i].anchor   listed entry is named (negated or not) or pending, unless one of its
//                     anchor phrases occurs unnegated
//   carryRefuse       phrases that stop a reply from supplying a carried value; for a heard
//                     entry, one anywhere in the cue's own utterance also withholds any band value
//                     that utterance states, and then no carry-over opens from it
//   normalize         apostrophes: true folds typographic apostrophes to "'". The folded text has
//                     the original's length, so its offsets are original offsets. Every phrase
//                     family except the band phrases, and every gate window (negation,
//                     attribution, history), runs on the folded text. numbers: "en" spells
//                     standalone small integers as English words for band phrase matching only
//                     (scale bands, in the cue's own utterance and in a carried reply); a band
//                     found on the spelled text is mapped back to original offsets before any
//                     window check. Every reported index is in original-text coordinates, and the
//                     evidence is always the original text (lexicon.clauses below excepted).
//   clauses           chart reading (release 0.4.7, "Chart reading" below), for every line: typed chart
//                     text, and spoken and demo lines since the clinical lead's decision D9 of 2026-10-12
//   clarify           clarification triggers, read by clarifyCues only (never by extract)
//
// Chart reading (lexicon.clauses, release 0.4.7). It applies to every utterance read under a lexicon
// with the field: typed chart text (opts.chart true) and, since the clinical lead's decision D9 of
// 2026-10-12, spoken and demo lines too (review round 2, R2, had kept it to typed chart text). Without
// the field nothing below applies and every family runs exactly as above. The utterance is read clause
// by clause, every list being module data ({ph, source} rows) and every rule engine-owned (the review
// fixes of round 1 are marked R1, those of round 2 R2, those of round 3 R3, the sign-off's D7-D9); the
// few rules that differ between typed chart text and a spoken line are in "Spoken lines" below:
//   Segmentation. The text is split into lines (CRLF, CR and LF alike). A line that is a section
//     word of clauses.sections (any case, an optional trailing ":") opens that section kind; a word
//     of the kind "read" (history, assessment, plan …) reads normally and ends any section kind. Any
//     other line ending in ":" with nothing after it, and an all-capitals line of at most four
//     words, is a header: inside an exam section it is a sub-label and keeps the exam ("HEENT:",
//     "Neuro:"); anywhere else it ends the section kind (R1). "Label: text" at a line start whose
//     label is a section word sets that kind for that line and its wrapped continuation only (R1:
//     "Allergies: NKDA" no longer silences the lines below it), and the ":" ends a clause; a "read"
//     label ends the section kind; a label that names no section reads in the section kind with its
//     text ("Label: no" is the label denied, "Label: <placeholder>" the label unfilled). A line
//     continues the previous one (a wrapped line) when that line has no clause end (. ! ? ; :) and
//     this one starts lower-case, is indented deeper, or the previous one ends in "," or "/"; a plain
//     line that may be an item of a list under a denial header is never a wrapped line (R3). Clauses
//     end at . ! ? ; followed by whitespace or the end (the SENTENCE_END rule), except a "?" with no
//     letter or digit before it in its clause, which belongs to the words after it ("? aura" hedges
//     them, R1), and except the "." of an abbreviation (R3): whitespace and a lower-case letter follow
//     it, the clause it would end opens with a capital and names no finding before it, and the token
//     before it has at most six letters or holds a dot ("No assoc. nausea.", "Denies hx. of aura.",
//     "e.g."); at every line end that is not a wrap; before a second "Label:" on a line of labels (R3:
//     "Nausea: no Photophobia: yes"); and before a clauses.breaks cue. A clause never crosses a header.
//   Lists under a denial (R1). A line that holds a clauses.deny cue, no affirm cue after it and no
//     finding, and is a header ("Patient denies:", "Negative for:") or ends with that cue ("Denies"),
//     heads a list: the bullet and deeper-indented lines below it, and under a header also plain
//     lines of at most four words with no cue and no scopeEnd word, are its items, until a blank
//     line, a header or any other line. A line opening with "+" or holding an affirm cue ends the list,
//     and once a bullet was read a plain line ends it too (R3: "+ night sweats", "New nosebleed this
//     week." after the bullets). Each item's clause reads as if the denial opened it (rule c).
//   Matching. Every whitespace character (a line break included) is read as a space, so a phrase
//     or cue split over a wrapped line matches. clauses.wordStart: true matches every phrase and
//     every cue of the lexicon's own lists (negation, attribution, history) only at a word start:
//     the character before it is not a letter or a digit (a cue that starts with neither, such as
//     "?", is unbounded). A phrase keeps matching as a stem at its end ("light sensitiv"). The cue
//     lists of clauses (affirm, deny, post, prefix, breaks, scopeEnd, complement, hedge, placeholder,
//     thirdParty) match as whole words, wordStart or not: at a word start as above and at a word end,
//     the character after the cue being no letter or digit, so "yes" never reads at the start of
//     "yesterday". A cue whose first or last character is not a letter or a digit is unbounded on
//     that side ("has ", "non-", " negative", "?"). A phrase hit lying inside an occurrence of a
//     clauses.mask word is no hit (clarification triggers excepted, R2: a mask hides a phrase from
//     capture, and a trigger captures nothing). Lowercasing keeps every character's length (R1: "İ"
//     stays as it is), so every offset is an offset in the text. A "finding" is a hit of any topic
//     phrase (yes/no, context and multi-answer phrases, red-flag phrases, clauses.redFlags phrases,
//     scale cues, clarification triggers), to the end of its word. A plus sign before a word, not
//     inside "(+)", after a letter or digit or before "/" ("+photophobia", "+ night sweats"), counts as
//     an affirm cue (R3). The items of a list are separated by "," ";" "/" and the joining words "and"
//     and "or"; a "/" separates only when a space or a finding touches it ("nausea/vomiting"), and
//     between two other words joins them inside one item (R3: "visual/auditory auras", "h/o").
//   Shielded cues (R2). A negation cue of the lexicon, or a clauses.deny, post or prefix cue, lying
//     inside a longer clauses.affirm or clauses.hedge cue is no cue: "no relief" (an affirm cue: the
//     treatment was given and failed) holds the deny cue "no ", "not sure" (a hedge) holds "not ".
//   Label answers (R2, R3). A clauses cue standing right after a finding, with only whitespace and at
//     most one ":" or "-" between (whitespace alone only for a cue that starts with no letter or digit,
//     a sign such as "(+)" or "(-)"; any finding right after the first one is skipped, so "Pulsatile
//     tinnitus: (+)" answers both words), and closing the item (the clause end, punctuation, "and" or
//     "or" after it: R3), answers that finding as a label. A cue followed by more words answers nothing
//     ("No nausea - reports good appetite.", "Headache: denies nausea, …"), and a sign between two
//     findings with only spaces around it is the prefix of the finding after it (R3: "(+) nausea (-)
//     photophobia"). A clauses.affirm cue so placed affirms its label unless a denial in the label's
//     own list item governs it (a prefix ending at the finding, or a negation or deny cue before it in
//     the item with no affirm cue between: R3, "Non-pulsatile tinnitus: yes." affirms the tinnitus and
//     keeps the prefix; "Denies nausea, photophobia: endorses." affirms the photophobia). A clauses.deny
//     cue so placed ("Aura: (-), nausea") answers its label only and opens no list denial (rule c).
//   Negation, for a hit in clause C, the first that applies (a label answer by an affirm cue first):
//     a. window: a negation cue within the lexicon window before the hit, the window clipped to
//        C's start, with no clauses.affirm cue and no clauses.scopeEnd word between that cue and the
//        hit (R1). A negation cue that holds another negation cue at its end is measured from that
//        cue (R1: "didn't" from its "n't"), so the window keeps the reach it had without wordStart. A
//        window cue in an earlier list item than the hit reaches it only when the hit's item is the
//        finding alone; otherwise the mention is uncertain (R3: "No nausea, tinnitus reported.");
//     b. prefix: a clauses.prefix cue ending exactly at the hit (attribute negation: the mention is
//        dropped, never recorded as a denial; for a red flag it counts as a denial);
//     c. scope: a clauses.deny cue earlier in C (or heading C's list) with no affirm cue between it
//        and the hit: a list denial. It reaches the hit unless a clauses.scopeEnd or (R3)
//        clauses.complement word lies between them, or, when the hit is in a later list item, a
//        scopeEnd word follows the hit in its own item (R1: "No interpreter available, so nausea …",
//        "No change in hearing, tinnitus is pulsatile."; R3: "No workup for pulsatile tinnitus."). In a
//        later list item, or an item of a list carried from a line above, it reaches only an item that
//        is the finding alone, no other word before or after it (R3: "No dizziness, tinnitus in the
//        right ear only."). A hit it does not reach is "uncertain": set aside, neither affirmed nor
//        denied (no capture);
//     d. post: a clauses.post cue after the hit in C that closes its item (the clause end,
//        punctuation, "and" or "or" after it), with only a ":" between, one other word ("Positional
//        testing negative."), or a list of findings it closes ("Nausea, photophobia: negative.") (R1),
//        and no affirm cue governing the hit directly (before it, no separator or denial between); an
//        affirm cue later in C naming no finding of its own takes it back ("… previously denied, now
//        endorsed."): uncertain.
//     The lexicon's own negation cues stay window-only; only clauses.deny spreads over a list. A
//     complement word does not stop the window (a yes/no item keeps release 0.4.6's reach: "No hx of
//     aura.").
//   Gates. Attribution (the lexicon's thirdParty cues and clauses.thirdParty) and history windows are
//     clipped to the clause too. In typed chart text (opts.chart true) a lexicon thirdParty cue listed
//     in clauses.chartIgnoreThirdParty does not gate when a finding follows it: in a chart note a
//     pronoun such as "her" or "his" names the patient ("Her tinnitus is bilateral."). Followed by
//     anything else it gates as in speech (R1: "Her husband has tinnitus."), and a relative ("Her
//     mother has …", a clauses.thirdParty cue) and every other cue still gate. Spoken lines
//     (opts.chart absent) read every cue. Section kinds: "skip" captures nothing; "family" gates every
//     capture as third party except a thirdPartyExempt entry; "exam" captures only the items in
//     clauses.examItems. A clause holding a clauses.placeholder cue captures nothing. A clause
//     holding a clauses.hedge cue records nothing either: the item is left for a clarification
//     card instead (typed chart text; clarification reads no spoken line).
//   Mentions. A yes/no entry collects every mention, in text order: affirmed only → "yes", denied
//     only → "no" (an uncertain mention, like an attribute-negated one, is set aside). When both
//     occur, a conflict (no capture, left for a clarification card) needs one finding said both
//     ways: the same phrase of the entry, or two of its phrases whose spans overlap, affirmed in one
//     mention and denied in another. Different phrases of one entry that disagree are different
//     findings of it (an item may cover several: "It's not the weather … it's when I skip meals."
//     affirms the meal trigger), so the affirmed mention wins: "yes". Except for an item of
//     clauses.strictConflict (the rule-out items: a "yes" there lowers the index), where any affirmed
//     and any denied mention is a conflict, whatever the phrases: a mixed chart neither lowers the
//     index nor records a denial the text contradicts. Context, scale cue and multi-answer entries
//     take the first mention, in text order, that is neither negated, uncertain nor gated (a gated one
//     only when no ungated one is left). In typed chart text a heard entry takes its band phrases and
//     carryRefuse phrases from its cue's own clause only ("Spoken lines": a spoken line keeps "Band
//     choice"); a band phrase elsewhere in the utterance gives no value but
//     still withholds the entry (no normal carry-over slot arms).
//   Red flags. Each flag's phrases are lexicon.redFlags[flag] followed by
//     clauses.redFlags[flag] (chart-register phrases, R2), and a flag of clauses.redFlags alone is read
//     after the lexicon's flags; a hit lying strictly inside a longer hit of the same flag is part of
//     it ("droop" inside "facial droop"). Unchanged (never gated) unless clauses.redFlagNegation is
//     true: then a flag is raised only when at least one mention is not denied, and a denied flag is
//     neither raised nor listed. Only a denial that governs the flag phrase directly denies it (R1,
//     narrowed in R3), and exactly these do:
//       1. a clauses.prefix cue ending at the flag phrase ("non-pulsatile");
//       2. in the flag's own list item, a negation cue within the window, or a clauses.deny cue, before
//          the phrase with only plain words between: no ":", finding, affirm cue, plus sign, scopeEnd
//          word or complement word ("Denies pulsatile tinnitus", "No assoc. diplopia."; R3: "No
//          steroids given for sudden hearing loss." and "No CT for diplopia." raise);
//       3. a clauses.deny cue heading the list (in the clause or on a line above) when the flag's item,
//          a later item, is the bare flag phrase: no other word before or after it in the item and no
//          affirm cue or plus sign in it, and no scopeEnd or complement word between ("No vision loss,
//          diplopia, facial droop, or slurred speech."; R3: "No nausea, double vision reported.",
//          "No nausea, +double vision." and "Denies:" over "+ night sweats" raise);
//       4. a closing clauses.post cue right after the phrase (only findings between), with no affirm
//          cue before the phrase in its item ("Pulsatile tinnitus denied.", "Aura (-)").
//     Nothing else lowers a flag: not a label answer, a distant or non-closing post cue, an uncertain
//     reading, a section, a hedge or a placeholder. In a spoken line a reply word lowers no flag either
//     ("Spoken lines").
//   Evidence. Every capture's evidence is its clause's text, and clause: {start, end} (original
//     offsets) is added after the capture's other keys; the clause always holds the capture's cueIndex.
//   Spoken lines (D9). An utterance read without opts.chart (a spoken or demo line) is read with every
//     rule above, and differs from typed chart text in these only:
//     - carry-over stays as it was (the lead's D9 keeps it): extractInContext arms, consumes, refuses and
//       carries exactly by steps 2-7 below, a heard entry chooses its band by "Band choice" below (its
//       band phrases, negations and carryRefuse phrases anywhere in the utterance, not only in its cue's
//       clause), and a yieldTo entry's anchors are read with the negation window, as before;
//     - the chartIgnoreThirdParty pronouns gate as every attribution cue does (D19: the exception is
//       typed chart text's);
//     - context markers are captured (typed chart text sets none: the lead's D8 answer);
//     - reply words: a clauses.deny cue that opens its clause and is followed by a word starting no
//       finding, with no list separator before the next finding ("no it's more of a whooshing with my
//       heartbeat": a speech transcript has no comma after the "no"), answers the clinician's question:
//       it lowers no red flag, neither as a list denial nor as a window cue (a negation cue lying inside
//       it); it still denies a yes/no, context, scale or multi-answer entry as any deny cue does. A
//       direct denial ("no double vision", "no I've never had double vision": the window cue "never")
//       and a list of negatives ("No fever, chills, double vision.") still lower a flag;
//     - clarifyCues reads no spoken line with chart reading (clarification stays with typed chart text).
// opts.chart true marks typed chart text (extract, extractInContext and clarifyCues alike): the
// chartIgnoreThirdParty cues do not gate before a finding ("Gates" above), no context marker is captured
// (D8), a heard entry takes its band from its cue's clause, clarifyCues reads the hedge, conflict and
// placeholder cues, and extractInContext returns the captures of the utterance with the pending slot
// left exactly as it was (never consumed, refused, carried into or armed). Without lexicon.clauses,
// opts.chart changes no capture of extract or clarifyCues, but extractInContext with opts.chart still
// never carries, whatever the lexicon: a reply that a spoken line would carry into the open slot
// records nothing carried (R1: stated here; the behaviour is release 0.4.7's, spec §3.8).
//
// Band choice. An entry without heard: true takes the first band, in band order, with a phrase
// anywhere in the text (the baseline rule). An entry with heard: true collects every occurrence
// of every band phrase and drops a span lying strictly inside a longer span (a carryExclude span
// holds the words it contains, so no shorter phrase inside it counts either). It takes a band
// value only when no span left is negated within the negation window, no carryRefuse phrase occurs
// in the utterance, the spans agree on one value, and some span may supply it: a span that is not
// a carryExclude phrase, or a carryExclude span inside a cue sentence. Every span, wherever it
// lies, counts for the negation and agreement tests. Each of these four conditions can only
// withhold the band value. Without a band value the entry takes its fallback; without a fallback
// either it is heard. It is also unresolved, so carry-over can arm, only when the utterance holds
// no band span at all. A band that was stated but not taken (the entry is withheld) opens no
// carry-over window: it arms at most a yield-only slot ("Slots" below), so the value is left to be
// asked rather than carried from the replies that follow, while the entries that yield to it keep
// yielding for that window.
// A carried reply collects the pending entry's band spans, its carryExclude phrases included,
// and is refused as a whole when any span is negated (in the window before it, or by a negation
// cue anywhere in the reply before it) or when the spans give two or more values. The value
// comes from a span that is not a carryExclude phrase; a reply with only excluded spans has no
// band.
//
// Sentences. A sentence ends at one of . ! ? ; followed by whitespace or the end of the text
// (SENTENCE_END). A "." inside a token ("2.5", the first dot of "e.g.") ends nothing; an
// abbreviation followed by whitespace ("e.g. x") does end a sentence. Commas, dashes, line
// breaks without punctuation, "…" and an opening "¿" or "¡" end nothing. A band span or cue hit
// belongs to the sentence of its first character. A cue sentence is one holding a hit of any of
// the entry's cue phrases that is not negated and passes the attribution and history gates, so
// the entry's opening hit always makes one. Only a carryExclude phrase needs a cue sentence to
// supply a value; every other band phrase supplies one anywhere in the utterance.
//
// Slots (extractInContext). There is at most one slot: a PendingCue for a scale entry that may
// carry (heard: true and an integer carry from 1 to LEXICON_CARRY_MAX). A normal slot may carry a
// value into a later reply; a yield-only slot (yieldOnly: true) never does: step 4 skips it, as it
// does with {carry: false} (no carry, no refusal). Both kinds count as pending for yieldTo, and both
// are validated, consumed and expired alike. After each patient utterance, in this order:
//   Step 4. A normal slot read with carry on turns yield-only when the utterance withholds the
//      slot's own entry (round 3 closed it); step 6 rule 3b then refreshes it, unless rule 1 or 2
//      decides first. Read with carry off it stays normal and only loses the reply.
//   Step 5. A slot with no reply left expires.
//   Step 6. Let s be the utterance's scan (the slot's id pending) and r the scan round 3+ (below)
//      makes of it: s itself, or, when the slot read is yield-only, the utterance scanned with no id
//      pending.
//      The first rule that applies decides:
//      1. Normal slot. r holds exactly one unresolved id, its entry may carry and its cue lies inside
//         no phrase of another entry (an entry that yielded in r excepted): that entry gets a normal
//         slot with turnsLeft = its carry. It arms, refreshes (the entry's cue heard again with no
//         band, after a withheld line too) or supersedes any slot, normal or yield-only, of any
//         entry. A normal slot always takes precedence over a yield-only one.
//      2. Clear. s holds any unresolved entry (one rule 1 does not arm, or two or more cues awaiting
//         a value): the slot is cleared. An entry that yields to the pending id is not unresolved in
//         s, so it never clears the slot it yields to.
//      3. Withheld. Let W be the distinct ids of s's withheld entries whose entry may carry (other
//         withheld entries are ignored):
//         a. W is empty: the slot stays as steps 3-5 left it.
//         b. The slot is one of an entry in W: a yield-only slot (one step 4 just converted
//            included) is refreshed, replaced by a new one as in d for that entry; a normal slot
//            (read with carry off) stays as it is.
//         c. The slot is a normal slot of another entry: it ends, replaced as in d or cleared as in
//            e, so no later reply is carried into an entry the patient has moved on from. Round 2,
//            finding no value for the withheld entry, ended it too by arming that entry over it.
//         d. W holds one id: that entry gets a yield-only slot, turnsLeft = its carry, its cue fields
//            taken as for an unresolved cue, even when the cue lies inside another entry's phrase
//            (a yield-only slot carries nothing). It replaces no slot, or a slot of another entry,
//            normal (c) or yield-only.
//         e. W holds two or more ids: the slot is cleared.
// Let round 3+ be round 3 (the band choice above, no yield-only slot: a withheld entry arms nothing,
// and one of the slot's own entry read with carry on closes the slot) with rule 3c added: a withheld
// entry that may carry closes a normal slot of any entry not itself withheld on that line (not in W).
// Where round 3+ holds a normal slot, this engine holds the same one; elsewhere it holds a
// yield-only slot or none. Rule 1 decides on r, the scan round 3+ makes, so a normal slot arms
// exactly when round 3+ arms one, and a yield-only slot adds nothing to any scan but one pending id,
// which can only make an entry yield. So no value is recorded that round 3+ would not record; an
// entry that yields may be suppressed where round 3+ recorded it. Refreshing a yield-only slot (3b)
// only lengthens that suppression.
// Against round 3 itself, rule 3c is not removal-only. It removes the carry into the entry A whose
// slot it ends, and from the next line on it changes which id is pending: B, the withheld entry, as
// a yield-only slot, or none, where round 3 held A (on the rule-3c line itself A is still pending in
// the scan). Every later decision that reads the pending id follows, and the effects chain until the
// two engines' slots agree again. An entry C that yields to A, and not to the id pending here, stops
// yielding: its value may be recorded, and its cue heard with no band may clear the slot (rule 2),
// keep another entry X from arming where round 3 armed X (rule 1 needs exactly one unresolved id),
// or, if C may carry, arm a normal slot of C (rule 1), where round 3 had C yield. An entry that
// yields to such an X then stops yielding too, and may record the value round 3 carried into X. In
// general, a value recorded here and not by round 3 is, on its line, either of an entry that yields
// in round 3, to the id round 3 holds pending, and does not yield here, or carried into a normal slot
// that round 3 does not hold. Round 2 also ended A's slot where it found no value for B (it armed B
// over A, or cleared the slot). Where it took B's value it kept A's slot, as round 3 does, and there
// such values may be recorded by neither round (design 05 §13.12). Keeping these effects to the
// entries that yield to A would need A kept pending beside B, a second pending id (follow-up
// F-3D-4). Rule 3c needs two entries that may carry.
//
// Pure; no React; no import-time side effects.

import { LEXICON_CARRY_MAX, LEXICON_SECTION_KINDS } from "./contract.js";

/** What kind of extractor this is (Ext L25). */
export const EXTRACTOR_KIND = "rule-based / phrase-match with local negation";
/**
 * The lexicon fields this extractor honours beyond the baseline's (printed by the benchmark).
 * "normalize.numbers" applies to band phrase matching only; "clarify" is read by clarifyCues only.
 */
export const EXTRACTOR_FEATURES = Object.freeze(["scale.heard", "scale.carry", "scale.carryExclude", "scale.yieldTo",
  "scale.anchor", "carryRefuse", "normalize.apostrophes", "normalize.numbers", "clauses", "clarify"]);

const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const NO_CUES = Object.freeze({ window: 0, cues: Object.freeze([]) });
const cueSpec = (x) => (isObj(x) && Array.isArray(x.cues) ? x : NO_CUES);
const isPhrase = (p) => typeof p === "string" && p !== "";
const same = (k) => k;

// lexicon.normalize. The typographic apostrophes U+2018, U+2019, U+02BC and U+2032 are one UTF-16
// unit each, as is "'", so folding them keeps every offset.
const CURLY_APOSTROPHES = /[‘’ʼ′]/g;
// A standalone integer token: not preceded by a letter, a digit or one of . : / , % - and not
// followed by a letter, a digit or one of : / , % -. A following "." counts as sentence
// punctuation only when whitespace or the end of the text comes after it, so a sentence-final
// "for 3." is spelled out while a decimal (1.5) is not. Times (10:30), fractions (1/2), ranges
// (3-4), percentages (50%), grouped numbers (1,000) and tokens touching letters (B12, 2nd, x2)
// stay as digits. The same token rule as the validator's V29 check.
const NUMBER_TOKEN = /(?<![\p{L}\p{N}.:\/,%-])\d+(?![\p{L}\p{N}:\/,%-])(?!\.\S)/gu;
// Only 0-20 and the round tens 30-90. Every other integer (21-29, 31-39 …, 100 and over) stays as
// digits: its words ("twenty-two") would hold a smaller number's word and match a phrase meant
// for that smaller number. Leading zeros ("05") are not spelled out either.
const NUMBER_WORDS_EN = new Map([
  ["0", "zero"], ["1", "one"], ["2", "two"], ["3", "three"], ["4", "four"], ["5", "five"],
  ["6", "six"], ["7", "seven"], ["8", "eight"], ["9", "nine"], ["10", "ten"], ["11", "eleven"],
  ["12", "twelve"], ["13", "thirteen"], ["14", "fourteen"], ["15", "fifteen"], ["16", "sixteen"],
  ["17", "seventeen"], ["18", "eighteen"], ["19", "nineteen"], ["20", "twenty"], ["30", "thirty"],
  ["40", "forty"], ["50", "fifty"], ["60", "sixty"], ["70", "seventy"], ["80", "eighty"], ["90", "ninety"],
]);
// A sentence end ("Sentences" above): one of . ! ? ; followed by whitespace or the end of the text.
const SENTENCE_END = /[.!?;](?=\s|$)/g;

/** Index of the first phrase (in list order) found in `text`, case-insensitively; -1 if none (Ext L172-175). */
export function firstHit(text, phrases) {
  const low = text.toLowerCase();
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return i; }
  return -1;
}

/**
 * Every position any phrase matches, ascending (Ext L187-195). Scanning all hits and
 * preferring an unnegated one means a single unnegated mention is an affirmation regardless
 * of what else in the sentence is denied.
 */
export function allHits(text, phrases) {
  const low = text.toLowerCase();
  const out = [];
  for (const p of phrases) {
    let i = low.indexOf(p);
    while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); }
  }
  return out.sort((a, b) => a - b);
}

/** Whether any cue of `spec` ({window, cues}) occurs in the `spec.window` characters before `idx` (Ext L197-200). */
export function cueBefore(text, idx, spec) {
  const pre = text.slice(Math.max(0, idx - spec.window), idx).toLowerCase();
  return spec.cues.some(c => pre.includes(c));
}

/** The first phrase (in list order, exactly as firstHit) found in `text`, with its index; null if none. */
function firstHitPhrase(text, phrases) {
  const low = text.toLowerCase();
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return { i, phrase: p }; }
  return null;
}

/** Every non-overlapping position of phrase `p` in `low`, ascending (the allHits step). */
function occurrences(low, p) {
  const out = [];
  let i = low.indexOf(p);
  while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); }
  return out;
}

/**
 * `s` lowercased character by character, a character whose lowercase has another length (U+0130
 * "İ" lowercases to two UTF-16 units) kept as it is, so the result has the length of `s` and its
 * offsets are offsets in `s` (chart reading only, release 0.4.7 review fixes).
 */
function lowerKeep(s) {
  const l = s.toLowerCase();
  if (l.length === s.length) return l;
  let out = "";
  for (const ch of s) { const x = ch.toLowerCase(); out += x.length === ch.length ? x : ch; }
  return out;
}

/**
 * The texts matching runs on, and the map back to `text`: {fold, flow, norm, low, at}.
 *   fold, flow  `text` with typographic apostrophes folded (lexicon.normalize.apostrophes), and its
 *               lowercase. fold has the length of `text`, so an offset in fold is an offset in
 *               `text`. Every phrase except a band phrase, and every gate window, is matched on fold.
 *   norm, low   fold with standalone small integers spelled out (lexicon.normalize.numbers), and its
 *               lowercase. Band phrases alone are matched there.
 *   at(k)       maps an offset in norm to `text`; an offset inside a spelled-out number maps to the
 *               start of its digits.
 * Without lexicon.normalize, fold === norm === text and `at` is the identity. With `keep` (chart
 * reading: every line under lexicon.clauses, or clarifyCues) the lowercase keeps the length
 * (lowerKeep), so flow and low offsets are fold and norm offsets.
 */
function textView(lexicon, text, keep = false) {
  const n = isObj(lexicon.normalize) ? lexicon.normalize : null;
  const lower = keep ? lowerKeep : (x) => x.toLowerCase();
  const fold = n !== null && n.apostrophes === true ? text.replace(CURLY_APOSTROPHES, "'") : text;
  const flow = lower(fold);
  const plain = { fold, flow, norm: fold, low: flow, at: same };
  if (n === null || n.numbers !== "en") return plain;
  const starts = [];
  let norm = "";
  let last = 0;
  let changed = false;
  for (const m of fold.matchAll(NUMBER_TOKEN)) {
    const word = NUMBER_WORDS_EN.get(m[0]);
    if (word === undefined) continue;
    const a = m.index;
    for (let k = last; k < a; k++) starts.push(k);
    for (let k = 0; k < word.length; k++) starts.push(a);
    norm += fold.slice(last, a) + word;
    last = a + m[0].length;
    changed = true;
  }
  if (!changed) return plain;
  for (let k = last; k < fold.length; k++) starts.push(k);
  norm += fold.slice(last);
  starts.push(fold.length);
  const clamp = (k) => (k < 0 ? 0 : k > norm.length ? norm.length : k);
  return { fold, flow, norm, low: lower(norm), at: (k) => starts[clamp(k)] };
}

/**
 * Every occurrence (negated, attributed or historical alike) of every topic phrase in `low`, as
 * [{start, end}]: the bool, ctx and multi phrases, every red-flag list, and the cue list of every
 * scale entry whose id is not `excludeId` and that `excludeScale(entry)` does not accept. Band
 * lists and the negation, attribution and history cue lists are not topics.
 */
function topicSpans(lexicon, low, excludeId, excludeScale) {
  const out = [];
  const add = (phrases) => {
    for (const p of arr(phrases)) if (isPhrase(p)) for (const i of occurrences(low, p)) out.push({ start: i, end: i + p.length });
  };
  for (const e of arr(lexicon.bool)) if (isObj(e)) add(e.ph);
  for (const e of arr(lexicon.ctx)) if (isObj(e)) add(e.ph);
  for (const e of arr(lexicon.multi)) if (isObj(e)) add(e.ph);
  if (isObj(lexicon.redFlags)) for (const ph of Object.values(lexicon.redFlags)) add(ph);
  for (const e of arr(lexicon.scale)) if (isObj(e) && e.id !== excludeId && !excludeScale(e)) add(e.cue);
  return out;
}

/**
 * The band spans of scale entry `e` in `low` (the band-matching text of textView): one
 * {start, end, v, phrase} per occurrence of each band phrase, in `low` offsets, leaving out bands
 * without a value. A span lying strictly inside a longer span is dropped: it is part of that
 * phrase, not a band of its own.
 */
function bandSpans(e, low) {
  const spans = [];
  for (const b of arr(e.bands)) {
    if (!isObj(b) || b.v === null || b.v === undefined) continue;
    for (const ph of arr(b.ph)) {
      if (isPhrase(ph)) for (const i of occurrences(low, ph)) spans.push({ start: i, end: i + ph.length, v: b.v, phrase: ph });
    }
  }
  return spans.filter(x => !spans.some(y => y.start <= x.start && x.end <= y.end && y.end - y.start > x.end - x.start));
}

/** The offsets of the sentence ends (SENTENCE_END) in `t`, ascending. */
function sentenceEnds(t) {
  const out = [];
  for (const m of t.matchAll(SENTENCE_END)) out.push(m.index);
  return out;
}

// ---------------------------------------------------------------------------------------
// Chart reading (lexicon.clauses, "Chart reading" in the header). Used only when the lexicon has
// the field, or by clarifyCues (with empty lists when it has not).
// ---------------------------------------------------------------------------------------

const WORD_CHAR = /[\p{L}\p{N}]/u;
const isWordChar = (ch) => typeof ch === "string" && ch !== "" && WORD_CHAR.test(ch);
const LINE_BREAK = /\r\n|\r|\n/g;
// "Label:" at a line start (a letter first; letters, digits, spaces and / & ( ) ' - after it), the
// ":" followed by whitespace or the line end.
const LABEL_LINE = /^[ \t]*([A-Za-z][A-Za-z0-9 \/&()'-]{0,40}?)[ \t]*:(?=\s|$)/;
const BULLET_LINE = /^[ \t]*(?:[-*•▪◦‣]|\d{1,2}[.)])[ \t]+\S/;
// A line opening with a plus sign ("+ night sweats"): a positive, never an item of a denied list (R3).
const PLUS_LINE = /^[ \t]*\+/;
// A plus sign standing before a word ("+photophobia", "+ night sweats"), not inside "(+)", after a
// letter or digit ("2+") or before "/" ("+/-"): it affirms the finding after it (R3).
const PLUS_SIGN = /(?<![\p{L}\p{N}(+])\+(?=[ \t]?[\p{L}])/gu;
// The end of the token before a "." (letters and inner dots: "assoc", "hx", "e.g"), for the
// abbreviation rule (R3).
const ABBREV_TOKEN = /[\p{L}](?:[\p{L}.]*[\p{L}])?$/u;
const ABBREV_MAX = 6;
// A label inside a line ("… Photophobia: yes"): whitespace after a non-space, a capitalised word and
// up to two more, then ":" before whitespace or the end (R3).
const INLINE_LABEL = /(?<=\S)[ \t]+[A-Z][A-Za-z0-9\/&()'-]*(?:[ \t][A-Za-z0-9\/&()'-]+){0,2}[ \t]*:(?=\s|$)/g;
const CAPS_LINE = /^[\p{Lu}\p{N}][\p{Lu}\p{N} \/&()'-]*$/u;
const HAS_UPPER = /\p{Lu}/u;
const HAS_LOWER = /\p{Ll}/u;
const STARTS_LOWER = /^\p{Ll}/u;
const CLAUSE_CLOSED = /[.!?;:]$/;
const WRAP_OPEN = /[,\/]$/;
// A word of a list path ("Negation" in the header): letters and digits, an inner apostrophe or hyphen
// joining two runs ("dix-hallpike", "doesn't").
const LIST_TOKEN = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
// What separates the items of a list: a comma, a semicolon or a slash, and the joining words below.
const LIST_SEPARATOR = /[,;\/]/;
const LIST_JOINERS = new Set(["and", "or"]);
// The section kind whose header is read normally ("read": history, assessment, plan …).
const READ_KIND = "read";

/** The phrases of a clauses list ({ph, source} rows; a bare string is read as its own phrase). */
const clausePhrases = (list) => arr(list).map((e) => (isObj(e) ? e.ph : e)).filter(isPhrase);
const isCaps = (s) => HAS_UPPER.test(s) && !HAS_LOWER.test(s);

/**
 * The clauses of `fold` ("Segmentation" in the header): [{start, end, kind, carry?}] ascending, each
 * trimmed of surrounding whitespace, kind a section kind of LEXICON_SECTION_KINDS other than "read",
 * or null; carry (when present) is the end offset of the denial on a list's header line that reaches
 * this clause ("Negation" c in the header). `sectionOf(s)` gives the section kind of a header word
 * (undefined for none); `breaks` are the clauses.breaks occurrences ({start}) in fold offsets;
 * `lists.opens(ls, le, header)` gives the end offset of the denial that a line opening a list holds,
 * or -1, `lists.item(ls, le)` whether a plain line may be an item of such a list, `lists.affirmIn(ls,
 * le)` whether a line holds an affirm cue (it ends the list, R3), and `lists.abbrev(k, from)` whether
 * the "." at k, in the clause starting at `from`, is an abbreviation's (it ends no clause, R3).
 */
function clauseSegments(fold, sectionOf, breaks, lists) {
  const lines = [];
  let pos = 0;
  for (const m of fold.matchAll(LINE_BREAK)) { lines.push([pos, m.index]); pos = m.index + m[0].length; }
  lines.push([pos, fold.length]);
  const segments = [];
  let block = null;
  let open = null;
  let carry = null;
  for (const [ls, le] of lines) {
    const raw = fold.slice(ls, le);
    const t = raw.trim();
    if (!t) { open = null; carry = null; continue; }
    const indent = raw.length - raw.trimStart().length;
    const end = ls + raw.trimEnd().length;
    const bare = t.endsWith(":") ? t.slice(0, -1).trimEnd() : t;
    const known = bare ? sectionOf(bare) : undefined;
    let header = false;
    let label = false;
    let split = -1;
    let kind = block;
    if (known !== undefined) { header = true; block = known === READ_KIND ? null : known; kind = block; }
    else if ((t.endsWith(":") && /^[A-Za-z]/.test(t) && !/[.!?;:]/.test(bare)) || (CAPS_LINE.test(t) && isCaps(t) && t.split(/\s+/).length <= 4)) {
      // A header naming no section: a sub-label inside an exam ("HEENT:", "Neuro:") keeps the exam;
      // anywhere else it ends the section kind.
      header = true;
      if (block !== "exam") block = null;
      kind = block;
    } else {
      const m = LABEL_LINE.exec(raw);
      if (m) {
        label = true;
        const k = sectionOf(m[1]);
        // A section word as an inline label: "read" ends the section kind; any other kind holds for
        // this line (and its wrapped continuation) only. Any other label reads in the section kind.
        if (k === READ_KIND) { block = null; kind = null; }
        else if (k !== undefined) { kind = k; split = ls + m[0].length; }
      }
    }
    const bullet = !header && !label && BULLET_LINE.test(raw);
    // A plain line that may be an item of a list under a denial header is its own item, never a wrapped
    // line (R3: "Patient denies:" over "fever" and "chills" reads two items).
    const itemLine = carry !== null && carry.colon && !header && !label && !bullet && lists.item(ls + indent, end);
    const wrap = !header && !label && !bullet && !itemLine && open !== null
      && (STARTS_LOWER.test(t) || indent > open.indent || WRAP_OPEN.test(open.last));
    // A list under a denying line ("Patient denies:", "Denies"): its items, the bullet or indented
    // lines below it and, under a header, plain lines that may be list items, until a blank line, a
    // header or another line. A line opening with "+" or holding an affirm cue ends it (R3: "+ night
    // sweats" is a positive), and once a bullet was read only bullets and deeper-indented lines
    // continue it (R3: "New nosebleed this week." after the bullets is not an item).
    if (carry !== null && !wrap) {
      const deeper = indent > carry.indent;
      const plain = !bullet && !deeper;
      if (header || PLUS_LINE.test(raw) || lists.affirmIn(ls + indent, end) || (plain && carry.bulleted)
        || !(bullet || deeper || (carry.colon && !label && lists.item(ls + indent, end)))) carry = null;
      else if (bullet) carry.bulleted = true;
    }
    if (wrap) {
      open.seg.end = end;
      open.indent = indent;
      open.last = t;
    } else {
      const seg = { start: ls + indent, end, kind, splits: split >= 0 ? [split] : [] };
      if (carry !== null) seg.carry = carry.end;
      segments.push(seg);
      open = header ? null : { seg, indent, last: t };
      const opens = wrap || label ? -1 : lists.opens(ls + indent, end, header);
      if (opens !== -1) carry = { end: opens, colon: header, indent };
    }
    if (open !== null && CLAUSE_CLOSED.test(t)) open = null;
  }
  const clauses = [];
  const add = (a, b, k, carried) => {
    while (a < b && /\s/.test(fold[a])) a++;
    while (b > a && /\s/.test(fold[b - 1])) b--;
    if (b > a) clauses.push(carried === undefined ? { start: a, end: b, kind: k } : { start: a, end: b, kind: k, carry: carried });
  };
  for (const seg of segments) {
    const cuts = new Set(seg.splits);
    // A sentence end cuts the clause, except a "?" opening one (chart shorthand "? aura" queries the
    // words after it, so it belongs to them: a hedge of that clause), and except the "." of a chart
    // abbreviation (R3: "No assoc. nausea.", "Denies hx. of aura.", "e.g.": lists.abbrev).
    let last = seg.start;
    for (const m of fold.slice(seg.start, seg.end).matchAll(SENTENCE_END)) {
      const k = seg.start + m.index;
      if (m[0] === "?" && !/[\p{L}\p{N}]/u.test(fold.slice(last, k))) continue;
      if (m[0] === "." && lists.abbrev(k, last)) continue;
      cuts.add(k + 1);
      last = k + 1;
    }
    // A second "Label:" on a line of labels starts a clause of its own (R3: "Nausea: no Photophobia: yes"
    // is two answers).
    const s = fold.slice(seg.start, seg.end);
    for (const m of s.matchAll(INLINE_LABEL)) if (s.slice(0, m.index).includes(":")) cuts.add(seg.start + m.index);
    for (const o of breaks) cuts.add(o.start);
    const at = [...cuts].filter((k) => k > seg.start && k < seg.end).sort((x, y) => x - y);
    let a = seg.start;
    for (const k of [...at, seg.end]) { add(a, k, seg.kind, seg.carry); a = k; }
  }
  return clauses;
}

/**
 * The chart reader of one utterance: clause lookup, phrase hits, the negation predicate and the
 * gates of "Chart reading" in the header. `cl` is lexicon.clauses (or {} for clarifyCues on a
 * lexicon without it, which then reads with the structural segmentation and the clipped window
 * only); `win` the negation window; `chart` true for typed chart text (opts.chart), where the
 * clauses.chartIgnoreThirdParty cues do not gate when a finding follows them; false for a spoken line,
 * where reply words lower no red flag ("Spoken lines" in the header).
 */
function chartReader(lexicon, text, view, cl, win, chart) {
  const { fold, at } = view;
  // Phrases and cues are matched with every whitespace character read as a space (same length, so
  // offsets hold): a wrapped line ("no" at a line end, the next word below) reads as one line.
  const flow = view.flow.replace(/\s/g, " ");
  const low = view.low.replace(/\s/g, " ");
  const ws = cl.wordStart === true;
  const NEGATION = cueSpec(lexicon.negation);
  const THIRD_PARTY = cueSpec(lexicon.thirdParty);
  const HISTORICAL = cueSpec(lexicon.historical);
  // Every occurrence of every phrase in `hay` (a lowercase view), at a word start under wordStart;
  // with `whole` (the clauses cue lists) also at a word end, wordStart or not ("Matching" in the
  // header). A side whose end character is not a letter or a digit is unbounded.
  const spans = (phrases, hay, whole = false) => {
    const out = [];
    for (const p of arr(phrases)) {
      if (!isPhrase(p)) continue;
      for (const k of occurrences(hay, p)) {
        if ((ws || whole) && isWordChar(p[0]) && k > 0 && isWordChar(hay[k - 1])) continue;
        if (whole && isWordChar(p[p.length - 1]) && isWordChar(hay[k + p.length])) continue;
        out.push({ start: k, end: k + p.length, phrase: p });
      }
    }
    return out.sort((x, y) => x.start - y.start);
  };
  /** The occurrences of a clauses cue list, as whole words. */
  const cues = (list) => spans(clausePhrases(list), flow, true);
  const masks = [];
  for (const p of clausePhrases(cl.mask)) for (const k of occurrences(flow, p)) masks.push({ start: k, end: k + p.length });
  const masked = (a, b) => masks.some((m) => m.start <= a && b <= m.end);
  /** Phrase hits on the folded text: [{start, end, phrase}] in text order, masked hits dropped. */
  const hits = (phrases) => spans(phrases, flow).filter((h) => !masked(h.start, h.end));
  /** Phrase hits on the folded text with no mask applied (clarification triggers and qualifiers, R2). */
  const rawHits = (phrases) => spans(phrases, flow);
  // Red flags (R2): each flag's phrases are the lexicon's followed by its clauses.redFlags phrases
  // (chart-register wording); a flag listed in clauses.redFlags alone comes after the lexicon's flags.
  const chartFlags = isObj(cl.redFlags) ? cl.redFlags : {};
  const flagLists = [];
  const lexFlags = isObj(lexicon.redFlags) ? lexicon.redFlags : {};
  for (const [id, ph] of Object.entries(lexFlags)) {
    flagLists.push([id, [...arr(ph), ...(Object.prototype.hasOwnProperty.call(chartFlags, id) ? clausePhrases(chartFlags[id]) : [])]]);
  }
  for (const [id, rows] of Object.entries(chartFlags)) {
    if (!Object.prototype.hasOwnProperty.call(lexFlags, id)) flagLists.push([id, clausePhrases(rows)]);
  }
  /** The hits of one flag's phrases, a hit lying strictly inside a longer hit of the flag dropped. */
  const flagHits = (phrases) => {
    const hs = hits(phrases);
    return hs.filter((x) => !hs.some((y) => y.start <= x.start && x.end <= y.end && y.end - y.start > x.end - x.start));
  };
  /** Phrase hits on the band-matching text (low offsets), masked hits dropped (mapped to fold). */
  const lowHits = (phrases) => spans(phrases, low).filter((h) => !masked(at(h.start), at(h.end)));
  /** The end of the word holding offset k - 1 (k itself when k starts no word). */
  const wordEnd = (k) => { while (k < flow.length && isWordChar(flow[k])) k++; return k; };
  // The findings named in the text: every topic phrase hit (yes/no, context and multi-answer phrases,
  // red-flag phrases, scale cues, clarification triggers), each spanning to the end of its word
  // ("photophob" → "photophobia").
  const topicList = [];
  for (const e of arr(lexicon.clarify)) if (isObj(e)) topicList.push(...arr(e.ph));
  for (const e of arr(lexicon.bool)) if (isObj(e)) topicList.push(...arr(e.ph));
  for (const e of arr(lexicon.ctx)) if (isObj(e)) topicList.push(...arr(e.ph));
  for (const e of arr(lexicon.multi)) if (isObj(e)) topicList.push(...arr(e.ph));
  for (const [, ph] of flagLists) topicList.push(...ph);
  for (const e of arr(lexicon.scale)) if (isObj(e)) topicList.push(...arr(e.cue));
  const findings = hits(topicList).map((h) => ({ start: h.start, end: wordEnd(h.end) }));
  const findingAt = (a, b) => findings.some((f) => f.start < b && a < f.end);
  // A negation cue holding another negation cue at its end reaches as far back as that cue would:
  // under wordStart "n't" no longer reads inside "didn't", so "didn't" is measured from its "n't"
  // and the window keeps its 0.3.2 reach ("I didn't have any nausea."). eff is that measured start.
  const negList = arr(NEGATION.cues).filter(isPhrase);
  // The affirm cues, and every plus sign before a word ("+photophobia", "+ night sweats"), which
  // affirms the finding after it like an affirm cue (R3).
  const affirm = [...cues(cl.affirm), ...[...flow.matchAll(PLUS_SIGN)].map((m) => ({ start: m.index, end: m.index + 1, phrase: "+" }))]
    .sort((x, y) => x.start - y.start);
  const hedge = cues(cl.hedge);
  // Shielded cues (R2): a negation, deny, post or prefix cue lying inside a longer affirm or hedge cue
  // is no cue ("no relief" holds "no ", "not sure" holds "not ").
  const shields = [...affirm, ...hedge];
  const unshielded = (o) => !shields.some((x) => x.start <= o.start && o.end <= x.end && x.end - x.start > o.end - o.start);
  const negCues = spans(NEGATION.cues, flow).filter(unshielded).map((o) => {
    let eff = o.start;
    for (const sfx of negList) if (sfx.length < o.phrase.length && o.phrase.endsWith(sfx)) eff = Math.max(eff, o.end - sfx.length);
    return { ...o, eff };
  });
  // Typed chart text: a lexicon attribution cue named in clauses.chartIgnoreThirdParty (a pronoun)
  // does not gate when a finding follows it ("Her tinnitus is bilateral."): in a chart note it names
  // the patient. Followed by anything else ("Her husband has tinnitus.") it gates as in speech.
  const ignoreTp = new Set(chart === true ? clausePhrases(cl.chartIgnoreThirdParty) : []);
  const findingStarts = new Set(findings.map((f) => f.start));
  const namesPatient = (o) => { let k = o.end; while (flow[k] === " ") k++; return findingStarts.has(k); };
  const tpCues = [...spans(arr(THIRD_PARTY.cues), flow).filter((o) => !(ignoreTp.has(o.phrase) && namesPatient(o))), ...cues(cl.thirdParty)]
    .sort((x, y) => x.start - y.start);
  const histCues = spans(HISTORICAL.cues, flow);
  const deny = cues(cl.deny).filter(unshielded);
  const post = cues(cl.post).filter(unshielded);
  const prefix = cues(cl.prefix).filter(unshielded);
  const placeholder = cues(cl.placeholder);
  const scopeEnds = cues(cl.scopeEnd);
  const complements = cues(cl.complement);
  const sectionWords = new Map();
  const sec = isObj(cl.sections) ? cl.sections : {};
  for (const kind of LEXICON_SECTION_KINDS) {
    for (const w of clausePhrases(sec[kind])) {
      const key = w.toLowerCase().replace(/\s+/g, " ").trim();
      if (key && !sectionWords.has(key)) sectionWords.set(key, kind);
    }
  }
  const sectionOf = (s) => sectionWords.get(s.toLowerCase().replace(/\s+/g, " ").trim());
  // A "/" separates list items when a space or a finding touches it ("nausea/vomiting", "fever/chills");
  // between two other words it joins them inside one item (R3: "visual/auditory auras", "h/o").
  const slashSeparates = (k) => flow[k - 1] === " " || flow[k + 1] === " " || findings.some((f) => f.end === k || f.start === k + 1);
  /** The words and separators of flow in [a, b), in order: {sep} or {tok, finding, ends, comp}. */
  const units = (a, b) => {
    const out = [];
    if (b <= a) return out;
    const s = flow.slice(a, b);
    let last = 0;
    const seps = (from, to) => { for (let k = from; k < to; k++) if (LIST_SEPARATOR.test(s[k]) && (s[k] !== "/" || slashSeparates(a + k))) out.push({ sep: true }); };
    for (const m of s.matchAll(LIST_TOKEN)) {
      seps(last, m.index);
      const t0 = a + m.index;
      const t1 = t0 + m[0].length;
      if (LIST_JOINERS.has(m[0])) out.push({ sep: true });
      else {
        const finding = findingAt(t0, t1);
        out.push({ tok: m[0], finding, ends: !finding && scopeEnds.some((o) => o.start < t1 && t0 < o.end),
          comp: !finding && complements.some((o) => o.start < t1 && t0 < o.end) });
      }
      last = m.index + m[0].length;
    }
    seps(last, s.length);
    return out;
  };
  // A line that opens a list under a denial ("Patient denies:", "Negative for:", a bare "Denies"):
  // it holds a clauses.deny cue with no affirm cue after it and no finding, and is a header or ends
  // with that cue. Its items are the lines below it (clauseSegments).
  const lists = {
    opens: (a, b, header) => {
      let d = null;
      for (const o of deny) if (o.start >= a && o.end <= b) d = o;
      if (d === null || affirm.some((o) => o.start > d.start && o.end <= b) || findingAt(a, b)) return -1;
      return header || !/\S/.test(flow.slice(d.end, b).replace(/:\s*$/, "")) ? d.end : -1;
    },
    item: (a, b) => {
      const u = units(a, b);
      return u.filter((x) => x.tok).length <= 4 && !u.some((x) => x.ends)
        && !affirm.some((o) => o.start >= a && o.end <= b) && !deny.some((o) => o.start >= a && o.end <= b);
    },
    affirmIn: (a, b) => affirm.some((o) => o.start >= a && o.end <= b),
    // A "." at k that ends no clause (R3): whitespace and a lower-case letter follow it, the clause it
    // would end (from `from`) opens with a capital (a writer who capitalises sentences) and names no
    // finding before it, and the token before it is no finding and is short (at most ABBREV_MAX
    // letters) or dotted ("assoc", "hx", "pt", "e.g"): an abbreviation inside the sentence, not its end.
    abbrev: (k, from) => {
      let j = k + 1;
      while (j < fold.length && /\s/.test(fold[j])) j++;
      if (j >= fold.length || !STARTS_LOWER.test(fold[j])) return false;
      const lead = /\p{L}/u.exec(fold.slice(from, k));
      if (lead === null || !HAS_UPPER.test(lead[0])) return false;
      const m = ABBREV_TOKEN.exec(fold.slice(Math.max(from, k - 16), k));
      if (m === null || !(m[0].includes(".") || m[0].length <= ABBREV_MAX)) return false;
      return !findingAt(from, k);
    },
  };
  const clauses = clauseSegments(fold, sectionOf, cues(cl.breaks), lists);
  const inside = (o, c) => o.start >= c.start && o.end <= c.end;
  for (const c of clauses) {
    c.placeholder = placeholder.some((o) => inside(o, c));
    c.hedged = hedge.some((o) => inside(o, c));
  }
  const WHOLE = { start: 0, end: fold.length, kind: null, placeholder: false, hedged: false };
  /** The clause holding offset k (the last clause starting at or before it). */
  const clauseAt = (k) => {
    let lo = 0;
    let hi = clauses.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (clauses[mid].start <= k) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found === -1 ? (clauses[0] || WHOLE) : clauses[found];
  };
  // Reply words (spoken lines, the clinical lead's decision D9 of 2026-10-12): a clauses.deny cue that
  // opens its clause and is followed by a word starting no finding, with no list separator ("," ";" "/",
  // "and", "or") before the next finding, answers the clinician's question ("no it's more of a whooshing
  // with my heartbeat": a speech transcript has no comma after the "no"), so it lowers no red flag,
  // neither as a list denial nor as a window cue (a negation cue lying inside it). A list of negatives
  // ("No fever, chills, double vision.") is no reply. A reply word still denies the yes/no, context,
  // scale and multi-answer entries as any deny cue does. Typed chart text has none (D1: its four
  // conditions stand).
  const replyWords = chart === true ? [] : deny.filter((o) => {
    const c = clauseAt(o.start);
    if (/\S/.test(flow.slice(c.start, o.start))) return false;
    let k = o.end;
    while (k < c.end && flow[k] === " ") k++;
    if (!(k < c.end && isWordChar(flow[k]) && !findingStarts.has(k))) return false;
    const next = findings.filter((f) => f.start >= k && f.start < c.end).reduce((m, f) => Math.min(m, f.start), c.end);
    return !units(k, next).some((x) => x.sep);
  });
  const inReply = (o) => replyWords.some((r) => r.start <= o.start && o.end <= r.end);
  // The start of the last cue of `list` lying wholly within [from, to), or -1.
  const lastWithin = (list, from, to) => {
    let best = -1;
    for (const o of list) if (o.start >= from && o.end <= to && o.start > best) best = o.start;
    return best;
  };
  /** The last cue of `list` lying wholly within [from, to), or null. */
  const lastCue = (list, from, to) => {
    let best = null;
    for (const o of list) if (o.start >= from && o.end <= to && (best === null || o.start > best.start)) best = o;
    return best;
  };
  const affirmedAfter = (from, to) => affirm.some((o) => o.start > from && o.end <= to);
  /** A cue o closes its item: the clause end, punctuation, or a joining "and" / "or" follows it. */
  const closing = (o, c) => {
    let k = o.end;
    while (k < c.end && flow[k] === " ") k++;
    return k >= c.end || ",;.!?)".includes(flow[k]) || /^(?:and|or)(?![\p{L}\p{N}])/u.test(flow.slice(k, k + 4));
  };
  // The list item of a hit (R3): from just after the last "," ";" "/" (slashSeparates) or joining "and" /
  // "or" before it in its clause, to just before the first one after it (or the clause's ends).
  const ITEM_BREAK = /[,;\/]|(?<![\p{L}\p{N}])(?:and|or)(?![\p{L}\p{N}])/gu;
  const itemStart = (i, c) => {
    let s = c.start;
    for (const m of flow.slice(c.start, i).matchAll(ITEM_BREAK)) {
      if (m[0] !== "/" || slashSeparates(c.start + m.index)) s = c.start + m.index + m[0].length;
    }
    return s;
  };
  const itemEnd = (k, c) => {
    for (const m of flow.slice(k, c.end).matchAll(ITEM_BREAK)) if (m[0] !== "/" || slashSeparates(k + m.index)) return k + m.index;
    return c.end;
  };
  // Label answers (R2, R3): a cue right after a finding (only whitespace and at most one ":" or "-"
  // between; whitespace alone only before a sign cue, one starting with no letter or digit, such as
  // "(+)") that closes the item (closing: R3, so "No nausea - reports good appetite." and "Headache:
  // denies nausea, …" are no label answers, and "(+) nausea (-) photophobia" reads each sign as the
  // prefix of the finding after it).
  const LABEL_GAP = /^\s*[:\-–]\s*$/;
  const sign = (o) => !isWordChar(o.phrase[0]);
  const gapAnswers = (gap, o) => LABEL_GAP.test(gap) || (sign(o) && /^\s*$/.test(gap));
  /** The cue of `list` answering, as a label, the finding at h in clause c: findings right after it skipped. */
  const labelAnswer = (list, h, c) => {
    let k = wordEnd(h.end);
    for (;;) {
      let j = k;
      while (j < c.end && flow[j] === " ") j++;
      const f = findings.find((x) => x.start === j && x.end > j);
      if (!f) break;
      k = f.end;
    }
    return list.some((o) => o.start >= k && o.end <= c.end && gapAnswers(flow.slice(k, o.start), o) && closing(o, c));
  };
  /** Whether the deny cue d answers the finding just before it as a label (then it opens no list). */
  const answersLabel = (d, c) => {
    let f = null;
    for (const x of findings) if (x.start >= c.start && x.end <= d.start && (f === null || x.end > f.end)) f = x;
    return f !== null && gapAnswers(flow.slice(f.end, d.start), d) && closing(d, c);
  };
  /**
   * A denial inside the hit's own list item governs it (R3): a prefix ending at i, or a negation or
   * deny cue (not a label answer) before it in its item with no affirm cue between. A label answer
   * never overrides it ("Non-pulsatile tinnitus: yes." and "No photophobia: yes" are the label as
   * written).
   */
  const deniedInItem = (i, c) => {
    if (prefix.some((o) => o.end === i && o.start >= c.start)) return true;
    const a = itemStart(i, c);
    return negCues.some((o) => o.start >= a && o.end <= i && !affirmedAfter(o.start, i))
      || deny.some((o) => o.start >= a && o.end <= i && !answersLabel(o, c) && !affirmedAfter(o.start, i));
  };
  /** The other words (not findings) in the list item of the hit h in clause c, before and after it. */
  const itemWords = (h, c) => units(itemStart(h.start, c), h.start).filter((x) => x.tok && !x.finding).length
    + units(wordEnd(h.end), itemEnd(wordEnd(h.end), c)).filter((x) => x.tok && !x.finding).length;
  /** The window cues (negation, before the hit at i in clause c): measured from eff, clipped to the clause. */
  const windowCues = (i, c) => {
    const from = Math.max(c.start, i - win);
    return negCues.filter((o) => o.start >= c.start && o.eff >= from && o.end <= i);
  };
  /**
   * How a denial ending at `from` reaches the hit h in clause c (rule c): the list path between them.
   *   later           the hit lies in a later list item than the denial (a separator between them)
   *   broken          a clauses.scopeEnd or clauses.complement word lies between them, or, for a later
   *                   item, a scopeEnd word after the hit in its own item: the denial does not reach it
   *                   ("No interpreter available, so nausea …", "No change in hearing, tinnitus is
   *                   pulsatile.", R3: "No workup for pulsatile tinnitus.")
   *   findingBefore   a finding lies before the hit in the hit's own item
   *   before, after   the other words before and after the hit in its own item
   */
  const reach = (from, h, c) => {
    const u = units(from, h.start);
    const firstSep = u.findIndex((x) => x.sep);
    let lastSep = -1;
    u.forEach((x, k) => { if (x.sep) lastSep = k; });
    const later = firstSep !== -1;
    const own = later ? u.slice(lastSep + 1) : u;
    let after = 0;
    let endsAfter = false;
    for (const x of units(wordEnd(h.end), c.end)) {
      if (x.sep) break;
      if (x.finding) continue;
      after++;
      if (x.ends) endsAfter = true;
    }
    return { later, broken: u.some((x) => x.ends || x.comp) || (later && endsAfter),
      findingBefore: own.some((x) => x.finding), before: own.filter((x) => !x.finding).length, after };
  };
  /**
   * The denial whose list may reach a hit at i in clause c: {from, affirmFrom, carried} or null (rule
   * c); carried: the denial heads the clause's list from a line above it.
   */
  const scopeOf = (i, c, skip = null) => {
    const d = lastCue(deny.filter((x) => !answersLabel(x, c) && !(skip && skip(x))), c.start, i);
    if (d !== null) return { from: d.end, affirmFrom: d.start, carried: false };
    return c.carry !== undefined ? { from: c.start, affirmFrom: c.start - 1, carried: true } : null;
  };
  /** An affirm cue governs the hit at i directly: before it in clause c, no separator, joiner or denial between. */
  const affirmedDirectly = (i, c) => affirm.some((o) => o.start >= c.start && o.end <= i
    && !units(o.end, i).some((x) => x.sep) && !deny.some((d) => d.start >= o.end && d.end <= i)
    && !negCues.some((d) => d.start >= o.end && d.end <= i));
  /**
   * The negation rule that applies to a hit at [i, i + len) ("Negation" in the header): "window" |
   * "prefix" | "scope" | "post" | "uncertain" (a denial earlier in the clause that does not reach the
   * hit, or reaches a later list item that holds more than the finding: the mention is set aside,
   * neither affirmed nor denied) | false.
   */
  const neg = (i, len) => {
    const c = clauseAt(i);
    const h = { start: i, end: i + Math.max(0, len) };
    // A label answered by an affirm cue ("Photophobia: endorses", "Aura (+)") is affirmed (R2), unless a
    // denial in its own item governs it (R3).
    if (labelAnswer(affirm, h, c) && !deniedInItem(i, c)) return false;
    // A window cue with a scopeEnd word between it and the hit does not reach it ("No interpreter, so
    // nausea …"): the scope rule below decides.
    const n = windowCues(i, c).filter((o) => !units(o.end, i).some((x) => x.ends)).reduce((b, o) => Math.max(b, o.start), -1);
    // A window cue in an earlier list item reaches a later item only when that item is the finding
    // alone, as a list denial does (R3: "No nausea, tinnitus reported." sets the tinnitus aside).
    if (n !== -1 && !affirmedAfter(n, i)) return n < itemStart(i, c) && itemWords(h, c) > 0 ? "uncertain" : "window";
    if (prefix.some((o) => o.end === i && o.start >= c.start)) return "prefix";
    const s = scopeOf(i, c);
    if (s !== null && !affirmedAfter(s.affirmFrom, i)) {
      const r = reach(s.from, h, c);
      if (r.broken) return "uncertain";
      // A later item of the list, or an item of a list carried from a line above, is denied only when it
      // is the finding alone (R3: "No nausea, tinnitus reported." and "No dizziness, tinnitus in the
      // right ear only." set the tinnitus aside).
      if ((r.later || s.carried) && (r.before > 0 || r.after > 0)) return "uncertain";
      return "scope";
    }
    if (affirmedDirectly(i, c)) return false;
    for (const o of post) {
      if (o.start < h.end || o.end > c.end || !closing(o, c)) continue;
      const u = units(Math.min(wordEnd(h.end), o.start), o.start);
      // Next to the hit (a ":" or nothing between), a list closed by the cue ("Nausea, photophobia:
      // negative."), or one qualifying word ("Positional testing negative."). An affirm cue later in
      // the clause naming no finding of its own takes it back ("Pulsatile tinnitus previously denied,
      // now endorsed."): the mention is set aside. One answering another finding as a label ("Gamma
      // sign (-), kappa sign (+).") takes nothing back (R2).
      if (u.every((x) => x.sep || x.finding) || (u.length === 1 && !u[0].finding)) {
        return affirm.some((a) => a.start >= o.end && a.end <= c.end && !findingAt(a.end, c.end) && !answersLabel(a, c)) ? "uncertain" : "post";
      }
    }
    return false;
  };
  /**
   * Whether a red-flag hit h is denied ("Red flags" in the header): only by a denial that governs the
   * flag phrase directly. A prefix; in the flag's own list item, a window cue or a clauses.deny cue
   * before it with nothing but plain words between (no finding, ":", affirm cue, plus sign, scopeEnd or
   * complement word: R3, "No steroids given for sudden hearing loss." raises); a deny cue heading the
   * list when the flag's later item (or carried item) is the bare flag phrase (R3: no other word and no
   * affirm cue or plus sign in its item, so "No nausea, double vision reported." raises); or a closing
   * post cue right after it (only findings between, no affirm cue before it in its item). Anything
   * else, a label answer included, never lowers a flag.
   */
  const flagDenied = (h) => {
    const c = clauseAt(h.start);
    const i = h.start;
    if (prefix.some((o) => o.end === i && o.start >= c.start)) return true;
    const a = itemStart(i, c);
    const e = itemEnd(wordEnd(h.end), c);
    for (const o of windowCues(i, c)) {
      if (o.start < a || flow.slice(o.end, i).includes(":") || inReply(o)) continue;
      if (!units(o.end, i).some((x) => x.sep || x.finding || x.ends || x.comp) && !affirmedAfter(o.start, i)) return true;
    }
    const s = scopeOf(i, c, inReply);
    if (s !== null && !affirmedAfter(s.affirmFrom, i)) {
      const r = reach(s.from, h, c);
      if (!r.broken && !r.findingBefore) {
        if (!r.later && !s.carried) return true;
        if (r.before === 0 && r.after === 0 && !affirm.some((o) => o.start >= a && o.end <= e)) return true;
      }
    }
    for (const o of post) {
      if (o.start < h.end || o.end > c.end || !closing(o, c)) continue;
      const b = Math.min(wordEnd(h.end), o.start);
      if (units(b, o.start).every((x) => x.finding) && !affirm.some((x) => x.start >= a && x.end <= i)) return true;
    }
    return false;
  };
  const tpNear = (i) => { const c = clauseAt(i); return lastWithin(tpCues, Math.max(c.start, i - THIRD_PARTY.window), i) !== -1; };
  const histNear = (i) => { const c = clauseAt(i); return lastWithin(histCues, Math.max(c.start, i - HISTORICAL.window), i) !== -1; };
  const examItems = new Set(arr(cl.examItems));
  /** The gate that suppresses a capture of `id` at i: "third-party" | "historical" | "section" | null. */
  const gateOf = (i, exempt, id) => {
    const thirdParty = !!(exempt && exempt.thirdParty);
    if (!thirdParty && tpNear(i)) return "third-party";
    if (histNear(i)) return "historical";
    const kind = clauseAt(i).kind;
    if (kind === "family" && !thirdParty) return "third-party";
    if (kind === "skip") return "section";
    if (kind === "exam" && !examItems.has(id)) return "section";
    return null;
  };
  /** The gate of a clarification trigger: as gateOf, except that an exam section never gates one. */
  const triggerGate = (i) => {
    if (tpNear(i)) return "third-party";
    if (histNear(i)) return "historical";
    const kind = clauseAt(i).kind;
    return kind === "family" ? "third-party" : kind === "skip" ? "section" : null;
  };
  /**
   * The mention of `phrases` an entry captures at: the first, in text order, outside placeholder
   * clauses that is ungated and neither hedged nor negated (nor set aside as uncertain); else the
   * first that is gated and not negated. {hit, gated, hedged}: hedged is the first ungated mention in
   * a hedged clause.
   */
  const pick = (phrases, exempt, id) => {
    let gatedHit = null;
    let hedgedHit = null;
    for (const h of hits(phrases)) {
      const c = clauseAt(h.start);
      if (c.placeholder) continue;
      if (gateOf(h.start, exempt, id) !== null) {
        if (gatedHit === null && !neg(h.start, h.end - h.start)) gatedHit = h;
        continue;
      }
      if (c.hedged) { if (hedgedHit === null) hedgedHit = h; continue; }
      if (neg(h.start, h.end - h.start)) continue;
      return { hit: h, gated: false, hedged: hedgedHit };
    }
    return { hit: gatedHit, gated: gatedHit !== null, hedged: hedgedHit };
  };
  /** The band spans of scale entry `e` (bandSpans) at word starts, masked spans dropped. */
  const bands = (e) => bandSpans(e, low).filter((x) => !(ws && isWordChar(x.phrase[0]) && x.start > 0 && isWordChar(low[x.start - 1]))
    && !masked(at(x.start), at(x.end)));
  /** `o` with its evidence replaced by the text of the clause at i and clause: {start, end} added last. */
  const withClause = (o, i) => {
    const c = clauseAt(i);
    return { ...o, evidence: text.slice(c.start, c.end), clause: { start: c.start, end: c.end } };
  };
  return {
    clauses, clauseAt, hits, rawHits, lowHits, bands, neg, flagDenied, flagLists, flagHits, gateOf, triggerGate, tpNear, histNear, pick, withClause,
    placeholderHit: () => placeholder[0] || null,
    redFlagNegation: cl.redFlagNegation === true,
    strictConflict: new Set(arr(cl.strictConflict).filter((id) => typeof id === "string")),
  };
}

/**
 * One utterance: {captures, unresolved, withheld, yielded, view}. `extract` returns the captures;
 * the rest serve extractInContext.
 *   unresolved  [{id, cueIndex, cue, cueText}]: every scale entry, whatever its heard flag, whose
 *               cue opened, that did not yield, took no band value, has no fallback and passed the
 *               attribution and history gates; for a heard entry, only when the utterance also
 *               holds none of its band spans
 *   withheld    [{id, cueIndex, cue, cueText}]: the heard entries that meet every other condition of
 *               `unresolved` but had band spans that gave no value (negated, a carryRefuse phrase,
 *               or two values): the entry is heard only and may arm a yield-only slot, never a
 *               normal one
 *   yielded     ids of the scale entries that yielded
 *   chart       null without lexicon.clauses; else {reader, hedged, conflicts}: the chart reader,
 *               the items mentioned only in hedged clauses ([{id, hit}]) and the yes/no items in
 *               conflict ([{id, yes, no}], "Mentions" in the header: the first affirmed mention that
 *               has a denied mention of the same finding, and the first such denied mention; for a
 *               clauses.strictConflict item, the first affirmed and the first denied mention)
 * opts.chart true reads typed chart text ("Spoken lines" in the header says what differs without it).
 */
function scan(lexicon, text, opts) {
  const NEGATION = cueSpec(lexicon.negation);
  const THIRD_PARTY = cueSpec(lexicon.thirdParty);
  const HISTORICAL = cueSpec(lexicon.historical);
  const negatedNear = (t, idx, window = NEGATION.window) => cueBefore(t, idx, { window, cues: NEGATION.cues });
  const thirdPartyNear = (t, idx) => cueBefore(t, idx, THIRD_PARTY);
  const historicalNear = (t, idx) => cueBefore(t, idx, HISTORICAL);

  // Chart reading applies to every line under lexicon.clauses (the clinical lead's decision D9 of
  // 2026-10-12: typed chart text, spoken and demo lines alike); opts.chart marks typed chart text, where
  // the chartIgnoreThirdParty pronouns name the patient and no context marker is captured (D8), and a
  // spoken line keeps the reply-word rule, its heard band choice and its yields ("Spoken lines" in the
  // header).
  const chartMode = isObj(lexicon.clauses);
  const typed = opts.chart === true;
  const view = textView(lexicon, text, chartMode);
  const { fold, flow, norm, low, at } = view;
  const win = opts.negationWindow ?? NEGATION.window;
  const keep = !!opts.includeSuppressed;
  const heardOn = opts.includeHeard === true;
  const pendingIds = new Set(arr(opts.pendingIds));
  const found = [];
  const unresolved = [];
  const withheld = [];
  const yielded = [];
  const push = (o) => found.push(o);
  // Chart reading (lexicon.clauses): R is null without the field, and then every family below runs
  // exactly as the baseline's (each `R ?` branch falls through to the original expression).
  const R = chartMode ? chartReader(lexicon, text, view, lexicon.clauses, win, typed) : null;
  // A spoken line under chart reading keeps release 0.4.6's heard band choice and yields (D9: carry-over
  // exactly as before); typed chart text takes them from the cue's clause (RB, below).
  const RB = R && typed ? R : null;
  const hedged = [];
  const conflicts = [];
  const ev = (o, i) => (R ? R.withClause(o, i) : o);
  // The attribution or history cue that suppresses a capture at `i`, or null. An entry marked
  // thirdPartyExempt is inherently about someone else (a family history), so an attribution cue
  // is the finding rather than a misattribution of it. Under chart reading the section gates
  // follow (`id` decides the exam exemption).
  const plainGate = (i, exempt) => (!exempt.thirdParty && thirdPartyNear(fold, i) ? "third-party" : historicalNear(fold, i) ? "historical" : null);
  const gateOf = (i, exempt, id) => (R ? R.gateOf(i, exempt, id) : plainGate(i, exempt));
  const gated = (id, kind, i, value, exempt = {}) => {
    const g = gateOf(i, exempt, id);
    if (g !== null) { if (keep) push(ev({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: g }, i)); return; }
    push(ev({ id, value, kind, evidence: text, cueIndex: i }, i));
  };
  // A yes/no entry under chart reading ("Mentions" in the header): every mention in text order; a
  // mention in a placeholder clause, a gated one, one in a hedged clause and an attribute-negated
  // one (prefix) are set aside; affirmed only → "yes", denied only → "no". Both: a conflict when one
  // finding is said both ways (the same phrase, or overlapping spans of two of the entry's phrases),
  // or, for a clauses.strictConflict item, whenever both occur; otherwise the affirmed mention wins.
  const sameFinding = (a, b) => a.phrase === b.phrase || (a.start < b.end && b.start < a.end);
  const conflictOf = (id, yes, no) => {
    if (!yes.length || !no.length) return null;
    if (R.strictConflict.has(id)) return { yes: yes[0], no: no[0] };
    for (const y of yes) { const n = no.find((x) => sameFinding(y, x)); if (n) return { yes: y, no: n }; }
    return null;
  };
  const chartBool = (ex) => {
    const exempt = { thirdParty: !!ex.thirdPartyExempt };
    const yes = [];
    const no = [];
    let gatedOne = null;
    let hedgedOne = null;
    let aside = null;
    for (const h of R.hits(arr(ex.ph))) {
      const c = R.clauseAt(h.start);
      if (c.placeholder) { if (aside === null) aside = [h, "placeholder"]; continue; }
      const g = R.gateOf(h.start, exempt, ex.id);
      const n = R.neg(h.start, h.end - h.start);
      if (g !== null) { if (gatedOne === null && n !== "prefix" && n !== "uncertain") gatedOne = [h, g, n]; continue; }
      if (c.hedged) { if (hedgedOne === null) hedgedOne = h; if (aside === null) aside = [h, "hedge"]; continue; }
      if (n === "prefix") { if (aside === null) aside = [h, "attribute"]; continue; }
      if (n === "uncertain") { if (aside === null) aside = [h, "scope"]; continue; }
      (n ? no : yes).push(h);
    }
    const cf = conflictOf(ex.id, yes, no);
    if (cf !== null) {
      conflicts.push({ id: ex.id, yes: cf.yes, no: cf.no });
      if (keep) push(ev({ id: ex.id, value: "yes", kind: "item", evidence: text, cueIndex: cf.yes.start, suppressedBy: "conflict" }, cf.yes.start));
      return;
    }
    if (yes.length || no.length) {
      const h = yes.length ? yes[0] : no[0];
      push(ev({ id: ex.id, value: yes.length ? "yes" : "no", kind: "item", evidence: text, cueIndex: h.start }, h.start));
      return;
    }
    if (hedgedOne !== null) hedged.push({ id: ex.id, hit: hedgedOne });
    if (!keep) return;
    if (gatedOne !== null) {
      const [h, g, n] = gatedOne;
      push(ev({ id: ex.id, value: n ? "no" : "yes", kind: "item", evidence: text, cueIndex: h.start, suppressedBy: g }, h.start));
    } else if (aside !== null) {
      push(ev({ id: ex.id, value: "yes", kind: "item", evidence: text, cueIndex: aside[0].start, suppressedBy: aside[1] }, aside[0].start));
    }
  };
  // yieldTo: an entry with that id is present when any of its scale cues or bool phrases occurs
  // (whatever the negation or attribution), or when the id is pending.
  const present = (id) => pendingIds.has(id)
    || arr(lexicon.scale).some(e => isObj(e) && e.id === id && arr(e.cue).some(p => isPhrase(p) && flow.includes(p)))
    || arr(lexicon.bool).some(e => isObj(e) && e.id === id && arr(e.ph).some(p => isPhrase(p) && flow.includes(p)));
  const yieldTarget = (ex) => {
    const ys = arr(ex.yieldTo);
    if (!ys.length) return null;
    const target = ys.find(id => present(id));
    if (target === undefined) return null;
    if (RB) return RB.hits(arr(ex.anchor)).some(h => !RB.neg(h.start, h.end - h.start)) ? null : target;
    return allHits(fold, arr(ex.anchor).filter(isPhrase)).some(j => !negatedNear(fold, j, win)) ? null : target;
  };
  // Band choice for a heard entry: {v, stated}. stated: some band span is present; v: the one band
  // value the spans give, else undefined.
  //   1. Every occurrence of every band phrase on the band-matching text, a span strictly inside a
  //      longer one dropped (as in a carried reply, a carryExclude phrase holds the words it
  //      contains). Every span is present, a carryExclude span in any sentence included.
  //   2. No value when any span is negated within the window (on fold, at the span's offset in
  //      `text`), when a carryRefuse phrase occurs anywhere in the utterance, or when the spans
  //      give two or more values.
  //   3. No value either when every span is a carryExclude span lying outside every cue sentence:
  //      a sentence holding a hit of one of the entry's cues that is not negated and passes the
  //      attribution and history gates (a span or hit belongs to the sentence of its first
  //      character, at its offset in `text`). An excluded span there gives no value, but it still
  //      counts in 1 and 2.
  const heardBand = (ex) => {
    const spans = bandSpans(ex, low);
    if (!spans.length) return { v: undefined, stated: false };
    const none = spans.some(x => negatedNear(fold, at(x.start), win))
      || arr(lexicon.carryRefuse).some(p => isPhrase(p) && flow.includes(p))
      || new Set(spans.map(x => x.v)).size > 1;
    if (none) return { v: undefined, stated: true };
    const skip = arr(ex.carryExclude);
    if (spans.some(x => !skip.includes(x.phrase))) return { v: spans[0].v, stated: true };
    const ends = sentenceEnds(fold);
    const sentence = (k) => ends.filter(e => e < k).length;
    const cueSentences = new Set(allHits(fold, arr(ex.cue).filter(isPhrase))
      .filter(j => !negatedNear(fold, j, win) && plainGate(j, {}) === null).map(sentence));
    return { v: spans.some(x => cueSentences.has(sentence(at(x.start)))) ? spans[0].v : undefined, stated: true };
  };
  // The same choice under chart reading of typed chart text (a spoken line keeps heardBand, D9), from the
  // clause of the cue hit at i only: its band spans
  // (at word starts, masked spans dropped) and its carryRefuse phrases. Every span lies in that cue
  // clause, so a carryExclude span may supply the value there. A band span elsewhere in the
  // utterance supplies nothing but still counts as stated, so the entry is withheld (at most a
  // yield-only slot) as without chart reading: a duration said in another sentence ("It's been
  // going on for two days.") never lets the next reply be carried in as the episode duration.
  const heardBandAt = (ex, i) => {
    const c = R.clauseAt(i);
    const all = R.bands(ex);
    const spans = all.filter(x => { const k = at(x.start); return k >= c.start && k < c.end; });
    if (!spans.length) return { v: undefined, stated: all.length > 0 };
    const none = spans.some(x => R.neg(at(x.start), at(x.end) - at(x.start)))
      || R.hits(arr(lexicon.carryRefuse)).some(h => h.start >= c.start && h.end <= c.end)
      || new Set(spans.map(x => x.v)).size > 1;
    return { v: none ? undefined : spans[0].v, stated: true };
  };

  // Red flags: no gating of any kind (under chart reading with clauses.redFlagNegation, a flag
  // whose every mention is negated is not raised). Under chart reading each flag also reads its
  // clauses.redFlags phrases (R.flagLists: the lexicon's flags first, then flags of clauses.redFlags
  // alone).
  for (const [id, ph] of (R ? R.flagLists : Object.entries(isObj(lexicon.redFlags) ? lexicon.redFlags : {}))) {
    if (R && R.redFlagNegation) {
      const hits = R.flagHits(arr(ph));
      if (!hits.length) continue;
      const h = hits.find(x => !R.flagDenied(x));
      if (h) push(ev({ id, value: true, kind: "redflag", evidence: text, cueIndex: h.start }, h.start));
      else if (keep) push(ev({ id, value: true, kind: "redflag", evidence: text, cueIndex: hits[0].start, suppressedBy: "negated" }, hits[0].start));
      continue;
    }
    const i = firstHit(fold, arr(ph));
    if (i !== -1) push(ev({ id, value: true, kind: "redflag", evidence: text, cueIndex: i }, i));
  }

  for (const ex of arr(lexicon.bool)) {
    if (R) { chartBool(ex); continue; }
    const hits = allHits(fold, arr(ex.ph));
    if (!hits.length) continue;
    const unnegated = hits.find(i => !negatedNear(fold, i, win));
    const i = unnegated ?? hits[0];
    gated(ex.id, "item", i, unnegated === undefined ? "no" : "yes",
          { thirdParty: !!ex.thirdPartyExempt });
  }

  // Typed chart text sets no context marker (the clinical lead's decision D8 of 2026-10-12: the
  // clinician sets them): under chart reading with opts.chart a capture of kind "ctx" is not made
  // (includeSuppressed returns it with suppressedBy "chart-context"). Spoken lines keep them.
  const ctxCapture = (id, i, value) => {
    if (RB) {
      if (keep) { const g = gateOf(i, {}, id); push(ev({ id, value, kind: "ctx", evidence: text, cueIndex: i, suppressedBy: g !== null ? g : "chart-context" }, i)); }
      return;
    }
    gated(id, "ctx", i, value);
  };
  for (const ex of arr(lexicon.ctx)) {
    if (R) {
      const r = R.pick(arr(ex.ph), {}, ex.id);
      if (r.hit) ctxCapture(ex.id, r.hit.start, ex.val);
      continue;
    }
    const i = firstHit(fold, arr(ex.ph));
    if (i === -1 || negatedNear(fold, i, win)) continue;
    gated(ex.id, "ctx", i, ex.val);
  }

  for (const ex of arr(lexicon.scale)) {
    let i;
    let picked = null;
    if (R) {
      const r = R.pick(arr(ex.cue), {}, ex.id);
      if ((!r.hit || r.gated) && r.hedged) hedged.push({ id: ex.id, hit: r.hedged });
      if (!r.hit) continue;
      picked = r.hit;
      i = picked.start;
    } else {
      i = firstHit(fold, arr(ex.cue));
      if (i === -1 || negatedNear(fold, i, win)) continue;
    }
    let v = ex.fallback;
    let stated = false;
    if (ex.heard === true) {
      const hb = RB ? heardBandAt(ex, i) : heardBand(ex);
      if (hb.v !== undefined) v = hb.v;
      stated = hb.stated;
    } else if (R) {
      for (const b of arr(ex.bands)) { if (R.lowHits(arr(b.ph)).length) { v = b.v; break; } }
    } else {
      for (const b of arr(ex.bands)) { if (firstHit(norm, arr(b.ph)) !== -1) { v = b.v; break; } }
    }
    // Yield (only with yieldTo): no item capture, no heard capture, not unresolved.
    const yt = yieldTarget(ex);
    if (yt !== null) {
      yielded.push(ex.id);
      if (keep && v !== null && v !== undefined) push(ev({ id: ex.id, value: v, kind: "item", evidence: text, cueIndex: i, suppressedBy: "yield" }, i));
      continue;
    }
    if (v === null || v === undefined) {
      // The cue without its value: the entry stays unanswered and no fallback is substituted. It
      // is unresolved (carry-over may arm) only when no band span was stated, else withheld (at
      // most a yield-only slot arms).
      const heard = heardOn && ex.heard === true;
      const g = gateOf(i, {}, ex.id);
      if (g !== null && !(heard && keep)) continue;
      const hit = R ? picked : firstHitPhrase(fold, arr(ex.cue));
      const cue = hit ? hit.phrase : "";
      const cueText = text.slice(i, i + String(cue).length);
      if (heard) {
        push(ev(g === null ? { id: ex.id, kind: "heard", evidence: text, cueIndex: i, cue, cueText }
          : { id: ex.id, kind: "heard", evidence: text, cueIndex: i, cue, cueText, suppressedBy: g }, i));
      }
      if (g === null) {
        if (stated) withheld.push({ id: ex.id, cueIndex: i, cue, cueText });
        else unresolved.push({ id: ex.id, cueIndex: i, cue, cueText });
      }
      continue;
    }
    gated(ex.id, "item", i, v);
  }

  for (const ex of arr(lexicon.multi)) {
    if (R) {
      const r = R.pick(arr(ex.ph), {}, null);
      if ((!r.hit || r.gated) && r.hedged) for (const t of arr(ex.ids)) if (isObj(t) && t.kind === "item") hedged.push({ id: t.id, hit: r.hedged });
      if (r.hit) for (const t of arr(ex.ids)) { if (t.kind === "ctx") ctxCapture(t.id, r.hit.start, t.value); else gated(t.id, t.kind, r.hit.start, t.value); }
      continue;
    }
    const i = firstHit(fold, arr(ex.ph));
    if (i === -1 || negatedNear(fold, i, win)) continue;
    for (const t of arr(ex.ids)) gated(t.id, t.kind, i, t.value);
  }

  return { captures: found, unresolved, withheld, yielded, view, chart: R ? { reader: R, hedged, conflicts } : null };
}

/**
 * Captures from one utterance (Ext L217-268, with the lexicon injected).
 * Returns [{ id, value, kind, evidence, cueIndex, suppressedBy? }].
 *   opts.negationWindow overrides the lexicon's window (the benchmark sweep);
 *   opts.includeSuppressed also returns matches suppressed by an attribution or history cue,
 *     and values withheld by a yield (suppressedBy "yield");
 *   opts.includeHeard also returns heard captures for scale entries with heard: true:
 *     { id, kind: "heard", evidence, cueIndex, cue, cueText, suppressedBy? }, no value key
 *     (cue = the matched lexicon phrase, cueText = the patient's own words for it);
 *   opts.pendingIds ids treated as present for yieldTo (the item awaiting a value);
 *   opts.chart true reads typed chart text (the header's "Chart reading": the clauses.chartIgnoreThirdParty
 *     cues do not gate before a finding, no context marker is captured, a heard entry's band comes from
 *     its cue's clause); without lexicon.clauses it changes nothing here (extractInContext: it never
 *     carries, whatever the lexicon). Without opts.chart a lexicon with clauses reads the utterance as
 *     a spoken line ("Spoken lines" in the header; D9, 2026-10-12).
 * While includeHeard and pendingIds are absent, the output for a lexicon without heard, yieldTo and
 * normalize is byte-identical to the baseline's (whatever its clarify field; a lexicon with clauses is
 * read with chart reading). A missing lexicon captures nothing.
 * Under chart reading (lexicon.clauses, every line) each capture's evidence is its clause's text and
 * clause: {start, end} is added last; includeSuppressed also returns, with suppressedBy, a
 * yes/no conflict ("conflict", "Mentions" in the header), a mention set aside in a placeholder or hedged clause, by a
 * prefix or as uncertain ("placeholder", "hedge", "attribute", "scope"), a section gate ("section") and, with
 * clauses.redFlagNegation, a flag whose every mention is denied ("negated").
 */
export function extract(lexicon, text, opts = {}) {
  if (!isObj(lexicon) || typeof text !== "string") return [];
  return scan(lexicon, text, opts).captures;
}

/**
 * The one pending slot ("Slots" in the header). yieldOnly: true marks a yield-only slot: pending
 * for yieldTo, consumed and expired like any slot, never carried into. Absent or false: the slot may
 * carry. A yieldOnly that is present and not a boolean makes the slot invalid (dropped in step 1).
 * A normal slot this engine arms has no yieldOnly key.
 * @typedef {{id:string, cue:string, cueText:string, evidence:string, cueIndex:number, turnsLeft:number, yieldOnly?:boolean}} PendingCue
 */

/**
 * One PATIENT utterance in the context of a cue heard earlier without its value (design 05 §3.3,
 * round 2: §12.2, §12.3, §12.6; round 3: R9 f, R10; round 3b: yield-only slots).
 * Pure: never mutates lexicon, pending or opts; the same inputs give the same output.
 * includeSuppressed is not supported here (ignored).
 *
 * The captures are extract(lexicon, text, {includeHeard: true, pendingIds}) in its family order,
 * plus, when the pending item's value is carried, one item capture last:
 *   { id, value, kind: "item", evidence, cueIndex, via: "carry", band,
 *     carriedFrom: { cue, cueText, evidence, cueIndex } }
 * The reply's band spans of the pending entry are all collected, its carryExclude phrases
 * included, a span strictly inside a longer one dropped. The reply is refused "negated" when any
 * span is negated (a negation cue in the window before it, or anywhere in the reply before it),
 * "ambiguous" when the spans give two or more values, and "no-band" when it has no span or only
 * carryExclude spans; otherwise the value is carried from the first span that is not a
 * carryExclude phrase. The attribution and history checks look at every span.
 * An utterance read with carry on that states the pending entry's band without giving its value
 * (scan's withheld) turns the slot yield-only, and step 6 refreshes it to the entry's full carry:
 * no later reply is carried into it, and it still counts as present for yieldTo until it expires.
 * With opts.carry false the slot is still validated, consumed, expired and re-armed, and still
 * counts as present for yieldTo, but no value is carried and no refusal is recorded (for an item
 * that is already answered or skipped). A yield-only slot (pending.yieldOnly true) is always read
 * so. Arming, superseding and refreshing follow "Slots" in the header.
 * A blank text consumes nothing and returns `pending` unchanged. With opts.chart true (typed chart
 * text, release 0.4.7) the utterance is read as chart text (extract's opts.chart: the
 * clauses.chartIgnoreThirdParty cues do not gate before a finding) with a valid slot's id pending
 * (for yieldTo), and `pending` comes back unchanged: nothing is consumed, refused, carried into or
 * armed. That holds for every lexicon, lexicon.clauses or not: a typed reply never carries.
 * Steps 2-7 read a spoken line: its captures with chart reading under lexicon.clauses (D9, 2026-10-12;
 * "Spoken lines" in the header), its slot, carry and refusal by exactly release 0.4.6's rules (a
 * carried capture keeps the whole reply as its evidence, with no clause).
 * @param {Object} lexicon
 * @param {string} text
 * @param {PendingCue|null} pending
 * @param {{negationWindow?:number, carry?:boolean, chart?:boolean}} [opts]
 * @returns {{captures:Object[], pending:(PendingCue|null), carry:{applied:boolean, refused:(null|string)}}}
 *   refused ∈ "answered" | "own-cue" | "other-entry" | "question" | "refuse-phrase" | "no-band" |
 *             "negated" | "ambiguous" | "third-party" | "historical"   (null when nothing was pending,
 *             the value was carried, opts.carry is false or the slot is yield-only)
 */
export function extractInContext(lexicon, text, pending = null, opts = {}) {
  // Step 0: guards.
  if (!isObj(lexicon) || typeof text !== "string" || !text.trim()) {
    return { captures: [], pending, carry: { applied: false, refused: null } };
  }
  const o = isObj(opts) ? opts : {};
  const NEGATION = cueSpec(lexicon.negation);
  const THIRD_PARTY = cueSpec(lexicon.thirdParty);
  const HISTORICAL = cueSpec(lexicon.historical);
  const win = o.negationWindow ?? NEGATION.window;
  const carryOn = o.carry !== false;
  const entry = (id) => arr(lexicon.scale).find(e => isObj(e) && e.id === id);
  const carryOf = (e) => (isObj(e) && e.heard === true && Number.isInteger(e.carry)
    && e.carry >= 1 && e.carry <= LEXICON_CARRY_MAX ? e.carry : 0);

  // Step 1: the slot, only for an entry that may carry; turnsLeft clamped to its carry, on a copy.
  // yieldOnly, when present, must be a boolean.
  let p = null;
  if (isObj(pending) && Number.isInteger(pending.turnsLeft) && pending.turnsLeft > 0
      && (pending.yieldOnly === undefined || typeof pending.yieldOnly === "boolean")) {
    const c = carryOf(entry(pending.id));
    if (c > 0) p = { ...pending, turnsLeft: Math.min(pending.turnsLeft, c) };
  }
  const yieldOnly = p !== null && p.yieldOnly === true;

  // Typed chart text: read it, leave the slot exactly as it was.
  if (o.chart === true) {
    const sc = scan(lexicon, text, { negationWindow: win, includeHeard: true, pendingIds: p ? [p.id] : [], chart: true });
    return { captures: sc.captures, pending, carry: { applied: false, refused: null } };
  }

  // Step 2: the utterance itself; a pending item counts as present for yieldTo.
  const s = scan(lexicon, text, { negationWindow: win, includeHeard: true, pendingIds: p ? [p.id] : [] });
  const caps = s.captures.slice();
  const { fold, flow, low, at } = s.view;
  const negatedAt = (idx) => cueBefore(fold, idx, { window: win, cues: NEGATION.cues });
  // A negation cue anywhere in the reply before `idx` (the window reaches back to the start).
  const negatedBefore = (idx) => cueBefore(fold, idx, { window: idx, cues: NEGATION.cues });

  // Step 3: every non-blank patient utterance consumes one reply.
  let next = p ? { ...p, turnsLeft: p.turnsLeft - 1 } : null;
  let applied = false;
  let refused = null;

  // Step 4: carry, stopping at the first rule that applies (skipped entirely with opts.carry false
  // and for a yield-only slot).
  if (p && carryOn && !yieldOnly) {
    const pe = entry(p.id);
    const has = (phrases) => arr(phrases).some(ph => isPhrase(ph) && flow.includes(ph));
    const anchoredUnnegated = (e) => allHits(fold, arr(e.anchor).filter(isPhrase)).some(j => !negatedAt(j));
    if (caps.some(c => c.kind === "item" && c.id === p.id)) {
      refused = "answered";
      next = null;
    } else if (has(pe.cue)) {
      refused = "own-cue";
    } else if (topicSpans(lexicon, flow, p.id, e => arr(e.yieldTo).includes(p.id) && !anchoredUnnegated(e)).length > 0) {
      refused = "other-entry";
    } else if (/[?¿]/.test(text)) {
      refused = "question";
    } else if (has(lexicon.carryRefuse)) {
      refused = "refuse-phrase";
    } else {
      // The pending entry's band spans, its carryExclude phrases included, each with its offset
      // in `text`, where every window is measured. An excluded phrase never supplies the value,
      // but it can make the reply negated or ambiguous. Every rule here only refuses: a negated
      // span refuses the whole reply rather than leaving another span to win.
      const skip = arr(pe.carryExclude);
      const spans = bandSpans(pe, low).map(x => ({ ...x, at: at(x.start) }));
      const carriable = spans.filter(x => !skip.includes(x.phrase));
      if (!spans.length) refused = "no-band";
      else if (spans.some(x => negatedAt(x.at) || negatedBefore(x.at))) refused = "negated";
      else if (new Set(spans.map(x => x.v)).size > 1) refused = "ambiguous";
      else if (!carriable.length) refused = "no-band";
      else if (spans.some(x => cueBefore(fold, x.at, THIRD_PARTY))) refused = "third-party";
      else if (spans.some(x => cueBefore(fold, x.at, HISTORICAL))) refused = "historical";
      else {
        const first = carriable.reduce((a, x) => (x.start < a.start ? x : a));
        caps.push({ id: p.id, value: first.v, kind: "item", evidence: text, cueIndex: first.at, via: "carry", band: first.phrase,
                    carriedFrom: { cue: p.cue, cueText: p.cueText, evidence: p.evidence, cueIndex: p.cueIndex } });
        next = null;
        applied = true;
      }
    }
    // The utterance states the pending entry's band without giving its value: the slot turns
    // yield-only (step 6 refreshes it), so no later reply is carried into it while the entries
    // that yield to it keep yielding.
    if (next && s.withheld.some(w => w.id === p.id)) next = { ...next, yieldOnly: true };
  }

  // Step 5: expiry.
  if (next && next.turnsLeft <= 0) next = null;

  // Step 6: arming, superseding, refreshing, by the rules of "Slots" in the header, in their order.
  // armScan is the scan round 3+ makes of this utterance (r in the header): s, or, while a yield-only
  // slot is read, the utterance scanned with no id pending, so a normal slot arms exactly when round
  // 3+ arms one (rule 1). Any other awaited value supersedes the slot without arming one, and two or
  // more make any reply ambiguous: the slot is cleared (rule 2). A withheld entry arms at most a
  // yield-only slot, and it ends any slot of an entry that is not withheld on the line, a normal one
  // included (rules 3c-3e).
  const armScan = yieldOnly ? scan(lexicon, text, { negationWindow: win, includeHeard: true, pendingIds: [] }) : s;
  const embedded = (u) => topicSpans(lexicon, flow, u.id, e => armScan.yielded.includes(e.id))
    .some(x => x.start < u.cueIndex + String(u.cue).length && u.cueIndex < x.end);
  const ids = [...new Set(armScan.unresolved.map(u => u.id))];
  const one = ids.length === 1 ? armScan.unresolved[0] : null;
  const oneCarry = one ? carryOf(entry(one.id)) : 0;
  const held = [...new Set(s.withheld.filter(w => carryOf(entry(w.id)) > 0).map(w => w.id))];
  if (oneCarry > 0 && !embedded(one)) {
    next = { id: one.id, cue: one.cue, cueText: one.cueText, evidence: text, cueIndex: one.cueIndex, turnsLeft: oneCarry };
  } else if (s.unresolved.length) {
    next = null;
  } else if (held.length && !(next && next.yieldOnly !== true && held.includes(next.id))) {
    // Rules 3b (a yield-only slot of a withheld entry is refreshed), 3c (a normal slot of another
    // entry ends), 3d and 3e; 3a and a normal slot of a withheld entry keep the slot as it is.
    const own = next !== null && held.includes(next.id);
    const w = s.withheld.find(x => x.id === (own ? next.id : held[0]));
    next = own || held.length === 1
      ? { id: w.id, cue: w.cue, cueText: w.cueText, evidence: text, cueIndex: w.cueIndex, turnsLeft: carryOf(entry(w.id)), yieldOnly: true }
      : null;
  }

  // Step 7.
  return { captures: caps, pending: next, carry: { applied, refused } };
}

/**
 * Clarification cues of one text (release 0.4.7): what the clinician should be asked because the
 * text names something without the detail the screen needs. Outside extract and extractInContext,
 * so no capture, carry-over slot, gold-set label or benchmark depends on it. Pure.
 *   trigger      for each lexicon.clarify entry {id, ph, unless?, probe | item, ask?, source}: the
 *                first hit of a ph phrase, in text order, that is not negated (a mention set aside as
 *                uncertain still asks, R3), not attributed to someone else, not historical, not in a
 *                "skip" or "family" section or a placeholder clause (an "exam" section never gates a
 *                trigger), and whose clause holds none of the entry's unless phrases undenied (R3: a
 *                qualifier the text denies states the other answer and resolves nothing, so "Tinnitus,
 *                not bilateral" keeps the laterality card); triggers and unless phrases are matched
 *                with no clauses.mask applied (a mask hides a phrase from capture only, R2);
 *   hedge        (lexicon.clauses, opts.chart) each item mentioned only in hedged clauses and captured
 *                nowhere;
 *   conflict     (lexicon.clauses, opts.chart) each yes/no item in conflict ("Mentions" in the
 *                extractor header: one finding affirmed and denied, or any of a clauses.strictConflict
 *                item; no capture was made); `against` quotes the mention of the other polarity;
 *   placeholder  (lexicon.clauses.placeholder, opts.chart) one cue, at the first placeholder.
 * A hedge or conflict cue carries the id of an item entry of lexicon.clarify for that item when
 * there is one (its ask then applies), else the item's id. The placeholder cue's id is
 * "@placeholder", which no entry id can be. opts.chart true reads typed chart text, as extract does
 * (chart reading under lexicon.clauses; the clauses.chartIgnoreThirdParty cues do not gate before a
 * finding); the Scribe calls clarifyCues for typed text only, always with it. Without opts.chart, or
 * without lexicon.clauses, the triggers are read on the structural clauses with the lexicon's
 * negation window (clipped to the clause) and no word-start rule, and there are no hedge, conflict or
 * placeholder cues. Returns [] for a lexicon with neither field.
 * Cue = {kind: "clarify", id, reason, probe | item (none for a placeholder), evidence (the clause's
 *        text), clause: {start, end}, cueIndex, cueText, against?}, in text order.
 * @param {Object} lexicon
 * @param {string} text
 * @param {{negationWindow?:number, chart?:boolean}} [opts]
 * @returns {Object[]}
 */
export function clarifyCues(lexicon, text, opts = {}) {
  if (!isObj(lexicon) || typeof text !== "string" || !text.trim()) return [];
  const entries = arr(lexicon.clarify).filter(e => isObj(e) && typeof e.id === "string");
  if (!entries.length && !isObj(lexicon.clauses)) return [];
  const o = isObj(opts) ? opts : {};
  const win = o.negationWindow ?? cueSpec(lexicon.negation).window;
  // Clarification stays with typed chart text (D9 extended chart reading to spoken lines, not
  // clarification): without opts.chart the triggers are read on the structural clauses, as before.
  const s = o.chart === true ? scan(lexicon, text, { negationWindow: win, includeHeard: true, chart: true }) : null;
  const R = s && s.chart ? s.chart.reader : chartReader(lexicon, text, textView(lexicon, text, true), {}, win, false);
  const out = [];
  const cue = (reason, id, target, h, extra = {}) => {
    const c = R.clauseAt(h.start);
    out.push({ kind: "clarify", id, reason, ...target, evidence: text.slice(c.start, c.end), clause: { start: c.start, end: c.end },
      cueIndex: h.start, cueText: text.slice(h.start, h.end), ...extra });
  };
  for (const e of entries) {
    const hasProbe = typeof e.probe === "string";
    if (hasProbe === (typeof e.item === "string")) continue;
    // Triggers and qualifiers are matched without the mask (a mask hides a phrase from capture only). A
    // qualifier the text denies states the other answer and resolves nothing (R3: "not bilateral",
    // "non-alternating"); a trigger set aside as uncertain still asks (R3: "No nausea, tinnitus in the
    // right ear only.").
    const unless = R.rawHits(arr(e.unless)).filter(u => R.neg(u.start, u.end - u.start) === false);
    const h = R.rawHits(arr(e.ph)).find(x => {
      const c = R.clauseAt(x.start);
      const n = R.neg(x.start, x.end - x.start);
      return !c.placeholder && (n === false || n === "uncertain") && R.triggerGate(x.start) === null
        && !unless.some(u => u.start >= c.start && u.start < c.end);
    });
    if (h) cue("trigger", e.id, hasProbe ? { probe: e.probe } : { item: e.item }, h);
  }
  if (s && s.chart) {
    const captured = new Set(s.captures.filter(c => c.suppressedBy === undefined && (c.kind === "item" || c.kind === "heard")).map(c => c.id));
    const entryFor = (item) => { const e = entries.find(x => x.item === item && typeof x.probe !== "string"); return e ? e.id : item; };
    const seen = new Set();
    for (const hd of s.chart.hedged) {
      if (captured.has(hd.id) || seen.has(hd.id)) continue;
      seen.add(hd.id);
      cue("hedge", entryFor(hd.id), { item: hd.id }, hd.hit);
    }
    for (const cf of s.chart.conflicts) {
      const [a, b] = cf.yes.start <= cf.no.start ? [cf.yes, cf.no] : [cf.no, cf.yes];
      const cb = R.clauseAt(b.start);
      cue("conflict", entryFor(cf.id), { item: cf.id }, a, { against: { evidence: text.slice(cb.start, cb.end),
        clause: { start: cb.start, end: cb.end }, cueIndex: b.start, cueText: text.slice(b.start, b.end) } });
    }
    const ph = R.placeholderHit();
    if (ph) cue("placeholder", "@placeholder", {}, ph);
  }
  return out.map((x, n) => [x, n]).sort((x, y) => (x[0].cueIndex - y[0].cueIndex) || (x[1] - y[1])).map(x => x[0]);
}

/**
 * An extractor bound to one lexicon: `extract(text, opts)`, `extractInContext(text, pending, opts)`,
 * `clarifyCues(text, opts)`, `negatedNear(text, idx, window)` (default window = the lexicon's
 * negation window, Ext L202-203) and `lexiconVersion`.
 */
export function createExtractor(lexicon) {
  const lex = isObj(lexicon) ? lexicon : null;
  const NEGATION = cueSpec(lex && lex.negation);
  return {
    extract: (text, opts = {}) => extract(lex, text, opts),
    extractInContext: (text, pending = null, opts = {}) => extractInContext(lex, text, pending, opts),
    clarifyCues: (text, opts = {}) => clarifyCues(lex, text, opts),
    negatedNear: (text, idx, window = NEGATION.window) => cueBefore(text, idx, { window, cues: NEGATION.cues }),
    lexiconVersion: lex && typeof lex.version === "string" ? lex.version : null,
  };
}

/**
 * FAERS adapter (Ext L285-300, verbatim): maps openFDA adverse-event records (an array or
 * `{results}`) onto benchmark utterances. A declared interface, not a validated one.
 */
export function faersToUtterances(records) {
  const arr = Array.isArray(records) ? records : (records?.results ?? []);
  return arr.flatMap(rec => {
    const id = rec.safetyreportid ?? rec.safetyReportId ?? null;
    const texts = [];
    for (const r of rec.patient?.reaction ?? []) {
      if (r.reactionmeddrapt) texts.push(r.reactionmeddrapt);
    }
    if (rec.narrativeincludeclinical) texts.push(rec.narrativeincludeclinical);
    return texts.filter(Boolean).map((text, k) => ({
      utteranceId: id ? `faers-${id}-${k}` : `faers-anon-${k}`,
      register: "narrative",
      speaker: "reporter",
      text: String(text),
    }));
  });
}
