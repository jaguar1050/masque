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
//                     evidence is always the original text.
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

import { LEXICON_CARRY_MAX } from "./contract.js";

/** What kind of extractor this is (Ext L25). */
export const EXTRACTOR_KIND = "rule-based / phrase-match with local negation";
/**
 * The lexicon fields this extractor honours beyond the baseline's (printed by the benchmark).
 * "normalize.numbers" applies to band phrase matching only.
 */
export const EXTRACTOR_FEATURES = Object.freeze(["scale.heard", "scale.carry", "scale.carryExclude", "scale.yieldTo",
  "scale.anchor", "carryRefuse", "normalize.apostrophes", "normalize.numbers"]);

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
// No lookbehind (Safari before 16.4 cannot parse one, and every page importing this file would
// fail; decision as for policy.js OMISSION_PATTERNS): the character before the token (or the
// string start) is matched instead of looked behind, and group 1 is the token, starting at
// m.index + m[0].length - m[1].length. The tokens found are exactly those of the former
// negative-lookbehind form (checked on a random corpus).
const NUMBER_TOKEN = /(?:^|[^\p{L}\p{N}.:\/,%-])(\d+)(?![\p{L}\p{N}:\/,%-])(?!\.\S)/gu;
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

/**
 * `text` lowercased without changing its length, so an index into the result is an index into
 * `text`. String.prototype.toLowerCase is used whenever it keeps the length (every text the
 * baseline was written for); otherwise each code point whose lowercase form has a different
 * length ("İ" → "i̇") is kept as it is. The hit positions and the cue windows are then measured
 * in the same index space as the original text.
 */
export function lowerSameLength(text) {
  const low = text.toLowerCase();
  if (low.length === text.length) return low;
  let out = "";
  for (const ch of text) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}

/** Index of the first phrase (in list order) found in `text`, case-insensitively; -1 if none (Ext L172-175). */
export function firstHit(text, phrases) {
  const low = lowerSameLength(text);
  for (const p of phrases) { const i = low.indexOf(p); if (i !== -1) return i; }
  return -1;
}

/**
 * Every position any phrase matches, ascending (Ext L187-195). Scanning all hits and
 * preferring an unnegated one means a single unnegated mention is an affirmation regardless
 * of what else in the sentence is denied.
 */
export function allHits(text, phrases) {
  const low = lowerSameLength(text);
  const out = [];
  for (const p of phrases) {
    let i = low.indexOf(p);
    while (i !== -1) { out.push(i); i = low.indexOf(p, i + p.length); }
  }
  return out.sort((a, b) => a - b);
}

/** Whether any cue of `spec` ({window, cues}) occurs in the `spec.window` characters before `idx` (Ext L197-200). */
export function cueBefore(text, idx, spec) {
  const pre = lowerSameLength(text.slice(Math.max(0, idx - spec.window), idx));
  return spec.cues.some(c => pre.includes(c));
}

/** The first phrase (in list order, exactly as firstHit) found in `text`, with its index; null if none. */
function firstHitPhrase(text, phrases) {
  const low = lowerSameLength(text);
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
 * The texts matching runs on, and the map back to `text`: {fold, flow, norm, low, at}.
 *   fold, flow  `text` with typographic apostrophes folded (lexicon.normalize.apostrophes), and its
 *               lowercase. fold has the length of `text`, so an offset in fold is an offset in
 *               `text`. Every phrase except a band phrase, and every gate window, is matched on fold.
 *   norm, low   fold with standalone small integers spelled out (lexicon.normalize.numbers), and its
 *               lowercase. Band phrases alone are matched there.
 *   at(k)       maps an offset in norm to `text`; an offset inside a spelled-out number maps to the
 *               start of its digits.
 * Without lexicon.normalize, fold === norm === text and `at` is the identity.
 */
function textView(lexicon, text) {
  const n = isObj(lexicon.normalize) ? lexicon.normalize : null;
  const fold = n !== null && n.apostrophes === true ? text.replace(CURLY_APOSTROPHES, "'") : text;
  const flow = lowerSameLength(fold);
  const plain = { fold, flow, norm: fold, low: flow, at: same };
  if (n === null || n.numbers !== "en") return plain;
  const starts = [];
  let norm = "";
  let last = 0;
  let changed = false;
  for (const m of fold.matchAll(NUMBER_TOKEN)) {
    const word = NUMBER_WORDS_EN.get(m[1]);
    if (word === undefined) continue;
    const a = m.index + m[0].length - m[1].length;
    for (let k = last; k < a; k++) starts.push(k);
    for (let k = 0; k < word.length; k++) starts.push(a);
    norm += fold.slice(last, a) + word;
    last = a + m[1].length;
    changed = true;
  }
  if (!changed) return plain;
  for (let k = last; k < fold.length; k++) starts.push(k);
  norm += fold.slice(last);
  starts.push(fold.length);
  const clamp = (k) => (k < 0 ? 0 : k > norm.length ? norm.length : k);
  return { fold, flow, norm, low: lowerSameLength(norm), at: (k) => starts[clamp(k)] };
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
 */
function scan(lexicon, text, opts) {
  const NEGATION = cueSpec(lexicon.negation);
  const THIRD_PARTY = cueSpec(lexicon.thirdParty);
  const HISTORICAL = cueSpec(lexicon.historical);
  const negatedNear = (t, idx, window = NEGATION.window) => cueBefore(t, idx, { window, cues: NEGATION.cues });
  const thirdPartyNear = (t, idx) => cueBefore(t, idx, THIRD_PARTY);
  const historicalNear = (t, idx) => cueBefore(t, idx, HISTORICAL);

  const view = textView(lexicon, text);
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
  // The attribution or history cue that suppresses a capture at `i`, or null. An entry marked
  // thirdPartyExempt is inherently about someone else (a family history), so an attribution cue
  // is the finding rather than a misattribution of it.
  const gateOf = (i, exempt) => (!exempt.thirdParty && thirdPartyNear(fold, i) ? "third-party"
    : historicalNear(fold, i) ? "historical" : null);
  const gated = (id, kind, i, value, exempt = {}) => {
    const g = gateOf(i, exempt);
    if (g !== null) { if (keep) push({ id, value, kind, evidence: text, cueIndex: i, suppressedBy: g }); return; }
    push({ id, value, kind, evidence: text, cueIndex: i });
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
      .filter(j => !negatedNear(fold, j, win) && gateOf(j, {}) === null).map(sentence));
    return { v: spans.some(x => cueSentences.has(sentence(at(x.start)))) ? spans[0].v : undefined, stated: true };
  };

  // Red flags: no gating of any kind.
  for (const [id, ph] of Object.entries(isObj(lexicon.redFlags) ? lexicon.redFlags : {})) {
    const i = firstHit(fold, arr(ph));
    if (i !== -1) push({ id, value: true, kind: "redflag", evidence: text, cueIndex: i });
  }

  for (const ex of arr(lexicon.bool)) {
    const hits = allHits(fold, arr(ex.ph));
    if (!hits.length) continue;
    const unnegated = hits.find(i => !negatedNear(fold, i, win));
    const i = unnegated ?? hits[0];
    gated(ex.id, "item", i, unnegated === undefined ? "no" : "yes",
          { thirdParty: !!ex.thirdPartyExempt });
  }

  for (const ex of arr(lexicon.ctx)) {
    const i = firstHit(fold, arr(ex.ph));
    if (i === -1 || negatedNear(fold, i, win)) continue;
    gated(ex.id, "ctx", i, ex.val);
  }

  for (const ex of arr(lexicon.scale)) {
    const i = firstHit(fold, arr(ex.cue));
    if (i === -1 || negatedNear(fold, i, win)) continue;
    let v = ex.fallback;
    let stated = false;
    if (ex.heard === true) {
      const hb = heardBand(ex);
      if (hb.v !== undefined) v = hb.v;
      stated = hb.stated;
    } else {
      for (const b of arr(ex.bands)) { if (firstHit(norm, arr(b.ph)) !== -1) { v = b.v; break; } }
    }
    // Yield (only with yieldTo): no item capture, no heard capture, not unresolved.
    const yt = yieldTarget(ex);
    if (yt !== null) {
      yielded.push(ex.id);
      if (keep && v !== null && v !== undefined) push({ id: ex.id, value: v, kind: "item", evidence: text, cueIndex: i, suppressedBy: "yield" });
      continue;
    }
    if (v === null || v === undefined) {
      // The cue without its value: the entry stays unanswered and no fallback is substituted. It
      // is unresolved (carry-over may arm) only when no band span was stated, else withheld (at
      // most a yield-only slot arms).
      const heard = heardOn && ex.heard === true;
      const g = gateOf(i, {});
      if (g !== null && !(heard && keep)) continue;
      const hit = firstHitPhrase(fold, arr(ex.cue));
      const cue = hit ? hit.phrase : "";
      const cueText = text.slice(i, i + String(cue).length);
      if (heard) {
        push(g === null ? { id: ex.id, kind: "heard", evidence: text, cueIndex: i, cue, cueText }
          : { id: ex.id, kind: "heard", evidence: text, cueIndex: i, cue, cueText, suppressedBy: g });
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
    const i = firstHit(fold, arr(ex.ph));
    if (i === -1 || negatedNear(fold, i, win)) continue;
    for (const t of arr(ex.ids)) gated(t.id, t.kind, i, t.value);
  }

  return { captures: found, unresolved, withheld, yielded, view };
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
 *   opts.pendingIds ids treated as present for yieldTo (the item awaiting a value).
 * While includeHeard and pendingIds are absent, the output for a lexicon without heard, yieldTo
 * and normalize is byte-identical to the baseline's. A missing lexicon captures nothing.
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
 * A blank text consumes nothing and returns `pending` unchanged.
 * @param {Object} lexicon
 * @param {string} text
 * @param {PendingCue|null} pending
 * @param {{negationWindow?:number, carry?:boolean}} [opts]
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
 * An extractor bound to one lexicon: `extract(text, opts)`, `extractInContext(text, pending, opts)`,
 * `negatedNear(text, idx, window)` (default window = the lexicon's negation window, Ext L202-203)
 * and `lexiconVersion`.
 */
export function createExtractor(lexicon) {
  const lex = isObj(lexicon) ? lexicon : null;
  const NEGATION = cueSpec(lex && lex.negation);
  return {
    extract: (text, opts = {}) => extract(lex, text, opts),
    extractInContext: (text, pending = null, opts = {}) => extractInContext(lex, text, pending, opts),
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
